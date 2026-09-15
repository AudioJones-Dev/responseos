import { beforeEach, describe, expect, test, vi } from "vitest";
import { consentAllowsCapture, metadataOnly } from "@/lib/callReview/consent";
import { ReviewPayloadSchema, reviewMessage } from "@/lib/callReview/contracts";
import { decideCallReview, dispatchCallReview, queueCallReview } from "@/lib/callReview/service";
import { PROSPECT_BOOTSTRAP_SCHEMA_VERSION } from "@/lib/prospectBootstrap/contracts";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), crm: vi.fn(), send: vi.fn(), gate: vi.fn(),
  db: {
    $transaction: vi.fn(), $executeRaw: vi.fn(),
    callReview: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    call: { findFirst: vi.fn() }, auditLog: { create: vi.fn() }, callCaptureSession: { findUnique: vi.fn() }, crmSyncOperation: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/db/client", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/lib/crm/syncFinalizedCall", () => ({ runCrmSyncForCall: mocks.crm }));
vi.mock("@/lib/providers/email", () => ({ getEmailProvider: () => ({ providerId: "resend", send: mocks.send }) }));
vi.mock("@/lib/agentExecution/supervisedRuntime", () => ({ supervisedExecutionAuthorized: mocks.gate }));

const payload = ReviewPayloadSchema.parse({ caller: "Fictional caller", phone: "+15555550199", interaction: "new_sales", product: "ramp", location: "Example city", summary: "Requested a ramp evaluation.", qualification: "qualified", outcome: "QUALIFIED_FREE_EVALUATION", urgency: "medium", callbackWindow: "Tomorrow afternoon", nextAction: "Call to discuss evaluation.", flags: [] });
const now = new Date();
const base = { id: "review", account_id: "account", call_id: "call", revision: 1, recipient: "owner@example.test", payload_json: payload, evidence_json: { transcript: "caller: I need a ramp", summary: "summary" }, status: "pending", dispatch_at: null, email_attempt_at: null, email_status: "pending" };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "operator", role: "operator" }, account: null });
  mocks.db.$transaction.mockImplementation((run) => run(mocks.db));
  mocks.db.callReview.findUnique.mockResolvedValue({ ...base });
  mocks.db.callReview.findFirst.mockResolvedValue({ ...base });
  mocks.db.callReview.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.call.findFirst.mockResolvedValue({ provider_call_id: "pc", transcript: "caller: I need a ramp", summary: "summary" });
  mocks.gate.mockResolvedValue(true);
  mocks.crm.mockResolvedValue({ ok: true, data: { status: "succeeded" } });
  mocks.send.mockResolvedValue({ providerMessageId: "email-1" });
});

describe("capture authorization", () => {
  const time = (seconds: number) => new Date(now.getTime() + seconds * 1000);
  test("silence and absent evidence authorize nothing", () => {
    expect(consentAllowsCapture([], time(1), time(3))).toBe(false);
    expect(consentAllowsCapture([{ action: "refuse", occurred_at: time(0) }], time(1), time(3))).toBe(false);
  });
  test("a later grant cannot authorize an earlier cumulative transcript", () => {
    expect(consentAllowsCapture([{ action: "grant", occurred_at: time(2) }], time(1), time(3))).toBe(false);
  });
  test("accepts only a wholly consented interval", () => {
    expect(consentAllowsCapture([{ action: "grant", occurred_at: time(0) }], time(1), time(3))).toBe(true);
  });
  test("withdrawal within capture invalidates a cumulative transcript, including after a regrant", () => {
    expect(consentAllowsCapture([{ action: "grant", occurred_at: time(0) }, { action: "withdraw", occurred_at: time(2) }, { action: "grant", occurred_at: time(3) }], time(1), time(4))).toBe(false);
  });
  test("a withdrawal sharing a timestamp with a grant wins the tie, whatever order the rows arrive in", () => {
    const grant = { action: "grant", occurred_at: time(0) };
    const withdraw = { action: "withdraw", occurred_at: time(0) };
    expect(consentAllowsCapture([grant, withdraw], time(1), time(3))).toBe(false);
    expect(consentAllowsCapture([withdraw, grant], time(1), time(3))).toBe(false);
    // A grant that is strictly later than the withdrawal still authorizes.
    expect(consentAllowsCapture([withdraw, { action: "grant", occurred_at: time(0.001) }], time(1), time(3))).toBe(true);
  });
  test("rejects invalid or reversed intervals", () => {
    expect(consentAllowsCapture([{ action: "grant", occurred_at: time(0) }], time(4), time(1))).toBe(false);
    expect(consentAllowsCapture([], new Date("invalid"), time(1))).toBe(false);
  });
  test("drops content even when hidden in nested provider results or metadata", () => {
    const result = metadataOnly({ data: { id: "event", event_type: "call.hangup", payload: { call_control_id: "call", transcript: "SECRET", result: { summary: "SECRET" }, metadata: { text: "SECRET" }, from: "SECRET", recording_url: "SECRET" } } });
    expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(result.data.payload.call_control_id).toBe("call");
  });
});

