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
import { runCrmSyncForCall, reconcileCrmOperation, crmBoundToReview } from "@/lib/crm/syncFinalizedCall";
import { getEmailProvider } from "@/lib/providers/email";
import { FRL_INTERACTIONS, FRL_OUTCOMES, ReviewPayloadSchema, reviewMessage, type ReviewPayload } from "./contracts";

// Review claims may expire; CRM effect intents and email acceptance govern recovery.
export const DISPATCH_CLAIM_TTL_MS = 15 * 60 * 1000;

export async function requireReviewOperator() {
  const session = await getCurrentSession();
  if (!session || !isCrossTenantRole(session)) throw new Error("operator_required");
  return session;
}

export async function loadCallReviewConsole() {
  await requireReviewOperator();
  if (!db) return { captures: [], reviews: [] };
  const captures = await db.callCaptureSession.findMany({ orderBy: { created_at: "desc" }, take: 20 });
  const withConsent = await Promise.all(captures.map(async (capture) => {
    const [consent, commands, call, account] = await Promise.all([
      db!.callConsentEvent.findFirst({
      where: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, artifact: "transcript" },
      orderBy: [{ occurred_at: "desc" }, { id: "desc" }], select: { action: true },
      }),
      db!.telnyxCallCommand.findMany({
      where: { capture_session_id: capture.id },
      orderBy: { intended_at: "asc" },
      select: { command_type: true, status: true, error_code: true, intended_at: true, provider_responded_at: true },
      }),
      db!.call.findFirst({ where: { account_id: capture.account_id, provider_call_id: capture.provider_call_id }, select: { from_number: true, to_number: true, started_at: true } }),
      db!.account.findUnique({ where: { id: capture.account_id }, select: { name: true } }),
    ]);
    return { ...capture, consentAction: consent?.action ?? null, commands, call, accountName: account?.name ?? capture.account_id };
  }));
  const latest = await db.callReview.groupBy({
    by: ["account_id", "call_id"], _max: { revision: true, created_at: true },
    orderBy: { _max: { created_at: "desc" } }, take: 50,
  });
  const reviews = latest.length ? await db.callReview.findMany({
    where: { OR: [{ status: "approved" }, ...latest.map((row) => ({ account_id: row.account_id, call_id: row.call_id, revision: row._max.revision! }))] },
    orderBy: { created_at: "desc" }, take: 50,
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

/** Whether any review revision exists for the call — a later evidence update must then produce a new one. */
export async function hasQueuedReview(accountId: string, callId: string, client?: Prisma.TransactionClient): Promise<boolean> {
  const reader = client ?? db;
  if (!reader) return false;
  return (await reader.callReview.count({ where: { account_id: accountId, call_id: callId } })) > 0;
}

/**
 * Creates the next review revision from canonical evidence.
 *
 * When called with the capture lock's transaction client, the revision is
 * created in the same transaction that normalized the evidence, so there is no
 * committed state in which the call's evidence is newer than its latest
 * revision. Approval takes the same capture lock, so it cannot run inside that
 * window either.
 */
export async function queueCallReview(accountId: string, callId: string, payload: Record<string, unknown>, client?: Prisma.TransactionClient) {
  if (!db) throw new Error("database_unavailable");
  const extracted = extractedDraftFields(payload);
  // Canonical evidence is read under the same lock that serializes revisions,
  // so an older request cannot land a higher revision carrying stale evidence
  // after a newer one has already committed.
  const run = async (tx: Prisma.TransactionClient) => {
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
    if (latest?.dispatch_at && latest.dispatch_at.getTime() > Date.now() - DISPATCH_CLAIM_TTL_MS) throw new Error("review_dispatch_in_progress");
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
  };
  return client ? run(client) : db.$transaction(run);
}

export async function decideCallReview(id: string, revision: number, action: "approve" | "reject", payload?: ReviewPayload) {
  const operator = await requireReviewOperator();
  if (!db) throw new Error("database_unavailable");
  return db.$transaction(async (tx) => {
    const row = await tx.callReview.findUnique({ where: { id } });
    if (!row) throw new Error("not_found");
    // Same lock order as the webhook (capture, then review): approval waits
    // for any in-flight normalization and the revision it queues, so it can
    // never approve against evidence that is about to be superseded.
    const located = await tx.call.findFirst({ where: { id: row.call_id, account_id: row.account_id }, select: { provider_call_id: true } });
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"capture:" + row.account_id + ":" + (located?.provider_call_id ?? row.call_id)}))`;
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
  if (!(await supervisedExecutionAuthorized(row.account_id, row.call_id))) throw new Error("execution_gate_not_authorized");
  const auditEntry = (action: string, metadata: Prisma.InputJsonValue): Prisma.AuditLogCreateArgs => ({ data: { account_id: row.account_id, actor_type: "user", actor_user_id: operator.user.id, actor_role: operator.user.role, action, category: "workflow", target_type: "CallReview", target_id: id, metadata_json: metadata } });
  const audit = (action: string, metadata: Prisma.InputJsonValue) => db!.auditLog.create(auditEntry(action, metadata));
  // Parsed before the claim: a payload this dispatch cannot read must not leave
  // the row claimed.
  const value = ReviewPayloadSchema.parse(row.payload_json);
  // The claim timestamp doubles as the dispatch token: every later write that
  // must belong to this attempt is fenced on it, so a worker suspended past
  // the TTL and reclaimed cannot resume into another attempt's effects.
  const claimedAt = new Date();
  // Claiming under the queue's lock keeps a revision created by late evidence
  // from slipping in between the latest-revision check and the claim. The
  // attempt is audited inside the same transaction, so a failed audit rolls the
  // claim back instead of orphaning it.
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${row.account_id + ":" + row.call_id}))`;
    const latest = await tx.callReview.findFirst({ where: { account_id: row.account_id, call_id: row.call_id }, orderBy: { revision: "desc" } });
    const existingCrm = await tx.crmSyncOperation.findUnique({ where: { operation_key: `crm-call:${row.account_id}:${row.call_id}`, account_id: row.account_id } });
    if (latest?.id !== id && !crmBoundToReview(existingCrm, id, row.payload_json)) throw new Error("stale_review");
    const prior = await tx.callReview.findFirst({ where: { account_id: row.account_id, call_id: row.call_id, id: { not: id }, OR: [{ dispatch_at: { not: null } }, { email_attempt_at: { not: null } }, { crm_status: { not: "pending" } }] } });
    if (prior) throw new Error("prior_revision_requires_reconciliation");
    // The CRM operation is call-wide; its own durable boundary governs recovery. If an earlier revision
    // reached the provider but its status write was lost, no review records
    // the effect; a newer revision must not dispatch on top of it, because the
    // CRM would keep the old payload while email sent the new one.
    const operation = await tx.crmSyncOperation.findUnique({ where: { operation_key: `crm-call:${row.account_id}:${row.call_id}` } });
    const effectReached = Boolean(operation?.provider_contact_id || operation?.provider_activity_id || operation?.provider_task_id);
    if (effectReached && !crmBoundToReview(operation, id, row.payload_json)) {
      const earlier = await tx.callReview.findFirst({ where: { account_id: row.account_id, call_id: row.call_id, id: { not: id } }, select: { id: true } });
      const recorded = await tx.callReview.findFirst({ where: { account_id: row.account_id, call_id: row.call_id, crm_status: { not: "pending" } }, select: { id: true } });
      if (earlier && !recorded) throw new Error("prior_revision_requires_reconciliation");
    }
    const staleBefore = new Date(Date.now() - DISPATCH_CLAIM_TTL_MS);
    const recoveringStaleClaim = row.dispatch_at !== null && row.dispatch_at <= staleBefore;
    const claim = await tx.callReview.updateMany({
      where: { id, account_id: row.account_id, status: "approved", OR: [{ dispatch_at: null }, { dispatch_at: { lte: staleBefore } }] },
      data: { dispatch_at: claimedAt },
    });
    if (!claim.count) throw new Error("dispatch_in_progress_or_uncertain");
    await tx.auditLog.create(auditEntry("call_review_dispatch_attempt", { revision: row.revision, ...(recoveringStaleClaim ? { recoveredStaleClaimFrom: row.dispatch_at!.toISOString() } : {}) }));
  });
  let crmStatus: string | null = null;
  // Held outside the try so a failure after provider acceptance can still
  // record the acceptance: a sent email is irreversible whatever the database
  // did afterwards.
  let sent: { providerMessageId: string } | null = null;
  try {
    // The CRM write is an irreversible external effect, so ownership is proven
    // before it, not only before the email. A worker suspended past the claim
    // TTL can have its claim taken and a newer revision queued from later
    // evidence; without this fence it would resume here and push its stale
    // approved payload to the CRM. The write is deliberately shaped as a no-op
    // on `dispatch_at` so the delivery state machine is untouched: only
    // ownership is being checked.
    const owns = await db.callReview.updateMany({ where: { id, account_id: row.account_id, status: "approved", dispatch_at: claimedAt }, data: { dispatch_at: claimedAt } });
    if (!owns.count) throw new Error("dispatch_claim_lost");
    const latestBeforeCrm = await db.callReview.findFirst({ where: { account_id: row.account_id, call_id: row.call_id }, orderBy: { revision: "desc" }, select: { id: true } });
    if (latestBeforeCrm?.id !== id && !crmBoundToReview(await db.crmSyncOperation.findUnique({ where: { operation_key: `crm-call:${row.account_id}:${row.call_id}`, account_id: row.account_id } }), id, row.payload_json)) throw new Error("stale_review");
    const crm = await runCrmSyncForCall({ accountId: row.account_id, callId: row.call_id, requireLiveProvider: true, reviewId: id });
    crmStatus = crm.ok ? crm.data.status : "failed";
    const recordedCrm = await db.callReview.updateMany({ where: { id, account_id: row.account_id, dispatch_at: claimedAt }, data: { crm_status: crmStatus } });
    if (!recordedCrm.count) throw new Error("dispatch_claim_lost");
    if (row.email_status === "accepted") {
      await audit("call_review_dispatch_outcome", { revision: row.revision, outcome: "already_accepted", crmStatus: crm.ok ? crm.data.status : "failed" });
      return { status: "already_accepted" };
    }
    // Required CRM effects must all be durably acknowledged before new email.
    if (crmStatus !== "succeeded") throw new Error("crm_incomplete");
    if (row.email_attempt_at && Date.now() - row.email_attempt_at.getTime() >= 23 * 60 * 60 * 1000) throw new Error("email_delivery_requires_reconciliation");
    if (!(await supervisedExecutionAuthorized(row.account_id, row.call_id))) throw new Error("execution_gate_not_authorized");
    const provider = getEmailProvider();
    if (provider.providerId !== "resend") throw new Error("live_email_disabled");
    // Fenced on the claim: a reclaimed row no longer carries this attempt's
    // dispatch_at, so a resumed stale worker stops here instead of sending.
    // The latest-revision check repeats for the same reason: evidence that
    // arrived while this worker was suspended must not be undercut by the
    // payload it parsed earlier.
    const latestNow = await db.callReview.findFirst({ where: { account_id: row.account_id, call_id: row.call_id }, orderBy: { revision: "desc" }, select: { id: true } });
    if (latestNow?.id !== id && !crmBoundToReview(await db.crmSyncOperation.findUnique({ where: { operation_key: `crm-call:${row.account_id}:${row.call_id}`, account_id: row.account_id } }), id, row.payload_json)) throw new Error("stale_review");
    const fenced = await db.callReview.updateMany({ where: { id, account_id: row.account_id, status: "approved", dispatch_at: claimedAt }, data: { email_attempt_at: row.email_attempt_at ?? new Date(), email_status: "sending" } });
    if (!fenced.count) throw new Error("dispatch_claim_lost");
    const message = reviewMessage(value, row.call_id);
    sent = await provider.send({ to: row.recipient, ...message, idempotencyKey: `review:${id}` });
    await db.callReview.update({ where: { id, account_id: row.account_id }, data: { email_status: "accepted", email_message_id: sent.providerMessageId } });
    await audit("call_review_dispatch_outcome", { revision: row.revision, outcome: "accepted" });
    return { status: "accepted" };
  } catch (error) {
    // A provider-accepted email is irreversible; if the failure came after
    // acceptance the audit must say so rather than contradict the ledger.
    // The CRM outcome is known once runCrmSyncForCall returned; if its status
    // write was the failure, try once more so the effect is not orphaned.
    if (crmStatus) await db.callReview.updateMany({ where: { id, account_id: row.account_id, crm_status: "pending" }, data: { crm_status: crmStatus } }).catch(() => null);
    if (sent) {
      // The provider accepted the message; the failure was the delivery-state
      // write (or the audit after it). Record the acceptance and its id rather
      // than a provider failure, so a retry reconciles instead of resending.
      await db.callReview.updateMany({ where: { id, account_id: row.account_id, email_status: { not: "accepted" } }, data: { email_status: "accepted", email_message_id: sent.providerMessageId } }).catch(() => null);
      await audit("call_review_dispatch_outcome", { revision: row.revision, outcome: "accepted", reconciliationRequired: true, providerMessageId: sent.providerMessageId, error: error instanceof Error ? error.message : "dispatch_failed" });
      throw error;
    }
    const downgraded = await db.callReview.updateMany({ where: { id, account_id: row.account_id, email_status: { not: "accepted" }, dispatch_at: claimedAt }, data: { email_status: "failed" } });
    // A fence that matches nothing has two causes, and they are not the same
    // outcome: the row was already accepted, or this attempt lost its claim and
    // never sent. Read the persisted state rather than inferring acceptance
    // from a zero count, which would audit a send that never happened.
    const persisted = downgraded.count ? null : await db.callReview.findUnique({ where: { id, account_id: row.account_id }, select: { email_status: true } }).catch(() => null);
    const outcome = downgraded.count ? "failed" : persisted?.email_status === "accepted" ? "accepted" : "claim_lost";
    await audit("call_review_dispatch_outcome", { revision: row.revision, outcome, error: error instanceof Error ? error.message : "dispatch_failed" });
    throw error;
  } finally {
    // Release only this attempt's claim; a reclaimed row belongs to someone else.
    await db.callReview.updateMany({ where: { id, account_id: row.account_id, dispatch_at: claimedAt }, data: { dispatch_at: null } });
  }
}

export async function reconcileCallReview(id: string, input: {
  action: "crm_inspect" | "crm_adopt" | "crm_abandon";
  generation?: number; reason?: string; evidence?: string; priorWorkerStopped?: boolean; expectedProviderId?: string;
}) {
  const operator = await requireReviewOperator();
  if (!db) throw new Error("database_unavailable");
  const row = await db.callReview.findUnique({ where: { id } });
  if (!row || row.status !== "approved") throw new Error("approval_required");
  return reconcileCrmOperation({ ...input, action: input.action === "crm_inspect" ? "inspect" : input.action === "crm_adopt" ? "adopt" : "abandon", accountId: row.account_id, callId: row.call_id, reviewId: row.id, actor: { id: operator.user.id, role: operator.user.role } });
}
