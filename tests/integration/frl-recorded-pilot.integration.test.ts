import { randomUUID, generateKeyPairSync, sign } from "node:crypto";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { decidePilotAdmission, ingestPilot, dispatchPilot, purgePilotContent, killPilotWindow } from "@/lib/communications/pilot/store";
import { latest, type PilotState, type Purpose, type Role } from "@/lib/communications/pilot/machine";
import { stateToken, type PilotTransport } from "@/lib/providers/telnyx/pilot";
import type { TelnyxWebhookEnvelope } from "@/lib/providers/telnyx/webhook";
import { testPilotConfig, callerLeg, operatorLeg } from "../fixtures/frl-pilot";
import { makeAccount } from "../factories";
import { prisma, resetTestDb, disconnectTestDb } from "./setup";
import { deletePilotArtifacts } from "@/lib/communications/pilot/deletion";

let now: number, c: ReturnType<typeof testPilotConfig>;
const enabled = { RESPONSEOS_FRL_PILOT_ENABLED: "true", RESPONSEOS_REQUIRE_AUTH: "true", RESPONSEOS_FRL_PILOT_DEPLOYMENT_ID: "synthetic-pilot", DATABASE_URL: process.env.DATABASE_URL };
const transport = vi.fn<PilotTransport>(async (_request, dial) => dial ? { kind: "accepted", leg: operatorLeg } : { kind: "accepted" });
async function state(): Promise<PilotState> { return (await prisma.frlPilotRun.findFirstOrThrow({ where: { account_id: c.accountId } })).state_json as unknown as PilotState; }
function event(type: string, payload: Record<string, unknown> = {}, role: Role = "caller"): TelnyxWebhookEnvelope {
  const l = role === "caller" ? callerLeg : operatorLeg;
  return { data: { id: randomUUID(), event_type: type, occurred_at: new Date(now).toISOString(), payload: {
    call_control_id: l.controlId, call_leg_id: l.legId, call_session_id: l.sessionId, connection_id: c.applicationId, ...payload,
  } } };
}
async function ingest(e: TelnyxWebhookEnvelope) { return ingestPilot(prisma, c, e, JSON.stringify(e), now, enabled); }
async function dispatch() { return dispatchPilot(prisma, c, transport, now, enabled); }
async function callback(type: string, purpose: Purpose, role: Role = "caller", payload: Record<string, unknown> = {}) {
  const s = await state(); now += 100;
  return ingest(event(type, { client_state: stateToken(s.id, latest(s, purpose)!.id), ...payload }, role));
}
async function start() {
  await ingest(event("call.initiated", { from: c.callers[0], to: c.number, direction: "incoming" }));
  await decidePilotAdmission(prisma, c, "synthetic-operator", (await state()).id, true, now, enabled);
  await dispatch(); await callback("call.answered", "answer"); await dispatch();
}
async function fullBridge(callerDigit = "1", operatorDigit = "1") {
  await start(); await callback("call.gather.ended", "caller_consent", "caller", { digits: callerDigit, status: "valid" }); await dispatch();
  if (callerDigit === "1") {
    await callback("call.speak.ended", "name_prompt", "caller", { status: "completed" }); await dispatch();
    const s = await state(); const w = s.windows[0]; now += 9000;
    await callback("call.recording.saved", "name", "caller", { recording_id: randomUUID(), recording_started_at: new Date(w.authorizedAt + 100).toISOString(), recording_ended_at: new Date(w.authorizedAt + 8000).toISOString(), channels: "single" }); await dispatch();
  }
  await callback("call.speak.ended", "hold", "caller", { status: "completed" }); await dispatch();
  await callback("call.answered", "dial", "operator"); await dispatch();
  await callback("call.gather.ended", "operator_consent", "operator", { digits: operatorDigit, status: "valid" }); await dispatch();
  await callback("call.bridged", "bridge");
  await callback("call.bridged", "operator_consent", "operator"); await dispatch();
}

