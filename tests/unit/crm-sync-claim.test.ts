import { beforeEach, expect, test, vi } from "vitest";
import type { CrmSyncOperation } from "@prisma/client";
import { runCrmSyncForCall, reconcileCrmOperation } from "@/lib/crm/syncFinalizedCall";
import { MockCrmProvider } from "@/lib/providers/crm/mock";
import { ReviewPayloadSchema } from "@/lib/callReview/contracts";

const mocks = vi.hoisted(() => ({ gate: vi.fn(), qualification: vi.fn(), db: {
  $transaction: vi.fn(), crmSyncOperation: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  call: { findFirst: vi.fn() }, callReview: { findFirst: vi.fn(), updateMany: vi.fn() }, contact: { findFirst: vi.fn() }, leadEvent: { findFirst: vi.fn() }, leadQualification: { findUnique: vi.fn() }, quoteRequest: { findUnique: vi.fn() }, auditLog: { create: vi.fn() },
} }));
vi.mock("@/lib/db/client", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/agentExecution/supervisedRuntime", () => ({
  supervisedExecutionAuthorized: mocks.gate,
  supervisedCallWasQualification: mocks.qualification,
}));
const payload = ReviewPayloadSchema.parse({ caller: "Fictional caller", phone: "+15555550199", interaction: "new_sales", product: "ramp", location: "Example city", summary: "Ramp evaluation", qualification: "qualified", outcome: "QUALIFIED_FREE_EVALUATION", urgency: "medium", callbackWindow: "Tomorrow", nextAction: "Call back", flags: [] });
let row: CrmSyncOperation;
let provider: MockCrmProvider;
const params = () => ({ accountId: "account", callId: "call", reviewId: "review", providerOverride: provider });
const resolve = async (action: "inspect" | "adopt" | "abandon", extra = {}) => { const observed = await provider.reconcileEffect(); return reconcileCrmOperation({ expectedProviderId: observed.outcome === "verified_match" ? observed.providerId : undefined, ...params(), reviewId: "review", action, generation: row.attempt_count, reason: "Owner reviewed this uncertain effect", evidence: "Original invocation terminated, deployment drained, provider record inspected", priorWorkerStopped: true, actor: { id: "operator", role: "operator" }, ...extra }); };
const clone = () => structuredClone(row);
function delay<T>() { let release!: (value: T) => void; const promise = new Promise<T>((resolve) => { release = resolve; }); return { promise, release }; }
beforeEach(() => {
  vi.resetAllMocks();
  const now = new Date();
  row = { id: "op", account_id: "account", operation_key: "crm-call:account:call", provider: "mock", call_id: "call", status: "pending", attempt_count: 0, last_error_code: "crm_ready:contact_create", last_error_redacted: null, provider_contact_id: null, provider_activity_id: null, provider_task_id: null, source_webhook_id: null, next_attempt_at: null, completed_at: null, created_at: now, updated_at: now };
  provider = new MockCrmProvider();
  mocks.gate.mockResolvedValue(true);
  mocks.qualification.mockResolvedValue(false);
  mocks.db.crmSyncOperation.findUnique.mockImplementation(async ({ where }) => where.account_id === row.account_id ? clone() : null);
  mocks.db.crmSyncOperation.findUniqueOrThrow.mockImplementation(async () => clone());
  mocks.db.crmSyncOperation.upsert.mockImplementation(async () => clone());
  mocks.db.crmSyncOperation.updateMany.mockImplementation(async ({ where, data }) => {
    for (const [key, value] of Object.entries(where)) {
      const actual = row[key as keyof CrmSyncOperation];
      if (value instanceof Date ? !(actual instanceof Date) || value.getTime() !== actual.getTime() : actual !== value) return { count: 0 };
    }
    row = { ...row, ...data, attempt_count: data.attempt_count ? row.attempt_count + data.attempt_count.increment : row.attempt_count, updated_at: new Date() };
    return { count: 1 };
  });
  let tail = Promise.resolve();
  mocks.db.$transaction.mockImplementation(async (run) => {
    const previous = tail; const done = delay<void>(); tail = done.promise; await previous;
    const saved = clone();
    try { return await run(mocks.db); } catch (error) { row = saved; throw error; } finally { done.release(); }
  });
  mocks.db.call.findFirst.mockImplementation(async ({ where }) => where.account_id === "account" ? { id: "call", status: "completed", review_required: true, from_number: payload.phone, started_at: now, summary: payload.summary } : null);
  mocks.db.callReview.findFirst.mockImplementation(async ({ where }) => where.id === "review" && where.account_id === "account" ? { id: "review", payload_json: payload, status: "approved", reviewed_at: now } : null);
  mocks.db.leadEvent.findFirst.mockResolvedValue(null);
});

