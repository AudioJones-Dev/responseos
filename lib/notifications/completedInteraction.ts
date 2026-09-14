import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { err, errFromThrown, ok, type Result } from "@/lib/data/result";
import { sanitizeCrmText } from "@/lib/crm/sanitization";
import { BusinessMemorySnapshotSchema } from "@/lib/prospectBootstrap/contracts";
import { readOperatingConfigurationValue } from "@/lib/agentExecution/operatingConfiguration";
import { getEmailProvider, isRetryableEmailErrorCode, type EmailProvider } from "@/lib/providers/email";

/**
 * Completed-interaction notification (ADR-0056).
 *
 * A durable row first, then one provider dispatch, then `sent` or `failed`
 * with a retryable error code. A failure here never fails the call: the
 * caller's record is already written, and the row makes the missed email
 * visible and replayable.
 *
 * What it never carries: the transcript, the recording, the provider webhook
 * body, credentials, or any CRM history. Operational fields only.
 */

const NOTIFICATION_EVENT = "completed_interaction";
const RETRY_DELAY_MS = 10 * 60 * 1000;

export interface CompletedInteractionDispatch {
  status: "sent" | "failed" | "skipped";
  notificationId: string | null;
  reason?: string;
  providerId?: string;
}

const EVENT_TYPE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  new_sales: "Sales Enquiry",
  existing_customer_new_sale: "Existing Customer Sale",
  new_service_request: "Service Request",
  existing_service_request: "Existing Service Request",
  general_admin: "General Enquiry",
  contractor_vendor: "Contractor or Vendor Call",
  human_escalation: "Escalation",
  unknown: "Call",
});

