import "@/lib/serverOnlyGuard";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { isAuthRequired } from "@/lib/auth/auth-required";
import { err, errFromThrown, ok, type Result } from "@/lib/data/result";
import { isFrlHandoffEnabled, resolveQualifiedHandoffPolicy } from "@/lib/crm/qualifiedHandoffPolicy";
import { getCrmProvider, type CrmProvider } from "@/lib/providers/crm";
import { getQualifiedEmailProvider } from "@/lib/providers/resend";
import { EmailProviderError, RESPONSEOS_NOTIFICATION_SENDER, type QualifiedEmailProvider, type QualifiedEmailRequest } from "@/lib/providers/resend/types";

type DeliveryRow = NonNullable<Awaited<ReturnType<NonNullable<typeof db>["qualifiedNotificationDelivery"]["findFirst"]>>>;
const LEASE_MS = 120_000;
// Resend keeps keys for 24 hours. Stop earlier rather than risk a second send.
const RETRY_WINDOW_MS = 23 * 60 * 60 * 1_000;
const deliveryFailures = new Set(["bounced", "failed", "canceled", "suppressed", "complained"]);

function enabled(accountId: string) {
  return isFrlHandoffEnabled(accountId) && process.env.RESPONSEOS_FRL_NOTIFICATION_DELIVERY_ENABLED === "true";
}

function hostedAuthReady() {
  return !(process.env.NODE_ENV === "production" || process.env.VERCEL) || isAuthRequired();
}

function toView(row: DeliveryRow) {
  return {
    id: row.id, callId: row.call_id, handoffId: row.handoff_id, notificationId: row.notification_id,
    status: row.status, provider: row.provider, providerMessageId: row.provider_message_id,
    providerTaskId: row.provider_task_id, ownerVerifiedAt: row.owner_verified_at?.toISOString() ?? null,
    providerLastEvent: row.provider_last_event, attemptCount: row.attempt_count,
    firstAttemptAt: row.first_attempt_at?.toISOString() ?? null,
    acceptedAt: row.accepted_at?.toISOString() ?? null,
    deliveryObservedAt: row.delivery_observed_at?.toISOString() ?? null,
    lastCheckedAt: row.last_checked_at?.toISOString() ?? null, errorCode: row.last_error_code,
  };
}

export type QualifiedDeliveryView = ReturnType<typeof toView>;

function operatorError(error: unknown) {
  const result = errFromThrown(error);
  return !result.ok && ["no_session", "role_denied", "tenant_scope_denied"].includes(result.error.code)
    ? result : err("qualified_delivery_operation_failed", "Qualified notification operation failed.");
}

