import { createHash, createHmac, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";
import { prisma, resetAndSeedTestDb, disconnectTestDb, setDevSession } from "./setup";
import { db } from "@/lib/db/client";
import { recordWebhookEvent } from "@/lib/data/webhookEvents";
import { persistWithdrawalReceipt, withdrawalReceiptDb } from "@/lib/callReview/withdrawalReceipt";
import { beginGrokHandoff, acceptGrokIncoming, claimGrokWorker, heartbeatGrok, requestGrokStop, dispatchGrokTermination, watchdogGrokSweep } from "@/lib/grok/service";
import { POST as consentPost } from "@/app/api/admin/call-capture/[id]/consent/route";
import { POST as endPost } from "@/app/api/admin/call-capture/[id]/end-call/route";
import { GET as statusGet } from "@/app/api/admin/call-capture/[id]/grok/route";
import { POST as incomingPost } from "@/app/api/webhooks/xai/sip/route";

const transport = vi.hoisted(() => ({ handoff: vi.fn(), terminate: vi.fn(), verify: vi.fn(), qualified: vi.fn() }));
vi.mock("@/lib/grok/provider", async original => ({ ...await original<typeof import("@/lib/grok/provider")>(), assertGrokQualified: transport.qualified, handoffToGrok: transport.handoff, terminateGrokCall: transport.terminate, verifyIncomingSip: transport.verify }));
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const syntheticMac = (s: string) => createHmac("sha256", "local-test-only-not-provider-signing").update(s).digest("hex");
beforeEach(async () => {
  await resetAndSeedTestDb(); setDevSession("operator");
  transport.qualified.mockReset(); transport.handoff.mockReset().mockResolvedValue("accepted"); transport.terminate.mockReset().mockResolvedValue("accepted");
  transport.verify.mockReset().mockImplementation(async (raw: string, headers: Headers) => {
    if (headers.get("x-synthetic-signature") !== syntheticMac(raw)) throw Error("unverified_fixture");
    const payload = JSON.parse(raw);
    return { ...payload, bodyDigest: hash(raw) };
  });
  vi.stubGlobal("fetch", vi.fn(() => { throw Error("network_forbidden"); }));
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
afterAll(async () => { await withdrawalReceiptDb?.$disconnect(); await disconnectTestDb(); vi.doUnmock("@/lib/grok/provider"); vi.resetModules(); });
async function fixture() {
  const account = await prisma.account.findFirstOrThrow();
  const assignment = await prisma.telephonyNumberAssignment.create({ data: { account_id: account.id, telephony_number_id: randomUUID(), provider_assistant_id: "fixture", status: "qualification" } });
  const capture = await prisma.callCaptureSession.create({ data: { account_id: account.id, provider_call_id: randomUUID(), assignment_id: assignment.id, snapshot_id: "fixture", snapshot_json: {}, call_session_id: randomUUID(), call_leg_id: randomUUID(), control_state: "START_PENDING", dtmf_decision: "affirmative", disclosure_completed_at: new Date() } });
  const proofId = randomUUID();
  const body = JSON.stringify({ data: { id: proofId, event_type: "call.gather.ended", occurred_at: new Date().toISOString(), payload: { call_control_id: capture.provider_call_id, call_session_id: capture.call_session_id, call_leg_id: capture.call_leg_id, status: "valid", digits: "1", client_state: Buffer.from(JSON.stringify({ captureId: capture.id, generation: capture.generation })).toString("base64") } } });
  const proof = await recordWebhookEvent({ account_id: account.id, provider: "telnyx", provider_call_id: capture.provider_call_id, provider_event_id: proofId, event_type: "call.gather.ended", raw_body: body, verifiedBytes: Buffer.from(body), signature_valid: true });
  if (!proof.ok) throw Error("fixture_proof_failed");
  await prisma.callCaptureSession.update({ where: { id: capture.id }, data: { dtmf_event_id: proofId } });
  await prisma.callConsentEvent.create({ data: { account_id: account.id, provider_call_id: capture.provider_call_id, event_key: randomUUID(), action: "grant", artifact: "transcript", disclosure_ref: "fixture", evidence_ref: "fixture", jurisdiction_basis: "fixture", source_channel: "call", actor_user_id: "user_operator_mock" } });
  return { capture, receipt: () => persistWithdrawalReceipt(capture, "user_operator_mock", { eventKey: randomUUID(), disclosureRef: "fixture", evidenceRef: "fixture", jurisdictionBasis: "fixture" }) };
}
function incoming(token: string, overrides = {}) {
  const raw = JSON.stringify({ eventId: randomUUID(), callId: randomUUID(), correlationToken: token, ...overrides });
  return { raw, headers: new Headers({ "x-synthetic-signature": syntheticMac(raw) }) };
}
async function bound() {
  const f = await fixture(); const started = await beginGrokHandoff(f.capture);
  const message = incoming(transport.handoff.mock.calls.at(-1)![1]);
  await acceptGrokIncoming(message.raw, message.headers);
  return { ...f, id: started.sessionId, message };
}
function afterCommit(effect: () => Promise<unknown>) {
  const original = db!.$transaction.bind(db!);
  const spy = vi.spyOn(db!, "$transaction").mockImplementation((async (...args: unknown[]) => {
    const result = await Reflect.apply(original, db!, args);
    if (result && typeof result === "object" && "command" in result && "session" in result) { spy.mockRestore(); await effect(); }
    return result;
  }) as NonNullable<typeof db>["$transaction"]);
}

test("atomic concurrent grants consume exactly one durable handoff with actor audit", async () => {
  const f = await fixture();
  const results = await Promise.allSettled([beginGrokHandoff(f.capture), beginGrokHandoff(f.capture)]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(transport.handoff).toHaveBeenCalledTimes(1);
  expect(await prisma.grokCallSession.count()).toBe(1);
  expect(await prisma.grokCallCommand.count({ where: { kind: "handoff" } })).toBe(1);
  expect(await prisma.auditLog.count({ where: { action: "grok_handoff_consumed" } })).toBe(1);
});

test.each(["account_id", "generation", "provider_call_id", "call_leg_id", "call_session_id", "assignment_id"] as const)("rejects stale or cross-call %s before claim", async key => {
  const f = await fixture();
  await expect(beginGrokHandoff({ ...f.capture, [key]: key === "generation" ? 2 : "other" })).rejects.toThrow();
  expect(await prisma.grokCallSession.count()).toBe(0); expect(transport.handoff).not.toHaveBeenCalled();
});

test("missing disclosure or consent cannot authorize handoff", async () => {
  const f = await fixture();
  await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { disclosure_completed_at: null } });
  await expect(beginGrokHandoff(f.capture)).rejects.toThrow("disclosure_completion_required");
  expect(transport.handoff).not.toHaveBeenCalled();
});

test("withdrawal committed after claim vetoes send without releasing claim", async () => {
  const f = await fixture(); afterCommit(f.receipt);
  await expect(beginGrokHandoff(f.capture)).rejects.toThrow("grok_presend_veto");
  await expect(beginGrokHandoff(f.capture)).rejects.toThrow("grok_handoff_consumed");
  expect(transport.handoff).not.toHaveBeenCalled();
  expect((await prisma.grokCallSession.findFirstOrThrow()).stopped_at).not.toBeNull();
});

test("lost claim commit acknowledgement permits no later resend", async () => {
  const f = await fixture(); afterCommit(async () => { throw Error("lost_commit_ack"); });
  await expect(beginGrokHandoff(f.capture)).rejects.toThrow("lost_commit_ack");
  await expect(beginGrokHandoff(f.capture)).rejects.toThrow("grok_handoff_consumed");
  expect(transport.handoff).not.toHaveBeenCalled();
});

test.each(["uncertain", "failed", "disabled"])("%s result consumes handoff and requests termination", async result => {
  const f = await fixture(); transport.handoff.mockResolvedValue(result);
  await beginGrokHandoff(f.capture);
  await expect(beginGrokHandoff(f.capture)).rejects.toThrow("grok_handoff_consumed");
  expect(transport.handoff).toHaveBeenCalledTimes(1);
  expect((await prisma.grokCallSession.findFirstOrThrow()).stopped_at).not.toBeNull();
});

test("unverified incoming delivery cannot bind or create evidence", async () => {
  const f = await fixture(); await beginGrokHandoff(f.capture);
  const message = incoming(transport.handoff.mock.calls[0][1]);
  await expect(acceptGrokIncoming(message.raw, new Headers())).rejects.toThrow("unverified_fixture");
  expect(await prisma.grokIncomingReceipt.count()).toBe(0);
  expect((await prisma.grokCallSession.findFirstOrThrow()).xai_call_id).toBeNull();
});

test("authenticated fixture must match server correlation; caller account claims ignored", async () => {
  const f = await fixture(); await beginGrokHandoff(f.capture);
  const wrong = incoming("a".repeat(64), { account_id: f.capture.account_id });
  await expect(acceptGrokIncoming(wrong.raw, wrong.headers)).rejects.toThrow("grok_correlation_unknown");
  const right = incoming(transport.handoff.mock.calls[0][1], { account_id: "attacker" });
  await acceptGrokIncoming(right.raw, right.headers);
  expect((await prisma.grokCallSession.findFirstOrThrow()).account_id).toBe(f.capture.account_id);
});

test("duplicates are idempotent, conflicting replay and xAI retargeting are denied", async () => {
  const f = await bound();
  await acceptGrokIncoming(f.message.raw, f.message.headers);
  expect(await prisma.grokIncomingReceipt.count()).toBe(1);
  const changed = incoming(transport.handoff.mock.calls[0][1], { ...JSON.parse(f.message.raw), extra: "conflict" });
  await expect(acceptGrokIncoming(changed.raw, changed.headers)).rejects.toThrow("grok_replay_conflict");
  const retarget = incoming(transport.handoff.mock.calls[0][1]);
  await expect(acceptGrokIncoming(retarget.raw, retarget.headers)).rejects.toThrow("grok_call_retarget_denied");
});

test("late binding after withdrawal is retained solely for exact termination", async () => {
  const f = await fixture(); const started = await beginGrokHandoff(f.capture); await f.receipt();
  const message = incoming(transport.handoff.mock.calls[0][1]);
  expect(await acceptGrokIncoming(message.raw, message.headers)).toMatchObject({ stopped: true, disconnectionConfirmed: false });
  await expect(claimGrokWorker(started.sessionId)).rejects.toThrow("grok_worker_not_eligible");
  await dispatchGrokTermination(started.sessionId);
  expect(transport.terminate.mock.calls.map(c => [c[0], c[1]])).toEqual([["telnyx", f.capture.provider_call_id], ["xai", JSON.parse(message.raw).callId]]);
});

test("concurrent watchdog and operator dispatch consume each termination once", async () => {
  const f = await bound(); await requestGrokStop(f.id, "withdrawal");
  await Promise.all([dispatchGrokTermination(f.id), dispatchGrokTermination(f.id), watchdogGrokSweep()]);
  expect(transport.terminate).toHaveBeenCalledTimes(2);
  const response = await statusGet(new Request("http://localhost"), { params: Promise.resolve({ id: f.capture.id }) });
  expect((await response.json()).data.disconnectionConfirmed).toBe(false);
});

test("expired worker cannot renew, acquire replacement ownership or reopen stopped session", async () => {
  const f = await bound(), claimed = await claimGrokWorker(f.id);
  await prisma.grokCallSession.update({ where: { id: f.id }, data: { lease_expires_at: new Date(0) } });
  expect(await heartbeatGrok(f.id, claimed.session.worker_token!)).toBe(false);
  await expect(claimGrokWorker(f.id)).rejects.toThrow("grok_worker_not_eligible");
  await expect(prisma.grokCallSession.update({ where: { id: f.id }, data: { stopped_at: null } })).rejects.toThrow();
  await expect(prisma.grokCallSession.update({ where: { id: f.id }, data: { xai_call_id: randomUUID() } })).rejects.toThrow();
});

test("stalled handoff holds no database lock against independent withdrawal/watchdog", async () => {
  const f = await fixture(); let release!: () => void; let entered!: () => void;
  const ready = new Promise<void>(r => { entered = r; }); const stalled = new Promise<void>(r => { release = r; });
  transport.handoff.mockImplementation(async () => { entered(); await stalled; return "accepted"; });
  const pending = beginGrokHandoff(f.capture); await ready;
  try { await f.receipt(); await watchdogGrokSweep(); expect(transport.terminate).toHaveBeenCalledTimes(1); }
  finally { release(); }
  await pending;
  expect((await prisma.grokCallSession.findFirstOrThrow()).stopped_at).not.toBeNull();
});

test("actual consent route selects Grok without issuing Telnyx assistant start", async () => {
  const f = await fixture();
  await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { control_state: "CONSENT_PENDING_OPERATOR" } });
  vi.stubEnv("RESPONSEOS_VOICE_ENGINE", "grok-voice-3.0");
  const response = await consentPost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ action: "grant", eventKey: randomUUID(), disclosureRef: "fixture", evidenceRef: "fixture", jurisdictionBasis: "fixture" }) }), { params: Promise.resolve({ id: f.capture.id }) });
  expect(response.status).toBe(200); expect(transport.handoff).toHaveBeenCalledTimes(1);
  expect(await prisma.telnyxCallCommand.count({ where: { command_type: "ai_assistant_start" } })).toBe(0);
});