test("concurrent claims atomically acquire distinct ownership and produce one effect chain", async () => {
  const create = vi.spyOn(provider, "createContact");
  await Promise.all([runCrmSyncForCall(params()), runCrmSyncForCall(params())]);
  expect(row.status).toBe("succeeded"); expect(row.attempt_count).toBe(1); expect(create).toHaveBeenCalledOnce();
  expect(mocks.db.crmSyncOperation.findUniqueOrThrow.mock.calls.length).toBeLessThanOrEqual(2);
});

test("qualification calls create no CRM operation and reach no provider", async () => {
  mocks.qualification.mockResolvedValue(true);
  const create = vi.spyOn(provider, "createContact");
  expect(await runCrmSyncForCall(params())).toMatchObject({ ok: false, error: { code: "qualification_business_effects_forbidden" } });
  expect(mocks.db.crmSyncOperation.findUnique).not.toHaveBeenCalled();
  expect(mocks.db.crmSyncOperation.upsert).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
});

test("durably pre-effect stale claim is reclaimable", async () => {
  vi.spyOn(provider, "findContacts").mockRejectedValueOnce(new Error("read unavailable"));
  await runCrmSyncForCall(params());
  row.status = "processing"; row.updated_at = new Date(0);
  await runCrmSyncForCall(params());
  expect(row.status).toBe("succeeded"); expect(row.attempt_count).toBe(2);
});

test("intent audit failure rolls back and produces zero provider writes", async () => {
  mocks.db.auditLog.create.mockImplementation(async ({ data }) => { if (data.action === "crm_effect_intent") throw new Error("audit unavailable"); });
  const create = vi.spyOn(provider, "createContact");
  await runCrmSyncForCall(params());
  expect(create).not.toHaveBeenCalled(); expect(row.last_error_code).toBe("crm_ready:contact_create");
});

test("crash after committed intent before HTTP blocks replacement and resumed worker cannot acknowledge", async () => {
  const reached = delay<void>(); const resume = delay<void>(); let paused = false;
  const transaction = mocks.db.$transaction.getMockImplementation()!;
  mocks.db.$transaction.mockImplementation(async (...args) => {
    const result = await transaction(...args);
    if (!paused && row.last_error_code === "crm_intent:contact_create") { paused = true; reached.release(); await resume.promise; }
    return result;
  });
  const create = vi.spyOn(provider, "createContact");
  const first = runCrmSyncForCall(params()); await reached.promise;
  row.updated_at = new Date(0); await runCrmSyncForCall(params());
  expect(row.status).toBe("review_required"); expect(create).not.toHaveBeenCalled();
  resume.release(); await first;
  expect(create).toHaveBeenCalledOnce(); expect(row.provider_contact_id).toBeNull(); expect(row.status).toBe("review_required");
});

test.each(["createContact", "createCallActivity", "createFollowUpTask"] as const)("accepted %s followed by timeout never recreates after negative readback", async (method) => {
  const create = vi.spyOn(provider, method).mockRejectedValue(new Error("timeout after acceptance"));
  await runCrmSyncForCall(params());
  const saved = clone();
  await runCrmSyncForCall(params());
  expect((await resolve("inspect")).readback.outcome).toBe("not_observed");
  await expect(resolve("adopt")).rejects.toThrow("crm_evidence_insufficient");
  expect(create).toHaveBeenCalledOnce(); expect(row.status).toBe("review_required");
  expect(row.provider_contact_id).toBe(saved.provider_contact_id); expect(row.provider_activity_id).toBe(saved.provider_activity_id);
});

test("temporarily invisible accepted object stays blocked then verified adoption continues without recreating", async () => {
  const create = vi.spyOn(provider, "createContact").mockRejectedValue(new Error("accepted but response lost"));
  await runCrmSyncForCall(params());
  expect((await resolve("inspect")).readback.outcome).toBe("not_observed");
  await expect(resolve("adopt")).rejects.toThrow("crm_evidence_insufficient");
  vi.spyOn(provider, "reconcileEffect").mockResolvedValue({ outcome: "verified_match", providerId: "accepted-contact" });
  await expect(resolve("adopt", { priorWorkerStopped: false })).rejects.toThrow("crm_evidence_insufficient");
  await resolve("adopt"); await runCrmSyncForCall(params());
  expect(row.status).toBe("succeeded"); expect(row.provider_contact_id).toBe("accepted-contact"); expect(create).toHaveBeenCalledOnce();
});

