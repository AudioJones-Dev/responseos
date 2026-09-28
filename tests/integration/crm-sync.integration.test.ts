import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { runCrmSyncForCall, reconcileCrmOperation } from "@/lib/crm/syncFinalizedCall";
import { MockCrmProvider, type CrmProvider } from "@/lib/providers/crm";
import { disconnectTestDb, prisma, resetAndSeedTestDb } from "./setup";

describe("durable CRM synchronization", () => {
  beforeEach(resetAndSeedTestDb);
  afterAll(disconnectTestDb);

  test("concurrent retries claim one operation before provider effects", async () => {
    const provider = new MockCrmProvider();
    const contact = vi.spyOn(provider, "createContact");
    const activity = vi.spyOn(provider, "createCallActivity");
    const task = vi.spyOn(provider, "createFollowUpTask");
    await prisma.crmSyncOperation.create({ data: {
      account_id: "org_responseos_demo", call_id: "call_responseos_demo",
      operation_key: "crm-call:org_responseos_demo:call_responseos_demo",
      provider: "mock", status: "retryable_failed", last_error_code: "crm_ready:contact_create",
    } });
    const params = { accountId: "org_responseos_demo", callId: "call_responseos_demo", providerOverride: provider };
    const results = await Promise.all([runCrmSyncForCall(params), runCrmSyncForCall(params)]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(contact).toHaveBeenCalledOnce();
    expect(activity).toHaveBeenCalledOnce();
    expect(task).toHaveBeenCalledOnce();
    expect(await prisma.crmSyncOperation.findFirstOrThrow()).toMatchObject({ status: "succeeded", attempt_count: 1 });
  });

  test("a known pre-effect processing claim can be recovered while legacy uncertainty stops", async () => {
    const provider = new MockCrmProvider();
    const params = { accountId: "org_responseos_demo", callId: "call_responseos_demo", providerOverride: provider };
    vi.spyOn(provider, "findContacts").mockRejectedValueOnce(new Error("read unavailable"));
    await runCrmSyncForCall(params);
    await prisma.crmSyncOperation.updateMany({ data: { status: "processing", updated_at: new Date(0) } });
    expect((await runCrmSyncForCall(params))).toMatchObject({ ok: true, data: { status: "succeeded", attempt_count: 2 } });
    await prisma.crmSyncOperation.updateMany({ data: { status: "processing", last_error_code: null, updated_at: new Date(0) } });
    expect((await runCrmSyncForCall(params))).toMatchObject({ ok: true, data: { status: "review_required", last_error_code: "crm_legacy_unknown" } });
  });

  test("replays one finalized qualified call without duplicate operations", async () => {
    const params = {
      accountId: "org_responseos_demo",
      callId: "call_responseos_demo",
      providerOverride: new MockCrmProvider(),
    };
    const first = await runCrmSyncForCall(params);
    const replay = await runCrmSyncForCall(params);
    expect(first.ok && first.data.status).toBe("succeeded");
    expect(replay.ok && replay.data.operation_key).toBe(first.ok ? first.data.operation_key : "");
    expect(await prisma.crmSyncOperation.count()).toBe(1);
    const operation = await prisma.crmSyncOperation.findFirstOrThrow();
    expect(operation.provider_contact_id).toBeTruthy();
    expect(operation.provider_activity_id).toBeTruthy();
    expect(operation.provider_task_id).toBeTruthy();
  });

  test("marks ambiguous contact matches for review without mutation", async () => {
    const provider = new MockCrmProvider();
    provider.findContacts = vi.fn().mockResolvedValue([
      { providerContactId: "contact-1" },
      { providerContactId: "contact-2" },
    ]);
    provider.createContact = vi.fn();
    provider.createCallActivity = vi.fn();
    const result = await runCrmSyncForCall({
      accountId: "org_responseos_demo",
      callId: "call_responseos_demo",
      providerOverride: provider as CrmProvider,
    });
    expect(result.ok && result.data.status).toBe("review_required");
    expect(provider.createContact).not.toHaveBeenCalled();
    expect(provider.createCallActivity).not.toHaveBeenCalled();
  });
});


describe("supervised CRM external-effect uncertainty", () => {
  const accountId = "org_responseos_demo";
  const callId = "call_responseos_demo";
  let reviewId: string;
  let provider: MockCrmProvider;
  const payload = { caller: "Fictional caller", phone: "+15555550199", interaction: "new_sales", product: "ramp", location: "Example city", summary: "Ramp evaluation", qualification: "qualified", outcome: "QUALIFIED_FREE_EVALUATION", urgency: "medium", callbackWindow: "Tomorrow", nextAction: "Call back", flags: [] };
  const params = () => ({ accountId, callId, reviewId, providerOverride: provider });
  const operation = () => prisma.crmSyncOperation.findFirstOrThrow({ where: { account_id: accountId, call_id: callId } });
  async function resolve(generation: number, action: "adopt" | "abandon" = "adopt") {
    const observed = await provider.reconcileEffect();
    return reconcileCrmOperation({ expectedProviderId: observed.outcome === "verified_match" ? observed.providerId : undefined, ...params(), action, generation, priorWorkerStopped: true, reason: "Operator reviewed provider effect", evidence: "Fixture invocation terminated and matching provider record inspected", actor: { id: "test-operator", role: "operator" } });
  }
  beforeEach(async () => {
    await resetAndSeedTestDb();
    vi.stubEnv("RESPONSEOS_AUTHORIZED_EXECUTION_GATES", "v0.3-live-communications");
    const { EXECUTION_MODE_POLICIES } = await import("@/lib/agentExecution/policy");
    await prisma.agentProfile.create({ data: { account_id: accountId, name: "Fixture", type: "supervised_receptionist", slug: "crm-recovery-fixture", enabled: true, system_policy_json: JSON.parse(JSON.stringify(EXECUTION_MODE_POLICIES.SUPERVISED_PILOT)) } });
    await prisma.call.update({ where: { id: callId }, data: { review_required: true } });
    reviewId = (await prisma.callReview.create({ data: { account_id: accountId, call_id: callId, revision: 1, source_hash: "fixture", status: "approved", reviewed_at: new Date(), payload_json: payload, evidence_json: {}, recipient: "fictional@example.test" } })).id;
    provider = new MockCrmProvider();
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(disconnectTestDb);

  test("accepted timeout, invisible search, explicit verified adoption and continuation retain original review", async () => {
    const create = vi.spyOn(provider, "createContact").mockRejectedValue(new Error("accepted then timeout"));
    await runCrmSyncForCall(params());
    expect(await operation()).toMatchObject({ status: "review_required", provider_contact_id: null, last_error_code: "crm_reconcile:contact_create" });
    await expect(resolve((await operation()).attempt_count)).rejects.toThrow("crm_evidence_insufficient");
    await runCrmSyncForCall(params()); expect(create).toHaveBeenCalledOnce();
    vi.spyOn(provider, "reconcileEffect").mockResolvedValue({ outcome: "verified_match", providerId: "verified-contact" });
    const original = await operation();
    const resolutions = await Promise.allSettled([resolve(original.attempt_count), resolve(original.attempt_count)]);
    expect(resolutions.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    await prisma.callReview.create({ data: { account_id: accountId, call_id: callId, revision: 2, source_hash: "later", status: "pending", payload_json: { ...payload, summary: "Later evidence" }, evidence_json: {}, recipient: "fictional@example.test" } });
    await runCrmSyncForCall(params());
    expect(await operation()).toMatchObject({ status: "succeeded", provider_contact_id: "verified-contact" });
    expect(create).toHaveBeenCalledOnce();
    expect(await prisma.auditLog.count({ where: { action: "crm_operator_adopt", target_id: original.id } })).toBe(1);
  });

  test("stale in-flight worker may return but cannot persist an external acknowledgment", async () => {
    let entered!: () => void; let release!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const finish = new Promise<void>((resolve) => { release = resolve; });
    const contact = vi.spyOn(provider, "createContact").mockImplementation(async () => { entered(); await finish; return { providerContactId: "late-contact" }; });
    const first = runCrmSyncForCall(params()); await started;
    await prisma.crmSyncOperation.updateMany({ data: { updated_at: new Date(0) } });
    await runCrmSyncForCall(params());
    release(); await first;
    expect(contact).toHaveBeenCalledOnce();
    expect(await operation()).toMatchObject({ status: "review_required", attempt_count: 2, provider_contact_id: null, last_error_code: "crm_reconcile:contact_create" });
  });

  test("real transactional audit failure rolls back intent before any HTTP", async () => {
    await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" ADD CONSTRAINT crm_test_intent_audit CHECK (action <> 'crm_effect_intent')`);
    const create = vi.spyOn(provider, "createContact");
    try {
      await runCrmSyncForCall(params());
      expect(create).not.toHaveBeenCalled();
      expect(await operation()).toMatchObject({ status: "retryable_failed", last_error_code: "crm_ready:contact_create" });
    } finally { await prisma.$executeRawUnsafe('ALTER TABLE "AuditLog" DROP CONSTRAINT crm_test_intent_audit'); }
  });
});
