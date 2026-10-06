import "@/lib/serverOnlyGuard";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { err, errFromThrown, ok, type Result } from "@/lib/data/result";
import { getCrmProvider, type CrmProvider } from "@/lib/providers/crm";
import { normalizeE164 } from "@/lib/validation/common";
import { sanitizeCrmText } from "@/lib/crm/sanitization";
import { isFrlHandoffEnabled, resolveQualifiedHandoffPolicy } from "@/lib/crm/qualifiedHandoffPolicy";
import { runCrmSyncForCall, type CrmSyncOperationView } from "@/lib/crm/syncFinalizedCall";

type HandoffRow = NonNullable<Awaited<ReturnType<NonNullable<typeof db>["qualifiedCallHandoff"]["findFirst"]>>>;

export interface QualifiedCallHandoffView {
  id: string;
  accountId: string;
  callId: string;
  status: string;
  provider: string;
  taskId: string | null;
  notificationId: string | null;
  deliveryStatus: "not_verified";
  attemptCount: number;
  errorCode: string | null;
}

function toView(row: HandoffRow): QualifiedCallHandoffView {
  return {
    id: row.id, accountId: row.account_id, callId: row.call_id, status: row.status,
    provider: row.provider, taskId: row.provider_task_id, notificationId: row.notification_id,
    deliveryStatus: "not_verified", attemptCount: row.attempt_count, errorCode: row.last_error_code,
  };
}

function safeText(value: string | null | undefined): string {
  return value ? sanitizeCrmText(value).replace(/[<>]/g, "").slice(0, 500) : "Not captured";
}

export async function runQualifiedCallHandoff(params: {
  accountId: string;
  callId: string;
  providerOverride?: CrmProvider;
}): Promise<Result<QualifiedCallHandoffView | null>> {
  if (!isFrlHandoffEnabled(params.accountId)) return ok(null);
  if (!db) return err("no_database", "Qualified handoff requires a database connection.");
  const provider = params.providerOverride ?? getCrmProvider();
  let operation: HandoffRow | null = null;
  let claimed = false;
  try {
    const call = await db.call.findFirst({ where: { id: params.callId, account_id: params.accountId } });
    if (!call || call.status !== "completed" || call.direction !== "inbound") return ok(null);
    const lead = await db.leadEvent.findFirst({
      where: { account_id: params.accountId, call_id: call.id }, orderBy: { created_at: "asc" },
    });
    const qualification = lead
      ? await db.leadQualification.findUnique({ where: { lead_event_id: lead.id } }) : null;
    if (!lead || qualification?.qualification_status !== "qualified") return ok(null);
    const crm = await db.crmSyncOperation.findFirst({
      where: { account_id: params.accountId, call_id: call.id, status: "succeeded" },
    });
    if (!crm?.provider_contact_id || !crm.provider_activity_id) {
      return err("crm_capture_pending", "CRM contact and call activity must be persisted before handoff.");
    }
    operation = await db.qualifiedCallHandoff.upsert({
      where: { operation_key: `qualified-call:${params.accountId}:${call.id}`, account_id: params.accountId },
      create: {
        account_id: params.accountId, call_id: call.id, lead_event_id: lead.id,
        operation_key: `qualified-call:${params.accountId}:${call.id}`, provider: crm.provider,
      }, update: {},
    });
    if (!["pending", "retryable_failed", "review_required"].includes(operation.status)) return ok(toView(operation));
    const claim = await db.qualifiedCallHandoff.updateMany({
      where: { id: operation.id, account_id: params.accountId, status: { in: ["pending", "retryable_failed", "review_required"] } },
      data: { status: "processing", attempt_count: { increment: 1 }, last_error_code: null },
    });
    if (!claim.count) {
      const current = await db.qualifiedCallHandoff.findFirstOrThrow({ where: { id: operation.id, account_id: params.accountId } });
      return ok(toView(current));
    }
    claimed = true;
    operation = await db.qualifiedCallHandoff.findFirstOrThrow({ where: { id: operation.id, account_id: params.accountId } });
    const policy = await resolveQualifiedHandoffPolicy(params.accountId);
    let reviewCode: string | null = null;
    if (!policy) reviewCode = "approved_handoff_configuration_required";
    else if (provider.providerId !== crm.provider || operation.provider !== crm.provider) reviewCode = "crm_provider_mismatch";
    else if (operation.config_hash && (operation.config_hash !== policy.configHash || operation.config_snapshot_id !== policy.snapshotId)) {
      reviewCode = "handoff_configuration_changed";
    }
    const contact = call.contact_id ? await db.contact.findFirst({
      where: { id: call.contact_id, account_id: params.accountId },
    }) : null;
    const phone = normalizeE164(contact?.phone ?? call.from_number);
    if (!phone) reviewCode = "callback_number_required";
    if (reviewCode || !policy || !phone) {
      operation = await db.qualifiedCallHandoff.update({
        where: { id: operation.id, account_id: params.accountId },
        data: { status: "review_required", last_error_code: reviewCode },
      });
      return ok(toView(operation));
    }
    operation = await db.qualifiedCallHandoff.update({
      where: { id: operation.id, account_id: params.accountId },
      data: { config_snapshot_id: policy.snapshotId, config_hash: policy.configHash },
    });
    const nextAction = lead.notes ? safeText(lead.notes) : "Review and contact the qualified caller.";
    const summary = sanitizeCrmText(call.summary);
    const evidenceReference = `ResponseOS qualified handoff ${call.id}`;
    if (!operation.provider_task_id) {
      const found = await provider.findFollowUpTask(evidenceReference);
      if (found && provider.providerId === "hubspot" && found.ownerId !== policy.policy.crmOwnerId) {
        throw new Error("handoff_owner_mismatch");
      }
      const task = found ?? await provider.createFollowUpTask({
        contactId: crm.provider_contact_id, ownerId: policy.policy.crmOwnerId,
        // This is the handoff queue's due time, not a promised human callback SLA.
        dueAt: operation.created_at.toISOString(), sanitizedSummary: summary, nextAction, evidenceReference,
      });
      operation = await db.qualifiedCallHandoff.update({
        where: { id: operation.id, account_id: params.accountId }, data: { provider_task_id: task.providerTaskId },
      });
    }
    if (provider.providerId === "hubspot") {
      const owner = await provider.getFollowUpTaskOwner?.(operation.provider_task_id!);
      if (owner !== policy.policy.crmOwnerId) throw new Error("handoff_owner_mismatch");
    }
    await provider.associateContact("tasks", operation.provider_task_id!, crm.provider_contact_id);
    const name = [contact?.first_name, contact?.last_name].filter(Boolean).map(safeText).join(" ") || "Not captured";
    const crmReference = provider.providerId === "hubspot"
      ? `${policy.policy.crmContactBaseUrl}${encodeURIComponent(crm.provider_contact_id)}`
      : `Mock CRM contact: ${crm.provider_contact_id}`;
    const email = contact?.email_verified ? z.email().safeParse(contact.email) : null;
    const message = [
      "Qualified inbound caller — human follow-up required.",
      `Caller: ${name}`, `Callback: ${phone}`,
      email?.success ? `Verified email: ${email.data}` : "Email: Not verified/captured",
      `Service: ${safeText(qualification.service_needed)}`,
      `Location: ${safeText(contact?.city)}`, `Service area confirmed: ${qualification.service_area_match ? "Yes" : "Not confirmed"}`,
      `Requested timeframe: ${qualification.timeline}`, `Property: ${safeText(qualification.property_type)}`,
      "Qualification: retained qualified classification; no inferred score threshold.",
      `Summary: ${summary}`, `Next action: ${nextAction}`,
      `CRM: ${crmReference}`, `Call activity: ${crm.provider_activity_id}`, `Owned task: ${operation.provider_task_id}`,
      `ResponseOS call: ${call.id}`, "Human callback SLA: not configured by this handoff.",
      `Source: ${lead.source}`, `Call started: ${call.started_at.toISOString()}`,
    ].join("\n");
    // Queue and handoff state commit together. No email/SMS provider is called here.
    const queued = await db.$transaction(async (tx) => {
      const notification = await tx.notification.upsert({
        where: { dedupe_key: operation!.operation_key, account_id: params.accountId },
        create: {
          account_id: params.accountId, lead_event_id: lead.id, dedupe_key: operation!.operation_key,
          channel: policy.policy.notification.channel, recipient: policy.policy.notification.recipient,
          subject: "Qualified FRL caller — follow-up required", message,
        }, update: {},
      });
      return tx.qualifiedCallHandoff.update({
        where: { id: operation!.id, account_id: params.accountId },
        data: { status: "queued", notification_id: notification.id, queued_at: new Date() },
      });
    });
    return ok(toView(queued));
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    const review = ["handoff_owner_mismatch", "ambiguous_activity_match"].includes(raw);
    const code = review ? raw : /^hubspot_http_\d{3}$/.test(raw) ? raw : "qualified_handoff_failed";
    if (!claimed || !operation) return err(code, code);
    const failed = await db.qualifiedCallHandoff.update({
      where: { id: operation.id, account_id: params.accountId },
      data: { status: review ? "review_required" : "retryable_failed", last_error_code: code },
    }).catch(() => null);
    return failed ? ok(toView(failed)) : err(code, code);
  }
}