describe("review queueing", () => {
  const completedCall = { id: "call", account_id: "account", provider_call_id: "pc", review_required: true, status: "completed", from_number: "+15555550199", transcript: "caller: I need a ramp", summary: "summary" };
  const snapshot = { snapshot_id: "snap", snapshot_json: { schemaVersion: PROSPECT_BOOTSTRAP_SCHEMA_VERSION, bootstrapId: null, accountId: "account", generatedAt: now.toISOString(), businessProfile: [], services: [], locations: [], operatingHours: [], serviceAreas: [], faqs: [], policies: [], contactPaths: [], brandVoice: [], unknowns: [], conflicts: [], agentBoundaries: [], sourceManifest: [] } };
  beforeEach(() => {
    mocks.db.call.findFirst.mockResolvedValue(completedCall);
    mocks.db.callCaptureSession.findUnique.mockResolvedValue(snapshot);
    mocks.db.callReview.create.mockImplementation(async ({ data }) => data);
  });
  test("canonical evidence is read only after the revision lock is held", async () => {
    mocks.db.callReview.findFirst.mockResolvedValue(null);
    await queueCallReview("account", "call", { summary: "Requested a ramp evaluation." });
    const lock = mocks.db.$executeRaw.mock.invocationCallOrder[0];
    expect(mocks.db.call.findFirst.mock.invocationCallOrder[0]).toBeGreaterThan(lock);
    expect(mocks.db.callCaptureSession.findUnique.mock.invocationCallOrder[0]).toBeGreaterThan(lock);
  });
  test("a transcript-only late event preserves the earlier analysis", async () => {
    mocks.db.callReview.findFirst.mockResolvedValue({ ...base, revision: 1, source_hash: "older", dispatch_at: null });
    const created = await queueCallReview("account", "call", { transcript: "caller: I need a ramp, sorry, a vehicle lift" });
    expect(created).toMatchObject({ revision: 2, payload_json: expect.objectContaining({ summary: payload.summary, product: "ramp", qualification: "qualified", outcome: payload.outcome, phone: "+15555550199" }) });
    expect((created as unknown as { payload_json: { flags: string[] } }).payload_json.flags).toContain("This event carried no analysis; earlier analysis was preserved.");
  });
  test("a late event with new analysis overrides the earlier draft", async () => {
    mocks.db.callReview.findFirst.mockResolvedValue({ ...base, revision: 1, source_hash: "older", dispatch_at: null });
    const created = await queueCallReview("account", "call", { summary: "Corrected: vehicle lift.", product_path: "vehicle_lift" });
    expect(created).toMatchObject({ payload_json: expect.objectContaining({ summary: "Corrected: vehicle lift.", product: "vehicle_lift", qualification: "qualified" }) });
  });
});

describe("review authorization", () => {
  test("clients cannot approve or dispatch", async () => {
    mocks.session.mockResolvedValue({ user: { role: "client_admin" } });
    await expect(decideCallReview("review", 1, "approve", payload)).rejects.toThrow("operator_required");
    await expect(dispatchCallReview("review")).rejects.toThrow("operator_required");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  test("stale revisions never approve", async () => {
    mocks.db.callReview.findFirst.mockResolvedValue({ ...base, id: "newer", revision: 2 });
    await expect(decideCallReview("review", 1, "approve", payload)).rejects.toThrow("stale_review");
    expect(mocks.db.callReview.updateMany).not.toHaveBeenCalled();
  });
  test("approval takes the capture lock before the review lock", async () => {
    await decideCallReview("review", 1, "approve", payload);
    const lockKeys = mocks.db.$executeRaw.mock.calls.map((call) => call[1]);
    expect(lockKeys[0]).toBe("capture:account:pc");
    expect(lockKeys[1]).toBe("account:call");
  });
  test("approval records the reviewer but sends nothing", async () => {
    await decideCallReview("review", 1, "approve", payload);
    expect(mocks.db.callReview.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reviewer_user_id: "operator", payload_json: payload }) }));
    expect(mocks.crm).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  test("missing transcript prevents approval", async () => {
    mocks.db.call.findFirst.mockResolvedValue({ transcript: null });
    await expect(decideCallReview("review", 1, "approve", payload)).rejects.toThrow("stale_review");
  });
  test("pending and rejected records cannot dispatch", async () => {
    await expect(dispatchCallReview("review")).rejects.toThrow("approval_required");
    mocks.db.callReview.findUnique.mockResolvedValue({ ...base, status: "rejected" });
    await expect(dispatchCallReview("review")).rejects.toThrow("approval_required");
  });
});