function callerName(contact: { first_name: string | null; last_name: string | null } | null): string {
  const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ").trim();
  return name || "Unknown caller";
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export function buildCompletedInteractionMessage(params: {
  businessName: string;
  eventTypeLabel: string;
  caller: string;
  callerPhone: string;
  relationship: string;
  service: string;
  location: string;
  summary: string;
  qualification: string;
  quoteRequested: boolean;
  photosRequested: boolean;
  nextAction: string;
  crmStatus: string;
  callReference: string;
  receivedAt: string;
}): { subject: string; text: string } {
  return {
    subject: `New ${params.eventTypeLabel} — ${params.caller} | ${params.businessName}`,
    text: [
      `Business: ${params.businessName}`,
      `Event type: ${params.eventTypeLabel}`,
      `Received: ${params.receivedAt}`,
      "",
      `Caller: ${params.caller}`,
      `Callback number: ${params.callerPhone}`,
      `Relationship: ${params.relationship}`,
      `Service: ${params.service}`,
      `Location: ${params.location}`,
      "",
      `Summary: ${params.summary}`,
      `Qualification: ${params.qualification}`,
      `Quote requested: ${yesNo(params.quoteRequested)}`,
      `Installation photos requested: ${yesNo(params.photosRequested)}`,
      `Next action: ${params.nextAction}`,
      `CRM sync: ${params.crmStatus}`,
      "",
      `ResponseOS call reference: ${params.callReference}`,
      "The transcript and any recording stay in ResponseOS and are not attached to this email.",
    ].join("\n"),
  };
}

async function sendNotificationRow(params: {
  notificationId: string;
  recipient: string;
  subject: string;
  message: string;
  dedupeKey: string;
  provider: EmailProvider;
  requireLiveProvider: boolean;
  attemptCount: number;
  now: Date;
}): Promise<CompletedInteractionDispatch> {
  if (!db) return { status: "failed", notificationId: params.notificationId, reason: "no_database" };

  if (params.requireLiveProvider && params.provider.providerId !== "resend") {
    await db.notification.update({
      where: { id: params.notificationId },
      data: {
        status: "failed",
        provider: params.provider.providerId,
        last_error_code: "live_provider_disabled",
        next_attempt_at: null,
      },
    });
    return {
      status: "failed",
      notificationId: params.notificationId,
      reason: "live_provider_disabled",
      providerId: params.provider.providerId,
    };
  }

  try {
    // The stored subject and body are resent verbatim. Rebuilding them would
    // change the payload behind an unchanged idempotency key, which the
    // provider rejects.
    const sent = await params.provider.send({
      to: params.recipient,
      subject: params.subject,
      text: params.message,
      idempotencyKey: params.dedupeKey,
    });
    await db.notification.update({
      where: { id: params.notificationId },
      data: {
        status: "sent",
        provider: params.provider.providerId,
        provider_message_id: sent.providerMessageId,
        sent_at: params.now,
        attempt_count: params.attemptCount + 1,
        last_error_code: null,
        next_attempt_at: null,
      },
    });
    return { status: "sent", notificationId: params.notificationId, providerId: params.provider.providerId };
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : "email_send_failed";
    await db.notification.update({
      where: { id: params.notificationId },
      data: {
        status: "failed",
        provider: params.provider.providerId,
        attempt_count: params.attemptCount + 1,
        last_error_code: code,
        next_attempt_at: isRetryableEmailErrorCode(code)
          ? new Date(params.now.getTime() + RETRY_DELAY_MS)
          : null,
      },
    });
    return {
      status: "failed",
      notificationId: params.notificationId,
      reason: code,
      providerId: params.provider.providerId,
    };
  }
}

export async function dispatchCompletedInteractionNotification(params: {
  accountId: string;
  callId: string;
  requireLiveProvider?: boolean;
  providerOverride?: EmailProvider;
  now?: Date;
}): Promise<Result<CompletedInteractionDispatch>> {
  if (!db) return err("no_database", "Notification dispatch requires DATABASE_URL.");
  const protectedCall = await db.call.findFirst({ where: { id: params.callId, account_id: params.accountId } });
  if (protectedCall?.review_required) return err("approval_required", "Use the approved call review dispatch.");
  const now = params.now ?? new Date();
  const dedupeKey = `${NOTIFICATION_EVENT}:${params.accountId}:${params.callId}`;

  try {
    const existing = await db.notification.findUnique({ where: { dedupe_key: dedupeKey } });
    if (existing?.status === "sent") {
      return ok({ status: "skipped", notificationId: existing.id, reason: "already_sent" });
    }

    const provider = params.providerOverride ?? getEmailProvider();

    if (existing) {
      return ok(
        await sendNotificationRow({
          notificationId: existing.id,
          recipient: existing.recipient,
          subject: existing.subject ?? "",
          message: existing.message,
          dedupeKey,
          provider,
          requireLiveProvider: params.requireLiveProvider === true || existing.provider === "resend" || existing.last_error_code === "live_provider_disabled",
          attemptCount: existing.attempt_count,
          now,
        }),
      );
    }

    const snapshot = await db.businessMemorySnapshot.findFirst({
      where: { account_id: params.accountId, bootstrap_id: null, status: "approved" },
      orderBy: { version: "desc" },
    });
    const parsedMemory = snapshot ? BusinessMemorySnapshotSchema.safeParse(snapshot.memory_json) : null;
    const configured = parsedMemory?.success
      ? readOperatingConfigurationValue(parsedMemory.data, "notification.completed_interaction.recipient")
      : null;
    if (!configured || !configured.enabled) {
      return ok({ status: "skipped", notificationId: null, reason: "recipient_not_configured" });
    }

    const [account, call] = await Promise.all([
      db.account.findUnique({ where: { id: params.accountId } }),
      db.call.findFirst({ where: { id: params.callId, account_id: params.accountId } }),
    ]);
    if (!account || !call) return err("not_found", "The call was not found for this account.");

    const contact = call.contact_id
      ? await db.contact.findFirst({ where: { id: call.contact_id, account_id: params.accountId } })
      : null;
    const lead = await db.leadEvent.findFirst({
      where: { account_id: params.accountId, call_id: call.id },
      orderBy: { created_at: "asc" },
    });
    const [qualification, quote, crm] = await Promise.all([
      lead ? db.leadQualification.findUnique({ where: { lead_event_id: lead.id } }) : null,
      lead ? db.quoteRequest.findUnique({ where: { lead_event_id: lead.id } }) : null,
      db.crmSyncOperation.findUnique({ where: { operation_key: `crm-call:${params.accountId}:${call.id}` } }),
    ]);

    const built = buildCompletedInteractionMessage({
      businessName: account.name,
      eventTypeLabel: EVENT_TYPE_LABELS[call.interaction_class ?? "unknown"] ?? "Call",
      caller: callerName(contact),
      callerPhone: contact?.phone ?? call.from_number,
      relationship: call.caller_relationship ?? "Not captured",
      service: quote?.service_type ?? qualification?.service_needed ?? "Not captured",
      location: [contact?.city, contact?.state, contact?.zip].filter(Boolean).join(", ") || "Not captured",
      summary: sanitizeCrmText(call.summary),
      qualification: qualification?.qualification_status ?? "not_scored",
      quoteRequested: Boolean(quote),
      photosRequested: quote?.photos_requested === true,
      nextAction: lead?.notes ? sanitizeCrmText(lead.notes) : "None recorded",
      crmStatus: crm?.status ?? "not_attempted",
      callReference: call.id,
      receivedAt: (call.started_at ?? now).toISOString(),
    });

    const created = await db.notification.create({
      data: {
        account_id: params.accountId,
        lead_event_id: lead?.id ?? null,
        call_id: call.id,
        event: NOTIFICATION_EVENT,
        dedupe_key: dedupeKey,
        channel: "email",
        recipient: configured.recipient,
        subject: built.subject,
        message: built.text,
        status: "queued",
      },
    });

    return ok(
      await sendNotificationRow({
        notificationId: created.id,
        recipient: configured.recipient,
        subject: built.subject,
        message: built.text,
        dedupeKey,
        provider,
        requireLiveProvider: params.requireLiveProvider === true,
        attemptCount: 0,
        now,
      }),
    );
  } catch (error) {
    return errFromThrown(error);
  }
}

/** Operator replay of a failed notification. Sent rows are never re-sent. */
export async function retryCompletedInteractionNotification(params: {
  id: string;
  providerOverride?: EmailProvider;
  now?: Date;
}): Promise<Result<CompletedInteractionDispatch>> {
  try {
    await requireRole(["aj_admin", "operator"]);
  } catch (error) {
    return errFromThrown(error);
  }
  if (!db) return err("no_database", "Notification retry requires DATABASE_URL.");

  const notification = await db.notification.findUnique({ where: { id: params.id } });
  if (!notification) return err("not_found", "Notification not found.");
  if (notification.status !== "failed") {
    return err("invalid_transition", "Only a failed notification can be retried.");
  }
  if (!notification.call_id) {
    return err("invalid_transition", "Only a call notification can be retried.");
  }

  return dispatchCompletedInteractionNotification({
    accountId: notification.account_id,
    callId: notification.call_id,
    requireLiveProvider: notification.provider === "resend" || notification.last_error_code === "live_provider_disabled",
    providerOverride: params.providerOverride,
    now: params.now,
  });
}
