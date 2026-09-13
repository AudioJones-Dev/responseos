import "@/lib/serverOnlyGuard";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { getCurrentSession } from "@/lib/auth/session";
import { isCrossTenantRole } from "@/lib/data/session-helpers";
import { contentHash } from "@/lib/prospectBootstrap/memory";
import { extractTelnyxCallInsight } from "@/lib/providers/telnyx/insights";
import { BusinessMemorySnapshotSchema } from "@/lib/prospectBootstrap/contracts";
import { readOperatingConfigurationValue } from "@/lib/agentExecution/operatingConfiguration";
import { runCrmSyncForCall } from "@/lib/crm/syncFinalizedCall";
import { getEmailProvider } from "@/lib/providers/email";
import { FRL_INTERACTIONS, FRL_OUTCOMES, ReviewPayloadSchema, reviewMessage, type ReviewPayload } from "./contracts";

export async function requireReviewOperator() {
  const session = await getCurrentSession();
  if (!session || !isCrossTenantRole(session)) throw new Error("operator_required");
  return session;
}

export async function queueCallReview(accountId: string, callId: string, payload: Record<string, unknown>) {
  if (!db) throw new Error("database_unavailable");
  const call = await db.call.findFirst({ where: { id: callId, account_id: accountId } });
  if (!call?.provider_call_id || !call.review_required) throw new Error("review_call_missing");
  if (call.status !== "completed") return null;
  const capture = await db.callCaptureSession.findUnique({ where: { account_id_provider_call_id: { account_id: accountId, provider_call_id: call.provider_call_id } } });
  if (!capture) throw new Error("call_snapshot_missing");
  const memory = BusinessMemorySnapshotSchema.parse(capture.snapshot_json);
  const recipient = readOperatingConfigurationValue(memory, "notification.completed_interaction.recipient");
  const insight = extractTelnyxCallInsight(payload);
  const qualification = insight.qualification?.status;
  const draft = {
    caller: [insight.firstName, insight.lastName].filter(Boolean).join(" ") || "Unknown caller",
    phone: call.from_number,
    interaction: FRL_INTERACTIONS.includes(insight.canonicalInteraction as never) ? insight.canonicalInteraction : ({ new_sales: "new_sales", existing_customer_new_sale: "existing_customer_new_sale", new_service_request: "new_service", existing_service_request: "existing_service" } as Record<string, string>)[insight.interactionClass ?? ""] ?? "administrative",
    product: ["vpl", "vehicle_lift", "ceiling_lift", "ramp"].includes(insight.product ?? "") ? insight.product : "unknown", location: [insight.city, insight.state, insight.postalCode].filter(Boolean).join(", "),
    summary: insight.summary || "Analysis unavailable — review the transcript.",
    qualification: ["qualified", "unqualified", "spam"].includes(String(qualification)) ? qualification : "maybe",
    outcome: FRL_OUTCOMES.includes(insight.outcome as never) ? insight.outcome : "HUMAN_REVIEW_REQUIRED", urgency: ["low", "medium", "high"].includes(insight.urgency ?? "") ? insight.urgency : "medium", callbackWindow: insight.callbackWindow ?? "",
    nextAction: insight.nextAction || "Review and arrange an appropriate callback.",
    flags: ["Confirm interaction, product, outcome and callback details against the transcript.", ...(!insight.summary ? ["Extraction missing or failed."] : [])],
  };
  const hash = contentHash({ payload, transcript: call.transcript, snapshot: capture.snapshot_id });
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${accountId + ":" + callId}))`;
    const latest = await tx.callReview.findFirst({ where: { account_id: accountId, call_id: callId }, orderBy: { revision: "desc" } });
    if (latest?.source_hash === hash) return latest;
    return tx.callReview.create({ data: { account_id: accountId, call_id: callId, revision: (latest?.revision ?? 0) + 1, source_hash: hash, evidence_json: { transcript: call.transcript, summary: call.summary, snapshotId: capture.snapshot_id }, payload_json: draft as Prisma.InputJsonValue, recipient: recipient?.enabled ? recipient.recipient : "" } });
  });
}

export async function decideCallReview(id: string, revision: number, action: "approve" | "reject", payload?: ReviewPayload) {
  const operator = await requireReviewOperator();
  if (!db) throw new Error("database_unavailable");
  return db.$transaction(async (tx) => {
    const row = await tx.callReview.findUnique({ where: { id } });
    if (!row) throw new Error("not_found");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${row.account_id + ":" + row.call_id}))`;
    const latest = await tx.callReview.findFirst({ where: { account_id: row.account_id, call_id: row.call_id }, orderBy: { revision: "desc" } });
    if (row.revision !== revision || latest?.id !== row.id || row.status !== "pending") throw new Error("stale_review");
    const call = await tx.call.findFirst({ where: { id: row.call_id, account_id: row.account_id } });
    const evidence = row.evidence_json as { transcript?: string; summary?: string };
    if (action === "approve" && (evidence.transcript !== call?.transcript || evidence.summary !== call?.summary)) throw new Error("stale_review");
    if (action === "approve" && !call?.transcript) throw new Error("consented_transcript_required");
    if (action === "approve" && !row.recipient) throw new Error("recipient_not_configured");
    const data = action === "approve" ? ReviewPayloadSchema.parse(payload) : undefined;
    const updated = await tx.callReview.updateMany({ where: { id, account_id: row.account_id, status: "pending" }, data: { status: action === "approve" ? "approved" : "rejected", reviewer_user_id: operator.user.id, reviewed_at: new Date(), ...(data ? { payload_json: data } : {}) } });
    if (!updated.count) throw new Error("stale_review");
    await tx.auditLog.create({ data: { account_id: row.account_id, actor_type: "user", actor_user_id: operator.user.id, actor_role: operator.user.role, action: `call_review_${action}`, category: "workflow", target_type: "CallReview", target_id: id, metadata_json: { revision } } });
    return { id, revision, status: action === "approve" ? "approved" : "rejected" };
  });
}

