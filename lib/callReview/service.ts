import "@/lib/serverOnlyGuard";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { getCurrentSession } from "@/lib/auth/session";
import { isCrossTenantRole } from "@/lib/data/session-helpers";
import { contentHash } from "@/lib/prospectBootstrap/memory";
import { extractTelnyxCallInsight } from "@/lib/providers/telnyx/insights";
import { BusinessMemorySnapshotSchema } from "@/lib/prospectBootstrap/contracts";
import { readOperatingConfigurationValue } from "@/lib/agentExecution/operatingConfiguration";
import { supervisedExecutionAuthorized } from "@/lib/agentExecution/supervisedRuntime";
import { runCrmSyncForCall } from "@/lib/crm/syncFinalizedCall";
import { getEmailProvider } from "@/lib/providers/email";
import { FRL_INTERACTIONS, FRL_OUTCOMES, ReviewPayloadSchema, reviewMessage, type ReviewPayload } from "./contracts";

export async function requireReviewOperator() {
  const session = await getCurrentSession();
  if (!session || !isCrossTenantRole(session)) throw new Error("operator_required");
  return session;
}

export async function loadCallReviewConsole() {
  await requireReviewOperator();
  if (!db) return { captures: [], reviews: [] };
  const captures = await db.callCaptureSession.findMany({ orderBy: { created_at: "desc" }, take: 20 });
  const withConsent = await Promise.all(captures.map(async (capture) => ({
    ...capture,
    consentAction: (await db!.callConsentEvent.findFirst({
      where: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, artifact: "transcript" },
      orderBy: [{ occurred_at: "desc" }, { id: "desc" }], select: { action: true },
    }))?.action ?? null,
  })));
  const latest = await db.callReview.groupBy({
    by: ["account_id", "call_id"], _max: { revision: true, created_at: true },
    orderBy: { _max: { created_at: "desc" } }, take: 50,
  });
  const reviews = latest.length ? await db.callReview.findMany({
    where: { OR: latest.map((row) => ({ account_id: row.account_id, call_id: row.call_id, revision: row._max.revision! })) },
    orderBy: { created_at: "desc" },
  }) : [];
  return { captures: withConsent, reviews };
}

const DRAFT_DEFAULTS = {
  caller: "Unknown caller", interaction: "administrative", product: "unknown", location: "",
  summary: "Analysis unavailable — review the transcript.", qualification: "maybe", outcome: "HUMAN_REVIEW_REQUIRED",
  urgency: "medium", callbackWindow: "", nextAction: "Review and arrange an appropriate callback.",
};

/** Only the fields this event actually carried; absent fields inherit from the prior revision. */
function extractedDraftFields(payload: Record<string, unknown>) {
  const insight = extractTelnyxCallInsight(payload);
  const qualification = insight.qualification?.status;
  const fields: Record<string, string> = {};
  const caller = [insight.firstName, insight.lastName].filter(Boolean).join(" ");
  if (caller) fields.caller = caller;
  const interaction = FRL_INTERACTIONS.includes(insight.canonicalInteraction as never) ? insight.canonicalInteraction : ({ new_sales: "new_sales", existing_customer_new_sale: "existing_customer_new_sale", new_service_request: "new_service", existing_service_request: "existing_service" } as Record<string, string>)[insight.interactionClass ?? ""];
  if (interaction) fields.interaction = interaction;
  if (["vpl", "vehicle_lift", "ceiling_lift", "ramp"].includes(insight.product ?? "")) fields.product = insight.product!;
  const location = [insight.city, insight.state, insight.postalCode].filter(Boolean).join(", ");
  if (location) fields.location = location;
  if (insight.summary) fields.summary = insight.summary;
  if (["qualified", "unqualified", "spam"].includes(String(qualification))) fields.qualification = String(qualification);
  if (FRL_OUTCOMES.includes(insight.outcome as never)) fields.outcome = insight.outcome!;
  if (["low", "medium", "high"].includes(insight.urgency ?? "")) fields.urgency = insight.urgency!;
  if (insight.callbackWindow) fields.callbackWindow = insight.callbackWindow;
  if (insight.nextAction) fields.nextAction = insight.nextAction;
  return fields;
}