test.each(["ambiguous", "unavailable", "not_observed"] as const)("%s readback never releases an uncertain CREATE", async (outcome) => {
  vi.spyOn(provider, "createContact").mockRejectedValue(new Error("timeout")); await runCrmSyncForCall(params());
  vi.spyOn(provider, "reconcileEffect").mockResolvedValue(outcome === "ambiguous" ? { outcome, candidateIds: ["a", "b"] } : { outcome });
  await expect(resolve("adopt")).rejects.toThrow("crm_evidence_insufficient"); expect(row.status).toBe("review_required");
});

test.each(["findContacts", "findCallActivity", "findFollowUpTask"] as const)("suspension during %s cannot authorize a stale worker's next create", async (method) => {
  vi.spyOn(provider, method).mockImplementation(async () => { row.attempt_count += 1; return (method === "findContacts" ? [] : null) as never; });
  const write = vi.spyOn(provider, method === "findContacts" ? "createContact" : method === "findCallActivity" ? "createCallActivity" : "createFollowUpTask");
  await runCrmSyncForCall(params()); expect(write).not.toHaveBeenCalled(); expect(row.status).toBe("processing");
});

test("association timeout requires exact relationship readback and preserves all acknowledged objects", async () => {
  const associate = vi.spyOn(provider, "associateContact").mockRejectedValueOnce(new Error("response lost"));
  const contact = vi.spyOn(provider, "createContact"); const activity = vi.spyOn(provider, "createCallActivity");
  await runCrmSyncForCall(params()); expect(row.last_error_code).toBe("crm_reconcile:activity_associate");
  vi.spyOn(provider, "reconcileEffect").mockResolvedValue({ outcome: "verified_match", providerId: row.provider_activity_id! });
  await resolve("adopt"); await runCrmSyncForCall(params());
  expect(row.status).toBe("succeeded"); expect(contact).toHaveBeenCalledOnce(); expect(activity).toHaveBeenCalledOnce(); expect(associate).toHaveBeenCalledTimes(2);
});

test("post-effect DB acknowledgment failure retains intent and acknowledged earlier IDs", async () => {
  mocks.db.auditLog.create.mockImplementation(async ({ data }) => { if (data.action === "crm_effect_acknowledged" && data.metadata_json.effect === "activity_create") throw new Error("db failed"); });
  const create = vi.spyOn(provider, "createCallActivity");
  await runCrmSyncForCall(params()); await runCrmSyncForCall(params());
  expect(row.last_error_code).toBe("crm_reconcile:activity_create"); expect(row.provider_contact_id).toBeTruthy(); expect(row.provider_activity_id).toBeNull(); expect(create).toHaveBeenCalledOnce();
});

test("two operators cannot both release reconciliation", async () => {
  vi.spyOn(provider, "createContact").mockRejectedValue(new Error("timeout")); await runCrmSyncForCall(params());
  vi.spyOn(provider, "reconcileEffect").mockResolvedValue({ outcome: "verified_match", providerId: "verified" });
  const results = await Promise.allSettled([resolve("adopt"), resolve("adopt")]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1); expect(row.status).toBe("pending");
});

test("resolution audit failure cannot release blocked operation", async () => {
  vi.spyOn(provider, "createContact").mockRejectedValue(new Error("timeout")); await runCrmSyncForCall(params());
  vi.spyOn(provider, "reconcileEffect").mockResolvedValue({ outcome: "verified_match", providerId: "verified" });
  mocks.db.auditLog.create.mockRejectedValue(new Error("audit failed"));
  await expect(resolve("adopt")).rejects.toThrow(); expect(row.status).toBe("review_required"); expect(row.provider_contact_id).toBeNull();
});

test("wrong review, account, changed frozen payload or destination cannot reconcile", async () => {
  vi.spyOn(provider, "createContact").mockRejectedValue(new Error("timeout")); await runCrmSyncForCall(params());
  await expect(resolve("adopt", { reviewId: "new-review" })).rejects.toThrow();
  await expect(resolve("adopt", { accountId: "other-account" })).rejects.toThrow();
  vi.spyOn(provider, "getDestination").mockResolvedValue("other-portal");
  await expect(resolve("adopt")).rejects.toThrow("crm_evidence_insufficient");
  mocks.db.callReview.findFirst.mockResolvedValue({ id: "review", payload_json: { ...payload, summary: "different" }, status: "approved" });
  await expect(resolve("adopt")).rejects.toThrow("crm_review_binding_mismatch"); expect(row.status).toBe("review_required");
});