export async function dispatchCallReview(id: string) {
  await requireReviewOperator();
  if (!db) throw new Error("database_unavailable");
  const row = await db.callReview.findUnique({ where: { id } });
  if (!row || row.status !== "approved") throw new Error("approval_required");
  const latest = await db.callReview.findFirst({ where: { account_id: row.account_id, call_id: row.call_id }, orderBy: { revision: "desc" } });
  if (latest?.id !== id) throw new Error("stale_review");
  const prior = await db.callReview.findFirst({ where: { account_id: row.account_id, call_id: row.call_id, id: { not: id }, OR: [{ dispatch_at: { not: null } }, { email_attempt_at: { not: null } }, { crm_status: { not: "pending" } }] } });
  if (prior) throw new Error("prior_revision_requires_reconciliation");
  if (row.dispatch_at) throw new Error("dispatch_in_progress_or_uncertain");
  const claim = await db.callReview.updateMany({ where: { id, account_id: row.account_id, status: "approved", dispatch_at: null }, data: { dispatch_at: new Date() } });
  if (!claim.count) throw new Error("dispatch_in_progress_or_uncertain");
  const value = ReviewPayloadSchema.parse(row.payload_json);
  try {
    const crm = await runCrmSyncForCall({ accountId: row.account_id, callId: row.call_id, requireLiveProvider: true, reviewId: id });
    await db.callReview.update({ where: { id, account_id: row.account_id }, data: { crm_status: crm.ok ? crm.data.status : "failed" } });
    if (row.email_status === "accepted") return { status: "already_accepted" };
    if (row.email_attempt_at && Date.now() - row.email_attempt_at.getTime() >= 23 * 60 * 60 * 1000) throw new Error("email_delivery_requires_reconciliation");
    const provider = getEmailProvider();
    if (provider.providerId !== "resend") throw new Error("live_email_disabled");
    await db.callReview.update({ where: { id, account_id: row.account_id }, data: { email_attempt_at: row.email_attempt_at ?? new Date(), email_status: "sending" } });
    const message = reviewMessage(value, row.call_id);
    const sent = await provider.send({ to: row.recipient, ...message, idempotencyKey: `review:${id}` });
    await db.callReview.update({ where: { id, account_id: row.account_id }, data: { email_status: "accepted", email_message_id: sent.providerMessageId } });
    return { status: "accepted" };
  } catch (error) {
    await db.callReview.update({ where: { id, account_id: row.account_id }, data: { email_status: row.email_status === "accepted" ? "accepted" : "failed" } });
    throw error;
  } finally {
    await db.callReview.update({ where: { id, account_id: row.account_id }, data: { dispatch_at: null } });
  }
}
