import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";
import { prisma, resetAndSeedTestDb, disconnectTestDb, setDevSession } from "./setup";
import { db } from "@/lib/db/client";
import { POST } from "@/app/api/admin/call-capture/[id]/consent/route";
import { POST as endPost } from "@/app/api/admin/call-capture/[id]/end-call/route";
import { recordWebhookEvent } from "@/lib/data/webhookEvents";
import { ingestCallControlEvent } from "@/lib/callControl/service";
import { parseCallControlEvent } from "@/lib/providers/telnyx/callControl";
import { loadCallReviewConsole } from "@/lib/callReview/service";
import { persistWithdrawalReceipt, withdrawalReceiptDb } from "@/lib/callReview/withdrawalReceipt";

const send = vi.hoisted(() => { vi.resetModules(); return vi.fn(); });
vi.mock("@/lib/providers/telnyx/callControl", async original => ({ ...await original<typeof import("@/lib/providers/telnyx/callControl")>(), sendTelnyxCallCommand: send }));
beforeEach(async () => { await resetAndSeedTestDb(); setDevSession("operator"); send.mockReset().mockResolvedValue({ ok: true, status: 200, providerDate: new Date(), conversationId: "synthetic-conversation", errorCode: null }); vi.stubGlobal("fetch", vi.fn(() => { throw Error("external effect forbidden"); })); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
afterAll(async () => { await withdrawalReceiptDb?.$disconnect(); await disconnectTestDb(); vi.doUnmock("@/lib/providers/telnyx/callControl"); vi.resetModules(); });
function barrier() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
async function fixture() {
  const account = await prisma.account.findFirstOrThrow();
  const assignment = await prisma.telephonyNumberAssignment.create({ data: { account_id: account.id, telephony_number_id: randomUUID(), provider_assistant_id: "synthetic-assistant", status: "qualification" } });
  const capture = await prisma.callCaptureSession.create({ data: { account_id: account.id, provider_call_id: randomUUID(), assignment_id: assignment.id, snapshot_id: "synthetic", snapshot_json: {}, call_session_id: randomUUID(), call_leg_id: randomUUID(), control_state: "CONSENT_PENDING_OPERATOR", dtmf_decision: "affirmative" } });
  const proofId = randomUUID(), clientState = Buffer.from(JSON.stringify({ captureId: capture.id, generation: capture.generation })).toString("base64");
  const body = JSON.stringify({ data: { id: proofId, event_type: "call.gather.ended", occurred_at: new Date().toISOString(), payload: { call_control_id: capture.provider_call_id, call_session_id: capture.call_session_id, call_leg_id: capture.call_leg_id, client_state: clientState, status: "valid", digits: "1" } } });
  const saved = await recordWebhookEvent({ account_id: account.id, provider: "telnyx", provider_call_id: capture.provider_call_id, provider_event_id: proofId, event_type: "call.gather.ended", raw_body: body, verifiedBytes: Buffer.from(body), signature_valid: true });
  if (!saved.ok) throw Error(saved.error.code);
  await prisma.callCaptureSession.update({ where: { id: capture.id }, data: { dtmf_event_id: proofId } });
  const eventKey = randomUUID(), fields = { disclosureRef: "synthetic", evidenceRef: "synthetic", jurisdictionBasis: "synthetic" };
  const post = (action: "grant" | "withdraw" = "grant") => POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ action, ...fields, eventKey: action === "grant" ? eventKey : "00000000-0000-4000-8000-000000000099" }) }), { params: Promise.resolve({ id: capture.id }) });
  const receipt = () => persistWithdrawalReceipt(capture, "user_operator_mock", { ...fields, eventKey: "synthetic-receipt" });
  const end = () => endPost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ expectedAccountId: account.id, expectedProviderCallId: capture.provider_call_id, generation: capture.generation }) }), { params: Promise.resolve({ id: capture.id }) });
  return { capture, assignment, proofId: saved.data.id, clientState, post, receipt, end };
}
function afterClaim(effect: () => Promise<void>) {
  if (!db) throw Error("database_unavailable");
  const original = db.$transaction.bind(db);
  const spy = vi.spyOn(db, "$transaction").mockImplementation((async (...args: unknown[]) => {
    const result = await Reflect.apply(original, db, args);
    if (result && typeof result === "object" && "phase" in result && result.phase === "claimed") { spy.mockRestore(); await effect(); }
    return result;
  }) as typeof db.$transaction);
}