describe("durable recorded pilot", () => {
  beforeEach(async () => {
    await resetTestDb(); now = Date.now(); c = testPilotConfig(now); transport.mockClear();
    transport.mockImplementation(async (_request, dial) => dial ? { kind: "accepted", leg: operatorLeg } : { kind: "accepted" });
    await prisma.account.create({ data: makeAccount({ id: c.accountId }) });
  });
  afterAll(disconnectTestDb);
  test("a rotating caller waits for exact-call approval and cannot replay approval", async () => {
    await ingest(event("call.initiated", { from: "+13055550999", to: c.number, direction: "incoming" }));
    await dispatch(); expect(transport).not.toHaveBeenCalled();
    const s = await state(); expect(s.stage).toBe("pending");
    expect(await decidePilotAdmission(prisma, { ...c, accountId: "foreign" }, "op", s.id, true, now, enabled)).toBe(false);
    expect(await decidePilotAdmission(prisma, c, "op", s.id, true, now, enabled)).toBe(true);
    expect(await decidePilotAdmission(prisma, c, "op", s.id, true, now, enabled)).toBe(false);
    await dispatch(); expect(transport).toHaveBeenCalledTimes(1);
    expect((await state()).admission?.caller).toBe("<PURGED>");
  });
  test("expired and rejected candidates never answer; competing calls cannot enter", async () => {
    await ingest(event("call.initiated", { from: c.callers[0], to: c.number, direction: "incoming" }));
    const s = await state();
    await ingest(event("call.initiated", { call_control_id: "other", call_leg_id: "other", from: "+13055550999", to: c.number, direction: "incoming" }));
    expect(await prisma.frlPilotRun.count()).toBe(1);
    now = s.deadline;
    expect(await decidePilotAdmission(prisma, c, "op", s.id, true, now, enabled)).toBe(false);
    await dispatch(); expect(transport.mock.calls[0][0].path).toContain("hangup");
  });
  test("keypad commissioning observes digits without grants, recordings or operator dialing", async () => {
    c.exercise = "keypad"; await start();
    for (const digit of ["1", "2", "*"]) await callback("call.dtmf.received", "keypad", "caller", { digit });
    await dispatch();
    expect((await state()).digits).toEqual(["1", "2", "*"]);
    expect((await state()).grants).toEqual([]);
    expect(transport.mock.calls.every(([r]) => /\/(answer|speak|hangup)$/.test(r.path))).toBe(true);
    expect(await prisma.frlPilotArtifact.count()).toBe(0);
  });
  test("late revoked recording and transcript still get durable deletion without content", async () => {
    await fullBridge(); const s = await state(); const w = s.windows[1]; const recordingId = randomUUID();
    await ingest(event("call.dtmf.received", { digit: "*" }));
    now += 5000;
    await callback("call.recording.saved", "conversation", "caller", { recording_id: recordingId, recording_started_at: new Date(w.authorizedAt + 100).toISOString(), recording_ended_at: new Date(now - 10).toISOString(), channels: "dual" });
    await callback("call.recording.transcription.saved", "conversation", "caller", { recording_id: recordingId, recording_transcription_id: randomUUID(), status: "completed", transcription_text: "DO_NOT_RETAIN" });
    expect(await prisma.frlPilotDeletion.count({ where: { recording_id: recordingId } })).toBe(2);
    expect(JSON.stringify(await prisma.frlPilotArtifact.findMany())).not.toContain("DO_NOT_RETAIN");
    const failing = vi.fn(async () => "retry" as const);
    await deletePilotArtifacts(prisma, c.accountId, failing, now);
    expect(await prisma.frlPilotDeletion.count({ where: { state: "retry" } })).toBe(1);
    const success = vi.fn(async () => "verified" as const);
    for (let i = 0; i < 3; i++) await deletePilotArtifacts(prisma, c.accountId, success, now + 10000);
    expect(await prisma.frlPilotDeletion.count({ where: { state: { not: "verified" } } })).toBe(0);
    expect(await deletePilotArtifacts(prisma, "foreign", success, now + 10000)).toBe(false);
  });
  test("complete recorded flow stores only authorized interval artifacts, never ledger content or CRM", async () => {
    await fullBridge();
    const s = await state(); expect(s.stage).toBe("conversation"); expect(s.windows).toHaveLength(2);
    const w = s.windows[1]; const recordingId = randomUUID(); now += 5000;
    await callback("call.hangup", "conversation"); await dispatch();
    await callback("call.hangup", "operator_consent", "operator");
    await callback("call.recording.saved", "conversation", "caller", { recording_id: recordingId, recording_started_at: new Date(w.authorizedAt + 100).toISOString(), recording_ended_at: new Date(now - 500).toISOString(), channels: "dual" });
    await callback("call.recording.transcription.saved", "conversation", "caller", { recording_id: recordingId, status: "completed", transcription_text: "SYNTHETIC_PRIVATE_CONVERSATION" });
    const artifacts = await prisma.frlPilotArtifact.findMany({ where: { account_id: c.accountId } });
    expect(artifacts).toHaveLength(2); expect(artifacts.find(a => a.purpose === "conversation")?.transcript).toBe("SYNTHETIC_PRIVATE_CONVERSATION");
    expect((await state()).stage).toBe("ended");
    expect(JSON.stringify(await prisma.webhookEvent.findMany())).not.toContain("SYNTHETIC_PRIVATE_CONVERSATION");
    expect(JSON.stringify(await prisma.auditLog.findMany())).not.toContain("SYNTHETIC_PRIVATE_CONVERSATION");
    expect(JSON.stringify(await prisma.frlPilotRun.findMany())).not.toContain(c.operator);
    expect(await prisma.crmSyncOperation.count()).toBe(0);
    expect(await prisma.callTranscript.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "frl_pilot.consent" } })).toBe(2);
  });
  test("refusal bridges without any record/transcription command", async () => {
    await fullBridge("2");
    expect((await state()).stage).toBe("conversation");
    expect(transport.mock.calls.some(([request]) => request.path.includes("record") || request.path.includes("transcription"))).toBe(false);
  });
  test("concurrent webhook deliveries commit one call and one intent", async () => {
    const e = event("call.initiated", { from: c.callers[0], to: c.number, direction: "incoming" });
    await Promise.all([ingest(e), ingest(e)]);
    expect(await prisma.frlPilotRun.count()).toBe(1); expect(await prisma.frlPilotCommand.count()).toBe(0);
    expect(await prisma.webhookEvent.count()).toBe(1);
  });
  test("concurrent workers dispatch a command once", async () => {
    await ingest(event("call.initiated", { from: c.callers[0], to: c.number, direction: "incoming" }));
    await decidePilotAdmission(prisma, c, "synthetic-operator", (await state()).id, true, now, enabled);
    await Promise.all([dispatch(), dispatch(), dispatch()]); expect(transport).toHaveBeenCalledTimes(1);
  });
  test("paused tenant and looped callers cannot create runs", async () => {
    await ingest(event("call.initiated", { from: c.operator, to: c.number, direction: "incoming" }));
    await prisma.account.update({ where: { id: c.accountId }, data: { status: "paused" } });
    await ingest(event("call.initiated", { from: c.callers[0], to: c.number, direction: "incoming" }));
    expect(await prisma.frlPilotRun.count()).toBe(0);
  });
  test("arbitrary accountId cannot redirect server assignment", async () => {
    await ingest(event("call.initiated", { accountId: "foreign", from: c.callers[0], to: c.number, direction: "incoming" }));
    expect((await prisma.frlPilotRun.findFirstOrThrow()).account_id).toBe(c.accountId);
  });
  test("pending unsent command cannot manufacture consent authority", async () => {
    await start(); await callback("call.gather.ended", "caller_consent", "caller", { digits: "1", status: "valid" });
    await callback("call.speak.ended", "name_prompt", "caller", { status: "completed" });
    expect((await state()).stage).toBe("name_prompt");
  });
  test("withdrawal cancels queued record start and cleans both legs", async () => {
    await fullBridge(); const s = await state();
    await ingest(event("call.dtmf.received", { digit: "*", client_state: stateToken(s.id, latest(s, "operator_consent")!.id) }, "operator"));
    await dispatch(); await dispatch(); await dispatch();
    expect((await state()).revokedAt).toBeTruthy();
    expect(transport.mock.calls.filter(([r]) => r.path.endsWith("/hangup"))).toHaveLength(2);
    expect(await prisma.frlPilotArtifact.count({ where: { purged_at: null } })).toBe(0);
  });
  test("out-of-order transcript is retried without persisting text", async () => {
    await fullBridge();
    await expect(callback("call.recording.transcription.saved", "conversation", "caller", { recording_id: randomUUID(), status: "completed", transcription_text: "UNPROVEN_PRIVATE" })).rejects.toThrow("pilot_recording_evidence_pending");
    expect(JSON.stringify(await prisma.webhookEvent.findMany())).not.toContain("UNPROVEN_PRIVATE");
    expect(await prisma.frlPilotArtifact.count({ where: { transcript: { not: null } } })).toBe(0);
  });
  test("uncertain dial is never retried and late operator identity is terminated", async () => {
    await start(); await callback("call.gather.ended", "caller_consent", "caller", { digits: "2", status: "valid" }); await dispatch();
    await callback("call.speak.ended", "hold", "caller", { status: "completed" });
    transport.mockResolvedValueOnce({ kind: "uncertain" }); await dispatch();
    const s = await state(); expect(s.dialUnknown).toBe(true); expect(s.stage).toBe("ending");
    await callback("call.hangup", "hold"); expect((await state()).stage).toBe("ending");
    await callback("call.initiated", "dial", "operator", { from: c.number, to: c.operator }); await dispatch();
    expect((await state()).operator?.controlId).toBe(operatorLeg.controlId);
    expect(transport.mock.calls.filter(([r]) => r.path === "/v2/calls")).toHaveLength(1);
    expect(transport.mock.calls.at(-1)?.[0].path).toContain("operator-control/actions/hangup");
  });
  test("crash after durable claim triggers cleanup rather than retry", async () => {
    await start(); const s = await state();
    await prisma.frlPilotCommand.update({ where: { id: latest(s, "caller_consent")!.id }, data: { state: "dispatched", dispatched_at: new Date(now - 20000) } });
    await dispatch(); expect((await state()).incident).toBe("dispatch_outcome_unknown");
    expect(await prisma.frlPilotCommand.count({ where: { state: "uncertain" } })).toBe(1);
  });
  test("config change and kill switch allow only cleanup", async () => {
    await start();
    await dispatchPilot(prisma, c, transport, now, { ...enabled, RESPONSEOS_FRL_PILOT_KILL: "true" });
    expect((await state()).stage).toBe("ending"); expect(transport.mock.calls.at(-1)?.[0].path).toContain("hangup");
  });
  test("retention purge is tenant-scoped", async () => {
    await fullBridge(); const s = await state();
    await prisma.frlPilotArtifact.updateMany({ where: { account_id: c.accountId }, data: { transcript: "EXPIRED", expires_at: new Date(now - 1) } });
    await prisma.frlPilotArtifact.create({ data: { account_id: "other", run_id: s.id, window_id: randomUUID(), recording_id: randomUUID(), purpose: "name", started_at: new Date(now), ended_at: new Date(now), expires_at: new Date(now - 1), transcript: "OTHER_TENANT" } });
    await purgePilotContent(prisma, c, now);
    expect((await prisma.frlPilotArtifact.findFirstOrThrow({ where: { account_id: c.accountId } })).transcript).toBeNull();
    expect((await prisma.frlPilotArtifact.findFirstOrThrow({ where: { account_id: "other" } })).transcript).toBe("OTHER_TENANT");
  });
  test("durable emergency stop survives worker restart and prevents further admissions", async () => {
    await start();
    await killPilotWindow(prisma, c, "synthetic-operator", now);
    await killPilotWindow(prisma, c, "synthetic-operator", now);
    expect(await prisma.auditLog.count({ where: { action: "frl_pilot.kill" } })).toBe(1);
    await dispatch(); expect(transport.mock.calls.at(-1)?.[0].path).toContain("hangup");
    await callback("call.hangup", "answer");
    await ingest(event("call.initiated", { call_control_id: "next-caller", call_leg_id: "next-leg", from: c.callers[0], to: c.number, direction: "incoming" }));
    expect(await prisma.frlPilotRun.count()).toBe(1);
  });
  test("unknown third bridge participant terminates capture instead of extending the roster", async () => {
    await fullBridge();
    await ingest(event("call.bridged", { call_control_id: "third-control", call_leg_id: "third-leg" }));
    expect((await state()).incident).toBe("unknown_bridge_participant");
    expect((await state()).revokedAt).toBeTruthy();
  });
  test("mounted webhook verifies signatures before pilot writes", async () => {
    const previous = { ...process.env };
    try {
      const keys = generateKeyPairSync("ed25519");
      process.env.TELNYX_PUBLIC_KEY = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
      process.env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED = "true";
      process.env.RESPONSEOS_FRL_PILOT_ENABLED = "true";
      process.env.RESPONSEOS_FRL_PILOT_DEPLOYMENT_ID = "synthetic-pilot";
      process.env.RESPONSEOS_REQUIRE_AUTH = "true";
      process.env.RESPONSEOS_FRL_PILOT_CONFIG = JSON.stringify(c);
      const { POST } = await import("@/app/api/webhooks/telnyx/calls/route");
      const body = JSON.stringify(event("call.initiated", { from: c.callers[0], to: c.number, direction: "incoming" }));
      const timestamp = String(Math.floor(now / 1000));
      const headers = { "telnyx-timestamp": timestamp, "telnyx-signature-ed25519": "bad" };
      expect((await POST(new Request("https://example.test/api/webhooks/telnyx/calls", { method: "POST", body, headers }))).status).toBe(401);
      expect(await prisma.frlPilotRun.count()).toBe(0);
      headers["telnyx-signature-ed25519"] = sign(null, Buffer.from(`${timestamp}|${body}`), keys.privateKey).toString("base64");
      expect((await POST(new Request("https://example.test/api/webhooks/telnyx/calls", { method: "POST", body, headers }))).status).toBe(202);
      expect(await prisma.frlPilotRun.count()).toBe(1);
    } finally { process.env = previous; }
  });
});