export async function syncFinalizedCallAndPrepareHandoff(params: {
  accountId: string; callId: string; sourceWebhookId?: string; providerOverride?: CrmProvider;
}): Promise<Result<{ crm: CrmSyncOperationView; handoff: QualifiedCallHandoffView | null }>> {
  const crm = await runCrmSyncForCall(params);
  if (!crm.ok) return crm;
  if (crm.data.status !== "succeeded") return ok({ crm: crm.data, handoff: null });
  const handoff = await runQualifiedCallHandoff(params);
  return handoff.ok ? ok({ crm: crm.data, handoff: handoff.data }) : handoff;
}

export async function listQualifiedCallHandoffs(accountId: string): Promise<Result<QualifiedCallHandoffView[]>> {
  try {
    await requireRole(["aj_admin", "operator"]);
    if (!db) return ok([]);
    const rows = await db.qualifiedCallHandoff.findMany({
      where: { account_id: accountId }, orderBy: { updated_at: "desc" }, take: 100,
    });
    return ok(rows.map(toView));
  } catch (error) { return errFromThrown(error); }
}

export async function retryQualifiedCallHandoff(callId: string) {
  try { await requireRole(["aj_admin", "operator"]); }
  catch (error) { return errFromThrown(error); }
  const accountId = process.env.RESPONSEOS_FRL_HANDOFF_ACCOUNT_ID;
  if (!accountId || !isFrlHandoffEnabled(accountId)) return err("handoff_disabled", "Qualified handoff is disabled.");
  return syncFinalizedCallAndPrepareHandoff({ accountId, callId });
}