export async function queueCallReview(accountId: string, callId: string, payload: Record<string, unknown>) {
  if (!db) throw new Error("database_unavailable");
  const extracted = extractedDraftFields(payload);
  // Canonical evidence is read under the same lock that serializes revisions,
  // so an older request cannot land a higher revision carrying stale evidence
  // after a newer one has already committed.
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${accountId + ":" + callId}))`;
    const call = await tx.call.findFirst({ where: { id: callId, account_id: accountId } });
    if (!call?.provider_call_id || !call.review_required) throw new Error("review_call_missing");
    if (call.status !== "completed") return null;
    const capture = await tx.callCaptureSession.findUnique({ where: { account_id_provider_call_id: { account_id: accountId, provider_call_id: call.provider_call_id } } });
    if (!capture) throw new Error("call_snapshot_missing");
    const memory = BusinessMemorySnapshotSchema.parse(capture.snapshot_json);
    const recipient = readOperatingConfigurationValue(memory, "notification.completed_interaction.recipient");
    const hash = contentHash({ payload, transcript: call.transcript, snapshot: capture.snapshot_id });
    const latest = await tx.callReview.findFirst({ where: { account_id: accountId, call_id: callId }, orderBy: { revision: "desc" } });
    if (latest?.source_hash === hash) return latest;
    if (latest?.dispatch_at) throw new Error("review_dispatch_in_progress");
    const previous = latest?.payload_json && typeof latest.payload_json === "object" && !Array.isArray(latest.payload_json) ? (latest.payload_json as Record<string, unknown>) : {};
    const inherited = Object.fromEntries(Object.entries(previous).filter(([key]) => key !== "phone" && key !== "flags"));
    const preserved = !extracted.summary && typeof previous.summary === "string" && previous.summary !== DRAFT_DEFAULTS.summary;
    const draft = {
      ...DRAFT_DEFAULTS, ...inherited, ...extracted,
      phone: call.from_number,
      flags: [
        "Confirm interaction, product, outcome and callback details against the transcript.",
        ...(preserved ? ["This event carried no analysis; earlier analysis was preserved."] : !extracted.summary ? ["Extraction missing or failed."] : []),
      ],
    };
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
  const operator = await requireReviewOperator();
  if (!db) throw new Error("database_unavailable");
  const row = await db.callReview.findUnique({ where: { id } });
  if (!row || row.status !== "approved") throw new Error("approval_required");
  // The execution gate can be revoked between approval and dispatch. Assistant
  // initialization fails closed on it, so this path must too before it writes
  // to a CRM or sends mail.
  if (!(await supervisedExecutionAuthorized(row.account_id))) throw new Error("execution_gate_not_authorized");
  const auditEntry = (action: string, metadata: Prisma.InputJsonValue): Prisma.AuditLogCreateArgs => ({ data: { account_id: row.account_id, actor_type: "user", actor_user_id: operator.user.id, actor_role: operator.user.role, action, category: "workflow", target_type: "CallReview", target_id: id, metadata_json: metadata } });
  const audit = (action: string, metadata: Prisma.InputJsonValue) => db!.auditLog.create(auditEntry(action, metadata));
  // Parsed before the claim: a payload this dispatch cannot read must not leave
  // the row claimed.
  const value = ReviewPayloadSchema.parse(row.payload_json);
  // Claiming under the queue's lock keeps a revision created by late evidence
  // from slipping in between the latest-revision check and the claim. The
  // attempt is audited inside the same transaction, so a failed audit rolls the
  // claim back instead of orphaning it.
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${row.account_id + ":" + row.call_id}))`;
    const latest = await tx.callReview.findFirst({ where: { account_id: row.account_id, call_id: row.call_id }, orderBy: { revision: "desc" } });
    if (latest?.id !== id) throw new Error("stale_review");
    const prior = await tx.callReview.findFirst({ where: { account_id: row.account_id, call_id: row.call_id, id: { not: id }, OR: [{ dispatch_at: { not: null } }, { email_attempt_at: { not: null } }, { crm_status: { not: "pending" } }] } });
    if (prior) throw new Error("prior_revision_requires_reconciliation");
    const claim = await tx.callReview.updateMany({ where: { id, account_id: row.account_id, status: "approved", dispatch_at: null }, data: { dispatch_at: new Date() } });
    if (!claim.count) throw new Error("dispatch_in_progress_or_uncertain");
    await tx.auditLog.create(auditEntry("call_review_dispatch_attempt", { revision: row.revision }));
  });
  try {
    const crm = await runCrmSyncForCall({ accountId: row.account_id, callId: row.call_id, requireLiveProvider: true, reviewId: id });
    await db.callReview.update({ where: { id, account_id: row.account_id }, data: { crm_status: crm.ok ? crm.data.status : "failed" } });
    if (row.email_status === "accepted") {
      await audit("call_review_dispatch_outcome", { revision: row.revision, outcome: "already_accepted", crmStatus: crm.ok ? crm.data.status : "failed" });
      return { status: "already_accepted" };
    }
    if (row.email_attempt_at && Date.now() - row.email_attempt_at.getTime() >= 23 * 60 * 60 * 1000) throw new Error("email_delivery_requires_reconciliation");
    if (!(await supervisedExecutionAuthorized(row.account_id))) throw new Error("execution_gate_not_authorized");
    const provider = getEmailProvider();
    if (provider.providerId !== "resend") throw new Error("live_email_disabled");
    await db.callReview.update({ where: { id, account_id: row.account_id }, data: { email_attempt_at: row.email_attempt_at ?? new Date(), email_status: "sending" } });
    const message = reviewMessage(value, row.call_id);
    const sent = await provider.send({ to: row.recipient, ...message, idempotencyKey: `review:${id}` });
    await db.callReview.update({ where: { id, account_id: row.account_id }, data: { email_status: "accepted", email_message_id: sent.providerMessageId } });
    await audit("call_review_dispatch_outcome", { revision: row.revision, outcome: "accepted" });
    return { status: "accepted" };
  } catch (error) {
    // A provider-accepted email is irreversible; if the failure came after
    // acceptance the audit must say so rather than contradict the ledger.
    const downgraded = await db.callReview.updateMany({ where: { id, account_id: row.account_id, email_status: { not: "accepted" } }, data: { email_status: "failed" } });
    await audit("call_review_dispatch_outcome", { revision: row.revision, outcome: downgraded.count ? "failed" : "accepted", error: error instanceof Error ? error.message : "dispatch_failed" });
    throw error;
  } finally {
    await db.callReview.update({ where: { id, account_id: row.account_id }, data: { dispatch_at: null } });
  }
}
