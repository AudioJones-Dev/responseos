import { z } from "zod";
import { Prisma, type UserRole } from "@prisma/client";
import { contentHash } from "@/lib/prospectBootstrap/memory";
import { supervisedExecutionAuthorized } from "@/lib/agentExecution/supervisedRuntime";
import type { CrmEffect, CrmReadback } from "@/lib/providers/crm/types";
import { ReviewPayloadSchema } from "@/lib/callReview/contracts";
import "@/lib/serverOnlyGuard";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { getCrmProvider } from "@/lib/providers/crm";
import type { CrmProvider } from "@/lib/providers/crm";
import { err, errFromThrown, ok, type Result } from "@/lib/data/result";
import { sanitizeCrmText } from "@/lib/crm/sanitization";
import { normalizeE164 } from "@/lib/validation/common";

export const CRM_CLAIM_TTL_MS = 15 * 60 * 1000;

export type CrmSyncStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "retryable_failed"
  | "review_required"
  | "cancelled";

export interface CrmSyncOperationView {
  id: string;
  account_id: string;
  operation_key: string;
  provider: string;
  call_id: string;
  source_webhook_id?: string;
  status: CrmSyncStatus;
  attempt_count: number;
  provider_contact_id?: string;
  provider_activity_id?: string;
  provider_task_id?: string;
  last_error_code?: string;
  last_error_redacted?: string;
  next_attempt_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

type OperationRow = Awaited<ReturnType<NonNullable<typeof db>["crmSyncOperation"]["findUnique"]>>;

function toView(row: NonNullable<OperationRow>): CrmSyncOperationView {
  return {
    id: row.id,
    account_id: row.account_id,
    operation_key: row.operation_key,
    provider: row.provider,
    call_id: row.call_id,
    source_webhook_id: row.source_webhook_id ?? undefined,
    status: row.status,
    attempt_count: row.attempt_count,
    provider_contact_id: row.provider_contact_id ?? undefined,
    provider_activity_id: row.provider_activity_id ?? undefined,
    provider_task_id: row.provider_task_id ?? undefined,
    last_error_code: row.last_error_code ?? undefined,
    last_error_redacted: row.last_error_redacted ?? undefined,
    next_attempt_at: row.next_attempt_at?.toISOString(),
    completed_at: row.completed_at?.toISOString(),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

const effects = ["contact_create", "activity_create", "activity_associate", "task_create", "task_associate"] as const;
type Phase = CrmEffect | "done";
type CrmPhaseCode = `crm_${"ready" | "intent" | "reconcile"}:${Phase}`;
const Binding = z.strictObject({ v: z.literal(1), reviewId: z.string().nullable(), payloadHash: z.string(), destination: z.string() });
type BindingValue = z.infer<typeof Binding>;
function bindingOf(row: NonNullable<OperationRow>): BindingValue | null {
  try { return Binding.parse(JSON.parse(row.last_error_redacted ?? "")); } catch { return null; }
}
function phaseOf(code: string | null): { mode: "ready" | "intent" | "reconcile"; effect: Phase } | null {
  const match = /^crm_(ready|intent|reconcile):(contact_create|activity_create|activity_associate|task_create|task_associate|done)$/.exec(code ?? "");
  return match ? { mode: match[1] as "ready" | "intent" | "reconcile", effect: match[2] as Phase } : null;
}
function nextPhase(effect: CrmEffect, qualified: boolean): Phase {
  if (effect === "activity_associate" && !qualified) return "done";
  return effects[effects.indexOf(effect) + 1] ?? "done";
}
export function crmBoundToReview(row: NonNullable<OperationRow> | null, reviewId: string, payload: unknown): boolean {
  if (!row) return false;
  const binding = bindingOf(row);
  return binding?.reviewId === reviewId && binding.payloadHash === contentHash(payload);
}
function reference(callId: string, binding: BindingValue): string {
  return `ResponseOS call ${callId}${binding.reviewId ? ` review ${binding.reviewId} ${binding.payloadHash}` : ""}`;
}
function effectIds(effect: CrmEffect, id: string) {
  if (!id || typeof id !== "string") throw new Error("crm_response_uncertain");
  return effect === "contact_create" ? { provider_contact_id: id } : effect === "activity_create" ? { provider_activity_id: id } : effect === "task_create" ? { provider_task_id: id } : {};
}
function evidence(row: NonNullable<OperationRow>, action: string, metadata: Prisma.InputJsonValue): Prisma.AuditLogCreateArgs {
  return { data: { account_id: row.account_id, actor_type: "system", action, category: "workflow", target_type: "CrmSyncOperation", target_id: row.id, metadata_json: metadata } };
}

export async function runCrmSyncForCall(params: {
  accountId: string; callId: string; sourceWebhookId?: string; providerOverride?: CrmProvider;
  requireLiveProvider?: boolean; structuredActivity?: boolean; reviewId?: string;
}): Promise<Result<CrmSyncOperationView>> {
  if (!db) return err("no_database", "CRM synchronization requires a database connection.");
  const client = db;
  const provider = params.providerOverride ?? getCrmProvider();
  const where = { operation_key: `crm-call:${params.accountId}:${params.callId}`, account_id: params.accountId };
  let operation: NonNullable<OperationRow> | null = null;
  let generation: number | null = null;
  try {
    operation = await client.crmSyncOperation.findUnique({ where }) ?? await client.crmSyncOperation.upsert({ where,
      create: { account_id: params.accountId, call_id: params.callId, operation_key: where.operation_key, provider: params.requireLiveProvider ? "hubspot" : provider.providerId, source_webhook_id: params.sourceWebhookId, last_error_code: "crm_ready:contact_create" }, update: {} });
    if (params.requireLiveProvider && operation.provider !== "hubspot") return err("live_provider_reconciliation_required", "Reconcile the original provider operation before live dispatch.");
    let phase = phaseOf(operation.last_error_code);
    const binding = bindingOf(operation);
    const fresh = !binding && operation.last_error_redacted === null && phase?.mode === "ready" && phase.effect === "contact_create" && !operation.provider_contact_id && !operation.provider_activity_id && !operation.provider_task_id;
    if (operation.status === "cancelled") return ok(toView(operation));
    if (!phase || (!binding && !fresh)) {
      await client.$transaction(async (tx) => {
        const changed = await tx.crmSyncOperation.updateMany({ where: { ...where, attempt_count: operation!.attempt_count, last_error_code: operation!.last_error_code, status: operation!.status }, data: { status: "review_required", last_error_code: "crm_legacy_unknown" } });
        if (changed.count) await tx.auditLog.create(evidence(operation!, "crm_legacy_reconciliation_required", { generation: operation!.attempt_count }));
      });
      return ok(toView(await client.crmSyncOperation.findUniqueOrThrow({ where })));
    }
    if (binding && binding.reviewId !== (params.reviewId ?? null)) return err("crm_review_binding_mismatch", "Use the original approved review.");
    if (operation.status === "succeeded") {
      if (phase.mode !== "ready" || phase.effect !== "done" || !operation.provider_contact_id || !operation.provider_activity_id) return err("crm_state_invalid", "CRM success evidence is incomplete.");
      if (binding?.reviewId) {
        const original = await client.callReview.findFirst({ where: { id: binding.reviewId, account_id: params.accountId, call_id: params.callId, status: "approved" } });
        if (!original || contentHash(original.payload_json) !== binding.payloadHash || (ReviewPayloadSchema.parse(original.payload_json).qualification === "qualified" && !operation.provider_task_id)) return err("crm_review_binding_mismatch", "CRM success is not bound to this payload.");
      }
      return ok(toView(operation));
    }
    const stale = operation.status === "processing" && operation.updated_at.getTime() <= Date.now() - CRM_CLAIM_TTL_MS;
    if (phase.mode === "intent" && stale) {
      await client.$transaction(async (tx) => {
        const changed = await tx.crmSyncOperation.updateMany({ where: { ...where, attempt_count: operation!.attempt_count, status: "processing", last_error_code: operation!.last_error_code, updated_at: operation!.updated_at }, data: { status: "review_required", last_error_code: `crm_reconcile:${phase!.effect}`, attempt_count: { increment: 1 }, next_attempt_at: null } });
        if (changed.count) await tx.auditLog.create(evidence(operation!, "crm_uncertain", { generation: operation!.attempt_count, effect: phase!.effect, cause: "stale_intent" }));
      });
      return ok(toView(await client.crmSyncOperation.findUniqueOrThrow({ where })));
    }
    if (phase.mode !== "ready" || !(operation.status === "pending" || operation.status === "retryable_failed" || stale)) return ok(toView(operation));
    const previous = operation;
    const claimed = await client.$transaction(async (tx) => {
      const changed = await tx.crmSyncOperation.updateMany({ where: { ...where, attempt_count: previous.attempt_count, status: previous.status, last_error_code: previous.last_error_code, updated_at: previous.updated_at }, data: { status: "processing", attempt_count: { increment: 1 }, next_attempt_at: null } });
      if (changed.count) await tx.auditLog.create(evidence(previous, "crm_claim", { generation: previous.attempt_count + 1, effect: phase!.effect }));
      return changed.count > 0;
    });
    if (!claimed) return ok(toView(await client.crmSyncOperation.findUniqueOrThrow({ where })));
    generation = previous.attempt_count + 1;
    operation = { ...previous, status: "processing", attempt_count: generation };
    if (provider.providerId !== operation.provider || (params.requireLiveProvider && provider.providerId !== "hubspot")) throw new Error("live_provider_disabled");
    const call = await client.call.findFirst({ where: { id: params.callId, account_id: params.accountId } });
    if (!call || call.status !== "completed") throw new Error("canonical_call_not_finalized");
    const review = params.reviewId ? await client.callReview.findFirst({ where: { id: params.reviewId, account_id: params.accountId, call_id: params.callId, status: "approved" } }) : null;
    if (call.review_required && !review) throw new Error("approval_required");
    const approved = review ? ReviewPayloadSchema.parse(review.payload_json) : null;
    const contact = call.contact_id ? await client.contact.findFirst({ where: { id: call.contact_id, account_id: params.accountId } }) : null;
    const phone = normalizeE164(approved?.phone ?? contact?.phone ?? call.from_number);
    if (!phone) throw new Error("caller_phone_unavailable");
    const lead = await client.leadEvent.findFirst({ where: { account_id: params.accountId, call_id: call.id }, orderBy: { created_at: "asc" } });
    const qualification = lead ? await client.leadQualification.findUnique({ where: { lead_event_id: lead.id } }) : null;
    const quote = lead ? await client.quoteRequest.findUnique({ where: { lead_event_id: lead.id } }) : null;
    const qualificationLabel = approved?.qualification ?? qualification?.qualification_status ?? "not_scored";
    const sanitizedSummary = sanitizeCrmText(approved?.summary ?? call.summary);
    const nextAction = approved ? sanitizeCrmText(approved.nextAction) : lead?.notes ? sanitizeCrmText(lead.notes) : undefined;
    const redact = (v: string | null | undefined) => v ? sanitizeCrmText(v) : undefined;
    const detail = approved ? { caller: redact(approved.caller), eventType: approved.interaction, service: approved.product, location: redact(approved.location) } : params.structuredActivity ? {
      caller: [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || undefined, relationship: call.caller_relationship ?? undefined, eventType: call.interaction_class ?? undefined,
      service: quote?.service_type ?? qualification?.service_needed ?? undefined, location: [contact?.city, contact?.state, contact?.zip].filter(Boolean).join(", ") || undefined, quoteRequested: Boolean(quote), photosRequested: quote?.photos_requested === true,
    } : undefined;
    const destination = provider.getDestination ? await provider.getDestination() : provider.providerId === "mock" ? "mock:local" : null;
    if (!destination) throw new Error("crm_destination_unavailable");
    const bound: BindingValue = { v: 1, reviewId: review?.id ?? null, payloadHash: contentHash(review?.payload_json ?? { phone, sanitizedSummary, qualificationLabel, nextAction: nextAction ?? null, detail: detail ?? null }), destination };
    if (binding && JSON.stringify(binding) !== JSON.stringify(bound)) throw new Error("crm_binding_mismatch");
    const encoded = JSON.stringify(bound);
    const evidenceReference = reference(call.id, bound);
    const owned = () => ({ ...where, attempt_count: generation!, status: "processing" as const, last_error_code: operation!.last_error_code, last_error_redacted: operation!.last_error_redacted });
    const transition = async (code: CrmPhaseCode, data: Prisma.CrmSyncOperationUpdateManyMutationInput = {}, action = "crm_phase") => {
      const current = operation!;
      if (review && !(await supervisedExecutionAuthorized(params.accountId))) throw new Error("execution_gate_not_authorized");
      await client.$transaction(async (tx) => {
        if (review) {
          const original = await tx.callReview.findFirst({ where: { id: review.id, account_id: params.accountId, call_id: params.callId, status: "approved" } });
          if (!original || contentHash(original.payload_json) !== bound.payloadHash) throw new Error("crm_binding_mismatch");
        }
        const changed = await tx.crmSyncOperation.updateMany({ where: owned(), data: { ...data, last_error_code: code, last_error_redacted: encoded } });
        if (!changed.count) throw new Error("crm_claim_lost");
        await tx.auditLog.create(evidence(current, action, { generation: generation!, callId: call.id, reviewId: bound.reviewId, payloadHash: bound.payloadHash, destination, effect: phase!.effect, resultingCode: code, ...(typeof data.provider_contact_id === "string" ? { providerId: data.provider_contact_id } : typeof data.provider_activity_id === "string" ? { providerId: data.provider_activity_id } : typeof data.provider_task_id === "string" ? { providerId: data.provider_task_id } : {}) }));
      });
      operation = { ...current, ...data, last_error_code: code, last_error_redacted: encoded } as NonNullable<OperationRow>;
    };
    await transition(`crm_ready:${phase.effect}`);
    while (phase.effect !== "done") {
      const effect = phase.effect;
      const needsContact = effect !== "contact_create";
      const needsActivity = effects.indexOf(effect) >= 2;
      const needsTask = effect === "task_associate";
      if ((needsContact && !operation!.provider_contact_id) || (needsActivity && !operation!.provider_activity_id) || (needsTask && !operation!.provider_task_id)) throw new Error("crm_state_invalid");
      let id: string | undefined = (effect === "contact_create" ? operation!.provider_contact_id : effect === "activity_create" ? operation!.provider_activity_id : effect === "task_create" ? operation!.provider_task_id : null) ?? undefined;
      if (!id && effect === "contact_create") {
        const matches = await provider.findContacts({ phone, verifiedEmail: !approved && contact?.email_verified ? contact.email ?? undefined : undefined });
        if (matches.length > 1) throw new Error("crm_ambiguous_match");
        id = matches[0]?.providerContactId;
      } else if (!id && effect === "activity_create") id = (await provider.findCallActivity(evidenceReference))?.providerActivityId;
      else if (!id && effect === "task_create") id = (await provider.findFollowUpTask(evidenceReference))?.providerTaskId;
      if (!id) {
        await transition(`crm_intent:${effect}`, {}, "crm_effect_intent");
        if (effect === "contact_create") id = (await provider.createContact({ phone, verifiedEmail: !approved && contact?.email_verified ? contact.email ?? undefined : undefined, firstName: approved ? sanitizeCrmText(approved.caller) : contact?.first_name ?? undefined, lastName: approved ? undefined : contact?.last_name ?? undefined })).providerContactId;
        else if (effect === "activity_create") id = (await provider.createCallActivity({ contactId: operation!.provider_contact_id!, occurredAt: call.started_at.toISOString(), durationSeconds: call.duration_seconds ?? undefined, sanitizedSummary, qualification: qualificationLabel, nextAction, evidenceReference, detail })).providerActivityId;
        else if (effect === "task_create") id = (await provider.createFollowUpTask({ contactId: operation!.provider_contact_id!, dueAt: new Date((review?.reviewed_at ?? operation!.created_at).getTime() + 86400000).toISOString(), sanitizedSummary, nextAction: nextAction ?? "Review and contact the caller.", evidenceReference })).providerTaskId;
        else {
          id = effect === "activity_associate" ? operation!.provider_activity_id! : operation!.provider_task_id!;
          await provider.associateContact(effect === "activity_associate" ? "calls" : "tasks", id, operation!.provider_contact_id!);
        }
      }
      const next = nextPhase(effect, qualificationLabel === "qualified");
      await transition(`crm_ready:${next}`, effectIds(effect, id!), "crm_effect_acknowledged");
      phase = { mode: "ready", effect: next };
    }
    if (!operation!.provider_contact_id || !operation!.provider_activity_id || (qualificationLabel === "qualified" && !operation!.provider_task_id)) throw new Error("crm_state_invalid");
    await transition("crm_ready:done", { status: "succeeded", completed_at: new Date() }, "crm_succeeded");
    return ok(toView(await client.crmSyncOperation.findUniqueOrThrow({ where })));
  } catch (error) {
    const cause = error instanceof Error ? error.message : "crm_sync_failed";
    if (generation === null || !operation) return err("crm_sync_failed", "CRM operation did not complete.");
    // Read durable state: a commit may have succeeded even if its acknowledgment was lost.
    try {
      await client.$transaction(async (tx) => {
        const current = await tx.crmSyncOperation.findUnique({ where });
        if (!current || current.attempt_count !== generation || current.status !== "processing") return;
        const phase = phaseOf(current.last_error_code);
        const uncertain = phase?.mode === "intent" || !phase || /binding|ambiguous|state_invalid/.test(cause);
        const code = phase?.mode === "intent" ? `crm_reconcile:${phase.effect}` : uncertain ? "crm_legacy_unknown" : current.last_error_code;
        const changed = await tx.crmSyncOperation.updateMany({ where: { ...where, attempt_count: generation!, status: "processing", last_error_code: current.last_error_code }, data: { status: uncertain ? "review_required" : "retryable_failed", last_error_code: code, next_attempt_at: null } });
        if (changed.count) await tx.auditLog.create(evidence(current, uncertain ? "crm_uncertain" : "crm_pre_effect_failure", { generation: generation!, effect: phase?.effect ?? "unknown", cause: /^[a-z_]+$/.test(cause) ? cause : "provider_or_database_failure" }));
      });
    } catch { return err("crm_reconciliation_required", "CRM state requires inspection before retry."); }
    const current = await client.crmSyncOperation.findUnique({ where }).catch(() => null);
    return current ? ok(toView(current)) : err("crm_reconciliation_required", "CRM state requires inspection before retry.");
  }
}

export async function reconcileCrmOperation(params: {
  accountId: string; callId: string; reviewId: string; action: "inspect" | "adopt" | "abandon";
  generation?: number; reason?: string; evidence?: string; priorWorkerStopped?: boolean; expectedProviderId?: string;
  actor: { id: string; role: UserRole }; providerOverride?: CrmProvider;
}) {
  if (!db) throw new Error("database_unavailable");
  const client = db;
  const where = { operation_key: `crm-call:${params.accountId}:${params.callId}`, account_id: params.accountId };
  const row = await client.crmSyncOperation.findUnique({ where });
  const review = await client.callReview.findFirst({ where: { id: params.reviewId, account_id: params.accountId, call_id: params.callId, status: "approved" } });
  if (!row || !review) throw new Error("not_found");
  const bound = bindingOf(row);
  const phase = phaseOf(row.last_error_code);
  if (!bound && params.action === "inspect") {
    const view = { generation: row.attempt_count, status: row.status, effect: "unknown", reviewId: null, destination: "unknown", readback: { outcome: "unavailable" as const }, contactId: row.provider_contact_id, activityId: row.provider_activity_id, taskId: row.provider_task_id };
    await client.auditLog.create({ data: { ...evidence(row, "crm_operator_inspect", { ...view, callId: params.callId, contextReviewId: params.reviewId, reason: "Legacy binding unknown; no execution released" }).data, actor_type: "user", actor_user_id: params.actor.id, actor_role: params.actor.role } });
    return view;
  }
  if (bound?.reviewId !== params.reviewId || bound.payloadHash !== contentHash(review.payload_json)) throw new Error("crm_review_binding_mismatch");
  const provider = params.providerOverride ?? getCrmProvider();
  const value = ReviewPayloadSchema.parse(review.payload_json);
  let readback: CrmReadback = { outcome: "unavailable" };
  if (row.status === "review_required" && phase?.mode === "reconcile" && phase.effect !== "done" && provider.providerId === row.provider && provider.getDestination && provider.reconcileEffect) {
    try {
      if (await provider.getDestination() === bound.destination) readback = await provider.reconcileEffect({ effect: phase.effect, phone: value.phone, firstName: sanitizeCrmText(value.caller), evidenceReference: reference(row.call_id, bound), contactId: row.provider_contact_id ?? undefined, objectId: (phase.effect === "activity_associate" ? row.provider_activity_id : row.provider_task_id) ?? undefined });
    } catch { /* Unavailable readback never permits adoption. */ }
  }
  const view = { generation: row.attempt_count, status: row.status, effect: phase?.effect ?? "unknown", reviewId: bound.reviewId, destination: bound.destination, readback, contactId: row.provider_contact_id, activityId: row.provider_activity_id, taskId: row.provider_task_id };
  if (params.action === "inspect") {
    await client.auditLog.create({ data: { ...evidence(row, "crm_operator_inspect", { ...view, accountId: params.accountId, callId: params.callId, payloadHash: bound.payloadHash, decision: "leave_unresolved", reason: "Read-only provider inspection; no execution released" }).data, actor_type: "user", actor_user_id: params.actor.id, actor_role: params.actor.role } });
    return view;
  }
  if (row.status !== "review_required" || params.generation !== row.attempt_count || !params.reason?.trim() || !params.evidence?.trim()) throw new Error("crm_resolution_conflict");
  if (params.action === "adopt" && (!params.priorWorkerStopped || readback.outcome !== "verified_match" || readback.providerId !== params.expectedProviderId || phase?.mode !== "reconcile" || phase.effect === "done")) throw new Error("crm_evidence_insufficient");
  if (params.action === "adopt" && !(await supervisedExecutionAuthorized(params.accountId))) throw new Error("execution_gate_not_authorized");
  const next = params.action === "adopt" ? nextPhase(phase!.effect as CrmEffect, value.qualification === "qualified") : null;
  await client.$transaction(async (tx) => {
    const original = await tx.callReview.findFirst({ where: { id: review.id, account_id: params.accountId, call_id: params.callId, status: "approved" } });
    if (!original || contentHash(original.payload_json) !== bound.payloadHash) throw new Error("crm_review_binding_mismatch");
    const changed = await tx.crmSyncOperation.updateMany({ where: { ...where, attempt_count: row.attempt_count, status: "review_required", last_error_code: row.last_error_code, last_error_redacted: row.last_error_redacted }, data: {
      status: next ? "pending" : "cancelled", attempt_count: { increment: 1 }, last_error_code: next ? `crm_ready:${next}` : row.last_error_code,
      ...(next && readback.outcome === "verified_match" ? effectIds(phase!.effect as CrmEffect, readback.providerId) : {}), next_attempt_at: null,
    } });
    if (!changed.count) throw new Error("crm_resolution_conflict");
    await tx.callReview.updateMany({ where: { id: review.id, account_id: params.accountId }, data: { crm_status: next ? "pending" : "cancelled" } });
    await tx.auditLog.create({ data: { ...evidence(row, `crm_operator_${params.action}`, { accountId: params.accountId, callId: params.callId, reviewId: params.reviewId, generation: row.attempt_count, effect: phase?.effect ?? "unknown", readback, evidence: params.evidence!, reason: params.reason!, priorWorkerStopped: params.priorWorkerStopped === true, resultingState: next ? `pending:crm_ready:${next}` : "cancelled" }).data, actor_type: "user", actor_user_id: params.actor.id, actor_role: params.actor.role } });
  });
  return { ...view, status: next ? "pending" : "cancelled", generation: row.attempt_count + 1 };
}

export async function listCrmSyncOperations(params: {
  accountId: string;
  status?: CrmSyncStatus;
}): Promise<Result<CrmSyncOperationView[]>> {
  try {
    await requireRole(["aj_admin", "operator"]);
  } catch (error) {
    return errFromThrown(error);
  }
  if (db === null) return ok([]);
  try {
    const rows = await db.crmSyncOperation.findMany({
      where: {
        account_id: params.accountId,
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { updated_at: "desc" },
      take: 100,
    });
    return ok(rows.map(toView));
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function retryCrmSyncOperation(params: {
  id: string;
  accountId: string;
}): Promise<Result<CrmSyncOperationView>> {
  const prepared = await prepareCrmSyncRetry(params);
  if (!prepared.ok) return prepared;
  return runCrmSyncForCall({
    accountId: params.accountId,
    callId: prepared.data.callId,
    sourceWebhookId: prepared.data.sourceWebhookId,
  });
}

export async function prepareCrmSyncRetry(params: {
  id: string;
  accountId: string;
}): Promise<Result<{ callId: string; sourceWebhookId?: string }>> {
  try {
    await requireRole(["aj_admin", "operator"]);
  } catch (error) {
    return errFromThrown(error);
  }
  if (db === null) return err("no_database", "CRM synchronization requires a database connection.");
  const operation = await db.crmSyncOperation.findFirst({
    where: { id: params.id, account_id: params.accountId },
  });
  if (!operation) return err("not_found", "CRM sync operation not found.");
  if (operation.status !== "retryable_failed") {
    return err("invalid_transition", "Only retryable CRM operations can be retried.");
  }
  const call = await db.call.findFirst({ where: { id: operation.call_id, account_id: params.accountId } });
  if (call?.review_required) return err("review_dispatch_required", "Retry from the originally approved call review so its payload and execution gate remain authoritative.");
  return ok({
    callId: operation.call_id,
    sourceWebhookId: operation.source_webhook_id ?? undefined,
  });
}