function approved(overrides = {}) {
  const row = { ...base, status: "approved", ...overrides };
  mocks.db.callReview.findUnique.mockResolvedValue(row);
  mocks.db.callReview.findFirst.mockResolvedValueOnce(row).mockResolvedValueOnce(null);
}

test("CRM failure does not suppress the approved email", async () => {
  approved();
  mocks.crm.mockResolvedValue({ ok: false });
  await dispatchCallReview("review");
  expect(mocks.send).toHaveBeenCalledWith({ to: base.recipient, ...reviewMessage(payload, "call"), idempotencyKey: "review:review" });
});

test("a delivery-state write failure after provider acceptance records the acceptance, not a failure", async () => {
  approved();
  // update #1: crm_status; the fenced "sending" write is an updateMany; update #2 (after send): accepted → fails
  mocks.db.callReview.update.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("state_write_failed"));
  await expect(dispatchCallReview("review")).rejects.toThrow("state_write_failed");
  expect(mocks.send).toHaveBeenCalledTimes(1);
  expect(mocks.db.callReview.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { email_status: "accepted", email_message_id: "email-1" } }));
  expect(mocks.db.callReview.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: { email_status: "failed" } }));
  expect(mocks.db.auditLog.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "call_review_dispatch_outcome", metadata_json: expect.objectContaining({ outcome: "accepted", reconciliationRequired: true, providerMessageId: "email-1" }) }) }));
});

test("an abandoned dispatch claim is recovered after its TTL and audited as such", async () => {
  const abandonedAt = new Date(Date.now() - 20 * 60 * 1000);
  approved({ dispatch_at: abandonedAt });
  await dispatchCallReview("review");
  const claim = mocks.db.callReview.updateMany.mock.calls[0][0];
  expect(claim.where.OR).toEqual([{ dispatch_at: null }, { dispatch_at: { lte: expect.any(Date) } }]);
  expect(claim.where.OR[1].dispatch_at.lte.getTime()).toBeGreaterThan(abandonedAt.getTime());
  expect(mocks.db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "call_review_dispatch_attempt", metadata_json: expect.objectContaining({ recoveredStaleClaimFrom: abandonedAt.toISOString() }) }) }));
  expect(mocks.send).toHaveBeenCalledTimes(1);
});

test("a lost dispatch claim produces no effects", async () => {
  approved(); mocks.db.callReview.updateMany.mockResolvedValue({ count: 0 });
  await expect(dispatchCallReview("review")).rejects.toThrow("dispatch_in_progress_or_uncertain");
  expect(mocks.crm).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
});

test("a newer revision cannot dispatch over an earlier revision's unrecorded CRM effect", async () => {
  const newer = { ...base, id: "newer", revision: 2, status: "approved" };
  mocks.db.callReview.findUnique.mockResolvedValue(newer);
  mocks.db.callReview.findFirst.mockResolvedValueOnce(newer).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "review" }).mockResolvedValueOnce(null);
  mocks.db.crmSyncOperation.findUnique.mockResolvedValue({ provider_contact_id: "hs-contact", provider_activity_id: null, provider_task_id: null });
  await expect(dispatchCallReview("newer")).rejects.toThrow("prior_revision_requires_reconciliation");
  expect(mocks.db.callReview.updateMany).not.toHaveBeenCalled();
  expect(mocks.crm).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
});

test("a lost CRM status write is retried before the email is marked failed", async () => {
  approved();
  mocks.db.callReview.update.mockRejectedValueOnce(new Error("status_write_failed"));
  await expect(dispatchCallReview("review")).rejects.toThrow("status_write_failed");
  expect(mocks.db.callReview.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ crm_status: "pending" }), data: { crm_status: "succeeded" } }));
  expect(mocks.send).not.toHaveBeenCalled();
});

test("provider accepted emails are never resent", async () => {
  approved({ email_status: "accepted" });
  await dispatchCallReview("review"); expect(mocks.send).not.toHaveBeenCalled();
});

test("a revoked execution gate produces no effects", async () => {
  approved(); mocks.gate.mockResolvedValue(false);
  await expect(dispatchCallReview("review")).rejects.toThrow("execution_gate_not_authorized");
  expect(mocks.db.callReview.updateMany).not.toHaveBeenCalled();
  expect(mocks.crm).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
});