export async function deliverQualifiedCallNotification(params: {
  accountId: string; callId: string;
  emailProviderOverride?: QualifiedEmailProvider; crmProviderOverride?: CrmProvider;
}): Promise<Result<QualifiedDeliveryView | null>> {
  if (!enabled(params.accountId)) return ok(null);
  if (!hostedAuthReady()) return err("hosted_auth_required", "Hosted qualified delivery requires enforced authentication.");
  if (!db) return err("no_database", "Qualified delivery requires a database connection.");
  const email = params.emailProviderOverride ?? getQualifiedEmailProvider();
  if (email.providerId !== "resend") return err("live_email_transport_unavailable", "Approved email transport is not configured; no queued message was consumed.");
  const crm = params.crmProviderOverride ?? getCrmProvider();
  let row: DeliveryRow | null = null;
  let token: string | null = null;
  try {
    const handoff = await db.qualifiedCallHandoff.findFirst({ where: {
      account_id: params.accountId, call_id: params.callId, status: "queued",
    } });
    if (!handoff?.notification_id || !handoff.provider_task_id) return ok(null);
    const notification = await db.notification.findFirst({ where: {
      id: handoff.notification_id, account_id: params.accountId,
      lead_event_id: handoff.lead_event_id, dedupe_key: handoff.operation_key,
    } });
    if (!notification) return err("qualified_outbox_reference_invalid", "Qualified outbox reference requires review.");
    row = await db.qualifiedNotificationDelivery.upsert({
      where: { handoff_id: handoff.id, account_id: params.accountId },
      create: { account_id: params.accountId, call_id: params.callId, handoff_id: handoff.id, notification_id: notification.id }, update: {},
    });
    const read = () => db!.qualifiedNotificationDelivery.findFirstOrThrow({ where: { id: row!.id, account_id: params.accountId } });
    const review = async (code: string) => {
      await db!.qualifiedNotificationDelivery.updateMany({
        where: { id: row!.id, account_id: params.accountId, OR: [
          { status: { not: "processing" } }, { lease_expires_at: { lte: new Date() } },
        ] }, data: { status: "review_required", last_error_code: code, claim_token: null, lease_expires_at: null },
      });
      return ok(toView(await read()));
    };
    if (row.notification_id !== notification.id || row.call_id !== params.callId) return review("delivery_reference_changed");
    if (row.status === "failed" || row.status === "delivered") return ok(toView(row));
    const policy = await resolveQualifiedHandoffPolicy(params.accountId);
    if (!policy || policy.configHash !== handoff.config_hash || policy.snapshotId !== handoff.config_snapshot_id) {
      return review("approved_delivery_configuration_required");
    }
    if (policy.policy.notification.channel !== "email" || notification.channel !== "email"
      || policy.policy.notification.recipient !== notification.recipient) return review("approved_email_recipient_required");
    const call = await db.call.findFirst({ where: { id: params.callId, account_id: params.accountId, status: "completed", direction: "inbound" } });
    const lead = await db.leadEvent.findFirst({ where: { id: handoff.lead_event_id, account_id: params.accountId, call_id: params.callId } });
    const qualification = lead ? await db.leadQualification.findUnique({ where: { lead_event_id: lead.id } }) : null;
    if (!call || !lead || qualification?.qualification_status !== "qualified") return review("qualification_no_longer_eligible");
    const capture = await db.crmSyncOperation.findFirst({ where: { account_id: params.accountId, call_id: params.callId, status: "succeeded" } });
    if (handoff.provider !== "hubspot" || crm.providerId !== "hubspot" || capture?.provider !== "hubspot"
      || !capture.provider_contact_id || !capture.provider_activity_id) return review("verified_live_crm_capture_required");
    const request: QualifiedEmailRequest = {
      recipient: notification.recipient, subject: notification.subject ?? "Qualified FRL caller — follow-up required",
      text: notification.message, idempotencyKey: `frl-qualified-${createHash("sha256").update(handoff.operation_key).digest("hex")}`,
    };
    const payloadHash = createHash("sha256").update(JSON.stringify({ from: RESPONSEOS_NOTIFICATION_SENDER, ...request })).digest("hex");
    if (row.payload_hash && row.payload_hash !== payloadHash) return review("delivery_payload_changed");
    if (row.provider_task_id && (row.provider_task_id !== handoff.provider_task_id || row.verified_owner_id !== policy.policy.crmOwnerId)) {
      return review("delivery_task_identity_changed");
    }
    if (!row.provider_message_id && row.first_attempt_at && Date.now() - row.first_attempt_at.getTime() >= RETRY_WINDOW_MS) {
      return review("provider_reconciliation_required");
    }
    if (!row.provider_message_id && notification.status !== "queued") return review("outbox_not_unsent");
    token = randomUUID();
    const now = new Date();
    const claimed = await db.qualifiedNotificationDelivery.updateMany({
      where: { id: row.id, account_id: params.accountId, payload_hash: row.payload_hash,
        provider_message_id: row.provider_message_id, first_attempt_at: row.first_attempt_at, OR: [
        { status: { in: ["pending", "retryable_failed", "review_required", "accepted"] } },
        { status: "processing", lease_expires_at: { lte: now } },
      ] },
      data: { status: "processing", claim_token: token, lease_expires_at: new Date(now.getTime() + LEASE_MS),
        payload_hash: payloadHash, last_error_code: null },
    });
    if (!claimed.count) { token = null; return ok(toView(await read())); }
    row = await read();
    const owner = await crm.getFollowUpTaskOwner?.(handoff.provider_task_id);
    if (owner !== policy.policy.crmOwnerId) throw new EmailProviderError("delivery_owner_mismatch", false);
    const currentPolicy = await resolveQualifiedHandoffPolicy(params.accountId);
    const currentQualification = await db.leadQualification.findUnique({ where: { lead_event_id: lead.id } });
    const currentNotification = await db.notification.findFirst({ where: { id: notification.id, account_id: params.accountId } });
    const currentCall = await db.call.findFirst({ where: { id: params.callId, account_id: params.accountId, status: "completed", direction: "inbound" } });
    const currentLead = await db.leadEvent.findFirst({ where: { id: lead.id, account_id: params.accountId, call_id: params.callId } });
    const currentHandoff = await db.qualifiedCallHandoff.findFirst({ where: { id: handoff.id, account_id: params.accountId, status: "queued" } });
    if (!enabled(params.accountId) || !hostedAuthReady() || currentPolicy?.configHash !== policy.configHash || currentPolicy.snapshotId !== policy.snapshotId
      || currentQualification?.qualification_status !== "qualified" || currentNotification?.message !== request.text
      || currentNotification.recipient !== request.recipient || currentNotification.subject !== notification.subject
      || currentNotification.channel !== "email" || currentNotification.dedupe_key !== handoff.operation_key
      || currentNotification.lead_event_id !== lead.id || !currentCall || !currentLead
      || currentHandoff?.provider_task_id !== handoff.provider_task_id || currentHandoff.notification_id !== notification.id
      || currentHandoff.config_hash !== policy.configHash
      || (!params.emailProviderOverride && getQualifiedEmailProvider().providerId !== "resend")) {
      throw new EmailProviderError("delivery_authority_changed", false);
    }
    let receipt;
    if (row.provider_message_id) {
      receipt = await email.inspect(row.provider_message_id, request);
    } else {
      if (row.first_attempt_at && Date.now() - row.first_attempt_at.getTime() >= RETRY_WINDOW_MS) {
        throw new EmailProviderError("provider_reconciliation_required", false);
      }
      const sendClaim = await db.qualifiedNotificationDelivery.updateMany({
        where: { id: row.id, account_id: params.accountId, claim_token: token, status: "processing" },
        data: { attempt_count: { increment: 1 }, first_attempt_at: row.first_attempt_at ?? new Date(),
          provider_task_id: handoff.provider_task_id, verified_owner_id: owner, owner_verified_at: new Date() },
      });
      if (!sendClaim.count) { token = null; return ok(toView(await read())); }
      receipt = await email.send(request);
    }
    const observed = new Date();
    const failed = deliveryFailures.has(receipt.event);
    await db.$transaction(async (tx) => {
      const saved = await tx.qualifiedNotificationDelivery.updateMany({
        where: { id: row!.id, account_id: params.accountId, claim_token: token, status: "processing" },
        data: { status: failed ? "failed" : receipt.event === "delivered" ? "delivered" : "accepted",
          provider_message_id: receipt.messageId, provider_last_event: receipt.event,
          accepted_at: row!.accepted_at ?? observed, last_checked_at: observed,
          delivery_observed_at: receipt.event === "delivered" ? observed : row!.delivery_observed_at,
          last_error_code: failed ? `resend_${receipt.event}` : null, claim_token: null, lease_expires_at: null },
      });
      if (saved.count) await tx.notification.updateMany({
        where: { id: notification.id, account_id: params.accountId, dedupe_key: handoff.operation_key },
        data: { status: failed ? "failed" : "sent", sent_at: notification.sent_at ?? observed },
      });
    });
    return ok(toView(await read()));
  } catch (error) {
    const code = error instanceof EmailProviderError ? error.code : "qualified_delivery_unknown";
    if (!row || !token) return err(code, code);
    const retryable = !(error instanceof EmailProviderError) || error.retryable;
    await db.qualifiedNotificationDelivery.updateMany({
      where: { id: row.id, account_id: params.accountId, claim_token: token, status: "processing" },
      data: { status: retryable ? "retryable_failed" : "review_required", last_error_code: code, claim_token: null, lease_expires_at: null },
    }).catch(() => null);
    const current = await db.qualifiedNotificationDelivery.findFirst({ where: { id: row.id, account_id: params.accountId } }).catch(() => null);
    return current ? ok(toView(current)) : err(code, code);
  }
}

