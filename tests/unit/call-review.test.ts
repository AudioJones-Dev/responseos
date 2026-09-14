import { beforeEach, describe, expect, test, vi } from "vitest";
import { consentAllowsCapture, metadataOnly } from "@/lib/callReview/consent";
import { ReviewPayloadSchema, reviewMessage } from "@/lib/callReview/contracts";
import { decideCallReview, dispatchCallReview } from "@/lib/callReview/service";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), crm: vi.fn(), send: vi.fn(), gate: vi.fn(),
  db: {
    $transaction: vi.fn(), $executeRaw: vi.fn(),
    callReview: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    call: { findFirst: vi.fn() }, auditLog: { create: vi.fn() },
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
  mocks.db.call.findFirst.mockResolvedValue({ transcript: "caller: I need a ramp", summary: "summary" });
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

test("a lost dispatch claim produces no effects", async () => {
  approved(); mocks.db.callReview.updateMany.mockResolvedValue({ count: 0 });
  await expect(dispatchCallReview("review")).rejects.toThrow("dispatch_in_progress_or_uncertain");
  expect(mocks.crm).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
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
  mocks.db.callReview.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
  await expect(dispatchCallReview("review")).rejects.toThrow("audit_unavailable");
  expect(mocks.db.callReview.update).toHaveBeenCalledWith(expect.objectContaining({ data: { email_status: "accepted", email_message_id: "email-1" } }));
  expect(mocks.db.callReview.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ email_status: { not: "accepted" } }) }));
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