test("operator End call rejects stale generation; client and anonymous cannot inspect or terminate", async () => {
  const f = await bound();
  const request = (generation: number) => new Request("http://localhost", { method: "POST", body: JSON.stringify({ expectedAccountId: f.capture.account_id, expectedProviderCallId: f.capture.provider_call_id, generation }) });
  const params = { params: Promise.resolve({ id: f.capture.id }) };
  expect((await endPost(request(2), params)).status).toBe(409);
  setDevSession("client_admin"); expect((await endPost(request(1), params)).status).toBe(403); expect((await statusGet(new Request("http://localhost"), params)).status).toBe(403);
  setDevSession("none"); expect((await endPost(request(1), params)).status).toBe(403);
  setDevSession("operator"); expect((await endPost(request(1), params)).status).toBe(202);
  expect(transport.terminate).toHaveBeenCalledTimes(2);
});

test("ingestion route rejects oversized body and unauthenticated fixture", async () => {
  expect((await incomingPost(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(65537) }))).status).toBe(413);
  expect((await incomingPost(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }))).status).toBe(503);
});

test("separate real watchdog process consumes durable hangups after heartbeat process death", async () => {
  const f = await bound(), claim = await claimGrokWorker(f.id);
  const tsx = path.resolve("node_modules/tsx/dist/cli.mjs");
  const worker = spawn(process.execPath, [tsx, "tests/integration/fixtures/grok-heartbeat-worker.ts", f.id, claim.session.worker_token!], { stdio: ["ignore", "pipe", "pipe"], env: process.env });
  try {
    await once(worker.stdout, "data");
    const exited = once(worker, "exit"); worker.kill(); await exited;
    await prisma.grokCallSession.update({ where: { id: f.id }, data: { lease_expires_at: new Date(0) } });
    const watcher = spawnSync(process.execPath, [tsx, "scripts/grok-watchdog.ts"], { env: { ...process.env, RESPONSEOS_GROK_WATCHDOG_ENABLED: "true" }, encoding: "utf8", timeout: 15000 });
    expect(watcher.status, watcher.stderr).toBe(0);
    expect((await prisma.grokCallSession.findUniqueOrThrow({ where: { id: f.id } })).stopped_at).not.toBeNull();
    const commands = await prisma.grokCallCommand.findMany({ where: { session_id: f.id, kind: { endsWith: "hangup" } } });
    expect(commands).toHaveLength(2); expect(commands.every(c => c.status === "disabled" && c.consumed_at)).toBe(true);
    expect(transport.terminate).not.toHaveBeenCalled();
  } finally { if (worker.exitCode === null && worker.signalCode === null) worker.kill(); }
});