test("audit failure after provider acceptance cannot overwrite accepted delivery", async () => {
  approved();
  mocks.db.auditLog.create.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("audit_unavailable"));
  await expect(dispatchCallReview("review")).rejects.toThrow("audit_unavailable");
  expect(mocks.db.callReview.update).toHaveBeenCalledWith(expect.objectContaining({ data: { email_status: "accepted", email_message_id: "email-1" } }));
  expect(mocks.db.callReview.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ email_status: { not: "accepted" } }), data: { email_status: "accepted", email_message_id: "email-1" } }));
  expect(mocks.db.callReview.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: { email_status: "failed" } }));
  expect(mocks.db.auditLog.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "call_review_dispatch_outcome", metadata_json: expect.objectContaining({ outcome: "accepted", error: "audit_unavailable" }) }) }));
});

test("revocation during CRM dispatch prevents the later email effect", async () => {
  approved();
  mocks.gate.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  await expect(dispatchCallReview("review")).rejects.toThrow("execution_gate_not_authorized");
  expect(mocks.crm).toHaveBeenCalledOnce();
  expect(mocks.send).not.toHaveBeenCalled();
});

test("the dispatching operator is audited", async () => {
  approved();
  await dispatchCallReview("review");
  expect(mocks.db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "call_review_dispatch_attempt", actor_user_id: "operator" }) }));
  expect(mocks.db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "call_review_dispatch_outcome", metadata_json: expect.objectContaining({ outcome: "accepted" }) }) }));
});

test("old ambiguous email attempts require reconciliation", async () => {
  approved({ email_attempt_at: new Date(Date.now() - 25 * 60 * 60 * 1000) });
  await expect(dispatchCallReview("review")).rejects.toThrow("email_delivery_requires_reconciliation");
  expect(mocks.send).not.toHaveBeenCalled();
});

test("a CRM claim still held by another worker stops dispatch before the email", async () => {
  approved();
  mocks.crm.mockResolvedValue({ ok: true, data: { status: "processing" } });
  await expect(dispatchCallReview("review")).rejects.toThrow("crm_claim_in_progress");
  expect(mocks.db.callReview.update).toHaveBeenCalledWith(expect.objectContaining({ data: { crm_status: "processing" } }));
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.db.auditLog.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "call_review_dispatch_outcome", metadata_json: expect.objectContaining({ error: "crm_claim_in_progress" }) }) }));
  expect(mocks.db.callReview.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ dispatch_at: expect.any(Date) }), data: { dispatch_at: null } }));
});

test("a reclaimed worker never reaches the CRM, and the lost claim is audited as such", async () => {
  approved();
  // claim succeeds; the pre-CRM ownership fence finds another attempt's dispatch_at
  mocks.db.callReview.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValue({ count: 0 });
  await expect(dispatchCallReview("review")).rejects.toThrow("dispatch_claim_lost");
  expect(mocks.crm).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.db.auditLog.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "call_review_dispatch_outcome", metadata_json: expect.objectContaining({ outcome: "claim_lost" }) }) }));
});

test("a worker whose dispatch claim was reclaimed sends nothing and touches no other attempt's state", async () => {
  approved();
  // claim and the pre-CRM fence succeed; the fenced "sending" write does not
  mocks.db.callReview.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
  await expect(dispatchCallReview("review")).rejects.toThrow("dispatch_claim_lost");
  expect(mocks.send).not.toHaveBeenCalled();
  // Every write after the claim that could belong to another attempt (the
  // sending write, the failure downgrade, the release) carries the fence; the
  // call-wide crm_status write is the only one that does not need it.
  const fenced = mocks.db.callReview.updateMany.mock.calls.slice(1).map((call) => call[0]).filter((call) => !("crm_status" in call.where));
  // Pre-CRM ownership, the sending write, the failure downgrade, the release.
  expect(fenced).toHaveLength(4);
  for (const call of fenced) expect(call.where).toEqual(expect.objectContaining({ dispatch_at: expect.any(Date) }));
});

test("evidence that arrived while a dispatch was suspended stops it before the CRM", async () => {
  approved();
  // latest-revision check inside the claim passes; the recheck before the CRM
  // call sees the newer revision that late evidence created
  mocks.db.callReview.findFirst.mockReset();
  mocks.db.callReview.findFirst.mockResolvedValueOnce({ ...base, status: "approved" }).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "newer" });
  await expect(dispatchCallReview("review")).rejects.toThrow("stale_review");
  expect(mocks.crm).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});