test("successful start consumes one exact attempt and duplicates only read its result", async () => {
  const f = await fixture();
  expect((await f.post()).status).toBe(200); expect((await f.post()).status).toBe(200);
  expect(send).toHaveBeenCalledTimes(1);
  const command = await prisma.telnyxCallCommand.findFirstOrThrow({ where: { command_type: "ai_assistant_start" } });
  expect(command).toMatchObject({ account_id: f.capture.account_id, capture_session_id: f.capture.id, assignment_id: f.assignment.id, generation: 1, provider_resource: f.capture.provider_call_id, status: "succeeded" });
  expect(await prisma.auditLog.findFirstOrThrow({ where: { action: "ai_start_attempt_consumed" } })).toMatchObject({ actor_type: "user", metadata_json: { commandId: command.command_id, authority: "conditional_one_shot_presend_veto", call_session_id: f.capture.call_session_id, call_leg_id: f.capture.call_leg_id } });
});

test.each(["timeout", "throw", "400", "500", "missing_date", "missing_conversation"])("%s consumes the start permanently", async kind => {
  const f = await fixture();
  if (kind === "throw") send.mockRejectedValueOnce(Error("synthetic_lost_response"));
  else send.mockResolvedValueOnce({ status: kind === "timeout" ? 0 : kind === "400" ? 400 : kind === "500" ? 500 : 200, ok: kind.startsWith("missing"), providerDate: kind === "missing_date" ? null : new Date(), conversationId: kind === "missing_conversation" ? null : "synthetic", errorCode: "synthetic_uncertain" });
  expect((await f.post()).status).toBe(409); expect((await f.post()).status).toBe(409); expect(send).toHaveBeenCalledTimes(1);
  expect(await prisma.telnyxCallCommand.count({ where: { command_type: "ai_assistant_start" } })).toBe(1);
});

test("lost claim commit acknowledgement consumes the attempt without sending or retrying", async () => {
  const f = await fixture(); afterClaim(async () => { throw Error("synthetic_claim_commit_ack_lost"); });
  expect((await f.post()).status).toBe(409); expect((await f.post()).status).toBe(409); expect(send).not.toHaveBeenCalled();
  expect(await prisma.telnyxCallCommand.findFirstOrThrow()).toMatchObject({ status: "uncertain", reconciliation_state: "ai_start_attempt_consumed" });
});

test.each(["receipt", "generation", "call", "session", "leg", "assistant", "assignment", "grant", "snapshot", "proof", "read_failure", "end_call"])("fresh %s veto after claim consumes without dispatch", async kind => {
  const f = await fixture(); let reached = false;
  afterClaim(async () => {
    reached = true;
    if (kind === "receipt") await f.receipt();
    else if (kind === "assistant") await prisma.telephonyNumberAssignment.update({ where: { id: f.assignment.id }, data: { provider_assistant_id: "changed" } });
    else if (kind === "assignment") await prisma.telephonyNumberAssignment.update({ where: { id: f.assignment.id }, data: { unassigned_at: new Date() } });
    else if (kind === "grant") await prisma.callConsentEvent.updateMany({ where: { provider_call_id: f.capture.provider_call_id }, data: { evidence_ref: "changed" } });
    else if (kind === "proof") await prisma.webhookEvent.update({ where: { id: f.proofId }, data: { payload_erasure_required_at: new Date() } });
    else if (kind === "read_failure") vi.spyOn(db!.callCaptureSession, "findUnique").mockRejectedValueOnce(Error("synthetic_read_failure"));
    else if (kind === "end_call") expect((await f.end()).status).toBe(202);
    else await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: kind === "generation" ? { generation: 2 } : kind === "call" ? { provider_call_id: randomUUID() } : kind === "session" ? { call_session_id: "changed" } : kind === "leg" ? { call_leg_id: "changed" } : { snapshot_id: "changed" } });
  });
  expect((await f.post()).status).toBe(409); expect(reached).toBe(true);
  expect(send.mock.calls.filter(([command]) => command.action === "ai_assistant_start")).toHaveLength(0);
  expect(await prisma.telnyxCallCommand.findFirstOrThrow({ where: { command_type: "ai_assistant_start" } })).toMatchObject({ status: "failed", reconciliation_state: "ai_start_consumed_without_send" });
  await f.post(); expect(send.mock.calls.filter(([command]) => command.action === "ai_assistant_start")).toHaveLength(0);
});