export async function listQualifiedNotificationDeliveries(): Promise<Result<QualifiedDeliveryView[]>> {
  try {
    await requireRole(["aj_admin", "operator"]);
    if (!hostedAuthReady()) return err("hosted_auth_required", "Hosted qualified delivery requires enforced authentication.");
    const accountId = process.env.RESPONSEOS_FRL_HANDOFF_ACCOUNT_ID;
    if (!accountId || !db) return ok([]);
    const rows = await db.qualifiedNotificationDelivery.findMany({ where: { account_id: accountId }, orderBy: { updated_at: "desc" }, take: 100 });
    return ok(rows.map(toView));
  } catch (error) { return operatorError(error); }
}

export async function retryQualifiedNotificationDelivery(callId: string) {
  try {
    await requireRole(["aj_admin", "operator"]);
    const accountId = process.env.RESPONSEOS_FRL_HANDOFF_ACCOUNT_ID;
    if (!accountId || !enabled(accountId)) return err("qualified_delivery_disabled", "Qualified notification delivery is disabled.");
    return await deliverQualifiedCallNotification({ accountId, callId });
  } catch (error) { return operatorError(error); }
}

export async function dispatchQualifiedNotificationDeliveries() {
  try {
    await requireRole(["aj_admin", "operator"]);
    if (!hostedAuthReady()) return err("hosted_auth_required", "Hosted qualified delivery requires enforced authentication.");
    const accountId = process.env.RESPONSEOS_FRL_HANDOFF_ACCOUNT_ID;
    if (!accountId || !enabled(accountId)) return err("qualified_delivery_disabled", "Qualified notification delivery is disabled.");
    if (!db) return err("no_database", "Qualified delivery requires a database connection.");
    const existing = await db.qualifiedNotificationDelivery.findMany({ where: { account_id: accountId }, select: { handoff_id: true } });
    const fresh = await db.qualifiedCallHandoff.findMany({ where: {
      account_id: accountId, status: "queued", id: { notIn: existing.map((delivery) => delivery.handoff_id) },
    }, orderBy: { created_at: "asc" }, take: 10 });
    const retry = await db.qualifiedNotificationDelivery.findMany({ where: {
      account_id: accountId, OR: [
        { status: { in: ["pending", "retryable_failed", "accepted"] } },
        { status: "processing", lease_expires_at: { lte: new Date() } },
      ],
    }, orderBy: { updated_at: "asc" }, take: 10 });
    const handoffs = [...fresh, ...retry];
    const results = [];
    for (const handoff of handoffs) results.push(await deliverQualifiedCallNotification({ accountId, callId: handoff.call_id }));
    return ok({ results });
  } catch (error) { return operatorError(error); }
}