test("newer review cannot dispatch an uncertain original operation", async () => {
  vi.spyOn(provider, "createContact").mockRejectedValue(new Error("timeout")); await runCrmSyncForCall(params());
  expect(await runCrmSyncForCall({ ...params(), reviewId: "new-review" })).toMatchObject({ ok: false, error: { code: "crm_review_binding_mismatch" } });
});

test("legacy row without phase evidence fails closed", async () => {
  row.last_error_code = null; row.status = "processing"; row.updated_at = new Date(0);
  const create = vi.spyOn(provider, "createContact"); await runCrmSyncForCall(params());
  expect(row.status).toBe("review_required"); expect(create).not.toHaveBeenCalled();
});

test("execution revocation prevents the next effect", async () => {
  const contact = vi.spyOn(provider, "createContact").mockImplementation(async () => { mocks.gate.mockResolvedValue(false); return { providerContactId: "accepted" }; });
  const activity = vi.spyOn(provider, "createCallActivity"); await runCrmSyncForCall(params());
  expect(contact).toHaveBeenCalledOnce(); expect(activity).not.toHaveBeenCalled(); expect(row.status).toBe("review_required");
});

test("unqualified approved review never creates a task", async () => {
  mocks.db.callReview.findFirst.mockResolvedValue({ id: "review", payload_json: { ...payload, qualification: "unqualified" }, status: "approved", reviewed_at: new Date() });
  const task = vi.spyOn(provider, "createFollowUpTask"); await runCrmSyncForCall(params());
  expect(row.status).toBe("succeeded"); expect(task).not.toHaveBeenCalled();
});

test("abandonment retains external IDs and records actor/evidence without further effects", async () => {
  vi.spyOn(provider, "createCallActivity").mockRejectedValue(new Error("timeout")); await runCrmSyncForCall(params());
  await resolve("abandon"); await runCrmSyncForCall(params());
  expect(row.status).toBe("cancelled"); expect(row.provider_contact_id).toBeTruthy();
  expect(mocks.db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "crm_operator_abandon", actor_user_id: "operator", metadata_json: expect.objectContaining({ reviewId: "review", resultingState: "cancelled" }) }) }));
});


test("a worker paused after claim commit never borrows the replacement generation", async () => {
  const reached = delay<void>(); const resume = delay<void>(); let paused = false;
  const transaction = mocks.db.$transaction.getMockImplementation()!;
  mocks.db.$transaction.mockImplementation(async (...args) => {
    const result = await transaction(...args);
    if (!paused && row.attempt_count === 1 && row.status === "processing") { paused = true; reached.release(); await resume.promise; }
    return result;
  });
  const create = vi.spyOn(provider, "createContact");
  const first = runCrmSyncForCall(params()); await reached.promise;
  row.updated_at = new Date(0); await runCrmSyncForCall(params());
  resume.release(); await first;
  expect(row.status).toBe("succeeded"); expect(row.attempt_count).toBe(2); expect(create).toHaveBeenCalledOnce();
});

test.each(["activity_create", "task_create"] as const)("%s resolution does not recreate earlier acknowledged objects", async (effect) => {
  const contact = vi.spyOn(provider, "createContact");
  const activity = vi.spyOn(provider, "createCallActivity");
  const task = vi.spyOn(provider, "createFollowUpTask");
  (effect === "activity_create" ? activity : task).mockRejectedValueOnce(new Error("accepted then timeout"));
  await runCrmSyncForCall(params());
  vi.spyOn(provider, "reconcileEffect").mockResolvedValue({ outcome: "verified_match", providerId: `verified-${effect}` });
  await resolve("adopt"); await runCrmSyncForCall(params());
  expect(row.status).toBe("succeeded"); expect(contact).toHaveBeenCalledOnce(); expect(activity).toHaveBeenCalledOnce(); expect(task).toHaveBeenCalledOnce();
});


test("changed candidate between inspection and adoption cannot release execution", async () => {
  vi.spyOn(provider, "createContact").mockRejectedValue(new Error("timeout")); await runCrmSyncForCall(params());
  vi.spyOn(provider, "reconcileEffect").mockResolvedValue({ outcome: "verified_match", providerId: "new-candidate" });
  await expect(resolve("adopt", { expectedProviderId: "previously-inspected" })).rejects.toThrow("crm_evidence_insufficient");
  expect(row.status).toBe("review_required"); expect(row.provider_contact_id).toBeNull();
});