test("result identity mutation fails closed and cannot release the consumed claim", async () => {
  const f = await fixture();
  send.mockImplementationOnce(async () => { await prisma.telnyxCallCommand.updateMany({ where: { capture_session_id: f.capture.id }, data: { provider_resource: "changed" } }); return { ok: true, status: 200, providerDate: new Date(), conversationId: "synthetic", errorCode: null }; });
  expect((await f.post()).status).toBe(409); expect((await f.post()).status).toBe(409); expect(send).toHaveBeenCalledTimes(1);
  expect(await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).toMatchObject({ conversation_id: null });
});

test.each(["intent_recorded", "uncertain", "failed"] as const)("legacy %s start row is never adopted as new authority", async status => {
  const f = await fixture();
  await prisma.telnyxCallCommand.create({ data: { account_id: f.capture.account_id, capture_session_id: f.capture.id, assignment_id: f.assignment.id, generation: 1, command_type: "ai_assistant_start", command_id: randomUUID(), provider_resource: f.capture.provider_call_id, request_json: {}, status } });
  expect((await f.post()).status).toBe(409); expect(send).not.toHaveBeenCalled();
});

test("stalled start retains no transaction and cannot block withdrawal or eligible exact End call", async () => {
  const f = await fixture(), entered = barrier(), release = barrier();
  send.mockImplementation(async ({ action }: { action: string }) => { if (action === "ai_assistant_start") { entered.resolve(); await release.promise; } return { ok: true, status: 200, providerDate: new Date(), conversationId: action === "ai_assistant_start" ? "synthetic" : null, errorCode: null }; });
  const pending = f.post(); await entered.promise;
  try {
    const [locks] = await prisma.$queryRaw<{ transactions: bigint }[]>`SELECT count(*) AS transactions FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND xact_start IS NOT NULL`;
    expect(Number(locks.transactions)).toBe(0);
    expect((await f.post()).status).toBe(409);
    const withdrawal = await f.post("withdraw"); expect(withdrawal.status).toBe(200);
    expect(await withdrawal.json()).toMatchObject({ withdrawal: { receipt: "recorded", drain: "confirmed", providerCessationConfirmed: false } });
    expect((await f.end()).status).toBe(202);
    const raw = JSON.stringify({ data: { id: randomUUID(), event_type: "call.hangup", occurred_at: new Date().toISOString(), payload: { call_control_id: f.capture.provider_call_id, call_session_id: f.capture.call_session_id, call_leg_id: f.capture.call_leg_id, client_state: f.clientState } } });
    await ingestCallControlEvent({ verifiedBytes: Buffer.from(raw), event: parseCallControlEvent(raw)!, rawBody: raw, signature: "synthetic" });
    expect((await loadCallReviewConsole()).captures.find(c => c.id === f.capture.id)?.disconnection.confirmed).toBe(true);
  } finally { release.resolve(); }
  expect((await pending).status).toBe(409);
  const closed = await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } });
  expect(closed).toMatchObject({ control_state: "STOPPED", conversation_id: null }); expect(closed.call_disconnected_at).not.toBeNull(); expect(closed.withdrawal_drained_at).not.toBeNull();
  expect(send.mock.calls.map(([command]) => command.action)).toEqual(["ai_assistant_start", "ai_assistant_stop", "hangup"]);
  expect((await f.post()).status).toBe(503); expect(send).toHaveBeenCalledTimes(3);
});

test("a receipt arriving at transport entry remains a residual race, never permission to reopen consent", async () => {
  const f = await fixture();
  send.mockImplementationOnce(async () => { await f.receipt(); return { ok: true, status: 200, providerDate: new Date(), conversationId: "synthetic-late", errorCode: null }; });
  expect((await f.post()).status).toBe(409); expect(send).toHaveBeenCalledTimes(1);
  expect(await prisma.callWithdrawalReceipt.count()).toBe(1);
  expect(await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).toMatchObject({ conversation_id: null });
});

test.each(["client_admin@org_mock_1", "client_viewer@org_mock_1", "anonymous"])("%s cannot consume or dispatch AI start", async role => {
  const f = await fixture();
  if (role === "anonymous") { delete process.env.RESPONSEOS_DEV_SESSION; process.env.RESPONSEOS_REQUIRE_AUTH = "true"; } else setDevSession(role);
  try { expect((await f.post()).status).toBe(403); } finally { delete process.env.RESPONSEOS_REQUIRE_AUTH; }
  expect(await prisma.telnyxCallCommand.count()).toBe(0); expect(send).not.toHaveBeenCalled();
});
