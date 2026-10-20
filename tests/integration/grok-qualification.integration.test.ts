import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";
import { prisma, resetAndSeedTestDb, disconnectTestDb, setDevSession } from "./setup";
import { qualificationFixture } from "../qualificationFixture";
import { beginGrokHandoff, requestGrokStop, dispatchGrokTermination, heartbeatGrok, watchdogGrokSweep, operatorEndGrok } from "@/lib/grok/service";
import { authorizeQualificationTransport } from "@/lib/grok/qualification";
import { recordWebhookEvent } from "@/lib/data/webhookEvents";
import { ingestCallControlEvent } from "@/lib/callControl/service";
import { parseCallControlEvent } from "@/lib/providers/telnyx/callControl";
import { mediaClientState } from "@/lib/grok/mediaContract";

const io = vi.hoisted(() => { vi.resetModules(); return { handoff: vi.fn(), terminate: vi.fn() }; });
vi.mock("@/lib/grok/provider", async original => ({ ...await original<typeof import("@/lib/grok/provider")>(), handoffToGrok: io.handoff, terminateGrokCall: io.terminate }));
let f: ReturnType<typeof qualificationFixture>;
beforeEach(async () => {
  await resetAndSeedTestDb(); setDevSession("operator");
  const account = await prisma.account.findFirstOrThrow();
  await prisma.account.update({ where: { id: account.id }, data: { account_type: "internal_demo" } });
  const number = await prisma.telephonyNumber.create({ data: { provider: "telnyx", provider_number_id: "synthetic-provider-number", e164: "+15555550188", status: "assigned" } });
  const assignment = await prisma.telephonyNumberAssignment.create({ data: { account_id: account.id, telephony_number_id: number.id, number_exclusivity_key: number.id, provider_assistant_id: "synthetic", status: "qualification" } });
  f = qualificationFixture({ accountId: account.id, assignmentId: assignment.id, numberId: number.id });
  io.handoff.mockReset().mockResolvedValue("accepted");
  io.terminate.mockReset().mockImplementation(async (_provider, resource, command) => { await authorizeQualificationTransport("hangup", resource, command); return "accepted"; });
});
afterEach(() => { f?.cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await disconnectTestDb(); vi.doUnmock("@/lib/grok/provider"); vi.resetModules(); });
async function capture(extra = {}) {
  const c = await prisma.callCaptureSession.create({ data: { account_id: f.policy.accountId, provider_call_id: randomUUID(), assignment_id: f.policy.assignmentId, snapshot_id: "synthetic", snapshot_json: {}, call_session_id: randomUUID(), call_leg_id: randomUUID(), control_state: "START_PENDING", dtmf_decision: "affirmative", disclosure_completed_at: new Date() } });
  const eventId = randomUUID();
  const raw = JSON.stringify({ data: { id: eventId, event_type: "call.gather.ended", occurred_at: new Date().toISOString(), payload: { call_control_id: c.provider_call_id, call_session_id: c.call_session_id, call_leg_id: c.call_leg_id, client_state: mediaClientState(c.id, c.generation), connection_id: f.policy.connectionId, to: f.policy.e164, status: "valid", digits: "1", ...extra } } });
  const result = await recordWebhookEvent({ account_id: c.account_id, provider: "telnyx", provider_call_id: c.provider_call_id, provider_event_id: eventId, event_type: "call.gather.ended", signature_valid: true, raw_body: raw, verifiedBytes: Buffer.from(raw) });
  if (!result.ok) throw Error("synthetic_proof_failed");
  await prisma.callCaptureSession.update({ where: { id: c.id }, data: { dtmf_event_id: eventId } });
  await prisma.callConsentEvent.create({ data: { account_id: c.account_id, provider_call_id: c.provider_call_id, event_key: randomUUID(), action: "grant", artifact: "transcript", disclosure_ref: "synthetic", evidence_ref: "synthetic", jurisdiction_basis: "synthetic", source_channel: "call", actor_user_id: "user_operator_mock" } });
  return c;
}
test("concurrent distinct calls reserve exactly one global slot before I/O", async () => {
  const a = await capture(), b = await capture();
  const results = await Promise.allSettled([beginGrokHandoff(a), beginGrokHandoff(b), beginGrokHandoff(a)]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(io.handoff).toHaveBeenCalledTimes(1); expect(await prisma.grokQualificationReservation.count()).toBe(1);
});
test.each(["disabled", "expired", "missing", "malformed"])("%s authority sends nothing", async reason => {
  const c = await capture();
  if (reason === "disabled") vi.stubEnv("RESPONSEOS_QUALIFICATION_ACTIVATION", "DISABLED");
  if (reason === "expired") f.save({ ...f.policy, expiresAt: new Date(0).toISOString() });
  if (reason === "missing") vi.stubEnv("RESPONSEOS_QUALIFICATION_FILE", undefined);
  if (reason === "malformed") f.save({});
  await expect(beginGrokHandoff(c)).rejects.toThrow(); expect(io.handoff).not.toHaveBeenCalled();
  expect(await prisma.grokCallSession.count()).toBe(0);
});
test.each([{ connection_id: "wrong" }, { to: "+15555550199" }])("authenticated but wrong provider target denies %j", async extra => {
  await expect(beginGrokHandoff(await capture(extra))).rejects.toThrow("identity_mismatch"); expect(io.handoff).not.toHaveBeenCalled();
});
test("customer tenant and changed assignment are denied", async () => {
  const c = await capture();
  await prisma.account.update({ where: { id: c.account_id }, data: { account_type: "customer" } });
  await expect(beginGrokHandoff(c)).rejects.toThrow("identity_mismatch");
  await prisma.account.update({ where: { id: c.account_id }, data: { account_type: "internal_demo" } });
  f.save({ ...f.policy, assignmentId: "wrong" });
  await expect(beginGrokHandoff(c)).rejects.toThrow("target_mismatch"); expect(io.handoff).not.toHaveBeenCalled();
});
test.each(["disabled", "expired", "removed"])("retained termination survives %s admission without resetting claims", async reason => {
  const c = await capture(), started = await beginGrokHandoff(c);
  if (reason === "disabled") vi.stubEnv("RESPONSEOS_QUALIFICATION_ACTIVATION", "DISABLED");
  if (reason === "expired") f.save({ ...f.policy, expiresAt: new Date(0).toISOString() });
  if (reason === "removed") vi.stubEnv("RESPONSEOS_QUALIFICATION_FILE", undefined);
  expect(await heartbeatGrok(started.sessionId, "not-a-worker")).toBe(false);
  await Promise.all([dispatchGrokTermination(started.sessionId), dispatchGrokTermination(started.sessionId)]);
  expect(io.terminate).toHaveBeenCalledTimes(1);
  expect(await prisma.grokCallCommand.findFirst({ where: { session_id: started.sessionId, kind: "telnyx_hangup" } })).toMatchObject({ status: "accepted" });
  expect(await prisma.grokQualificationReservation.findUnique({ where: { session_id: started.sessionId } })).toMatchObject({ active_slot: "qualification", released_at: null });
  await expect(authorizeQualificationTransport("hangup", "other-call", "other-command")).rejects.toThrow();
});
test("uncertain result and stopped state do not release concurrency or permit retry", async () => {
  io.handoff.mockResolvedValue("uncertain");
  const c = await capture(), started = await beginGrokHandoff(c);
  await dispatchGrokTermination(started.sessionId);
  await expect(beginGrokHandoff(await capture())).rejects.toThrow("call_in_progress");
  await expect(beginGrokHandoff(c)).rejects.toThrow("consumed");
  await expect(prisma.grokQualificationReservation.update({ where: { session_id: started.sessionId }, data: { active_slot: null, released_at: new Date() } })).rejects.toThrow();
  await expect(prisma.grokQualificationReservation.delete({ where: { session_id: started.sessionId } })).rejects.toThrow();
  await expect(prisma.grokQualificationReservation.update({ where: { session_id: started.sessionId }, data: { deadline: new Date() } })).rejects.toThrow();
});
test("only authenticated exact terminal evidence releases the old slot for a distinct call", async () => {
  const c = await capture(), started = await beginGrokHandoff(c), eventId = randomUUID();
  const raw = JSON.stringify({ data: { id: eventId, event_type: "call.hangup", occurred_at: new Date().toISOString(), payload: { call_control_id: c.provider_call_id, call_session_id: c.call_session_id, call_leg_id: c.call_leg_id, client_state: mediaClientState(c.id, c.generation) } } });
  await ingestCallControlEvent({ event: parseCallControlEvent(raw)!, rawBody: raw, verifiedBytes: Buffer.from(raw), signature: "synthetic" });
  expect((await operatorEndGrok(c)).disconnection.confirmed).toBe(true);
  await beginGrokHandoff(await capture());
  const old = await prisma.grokQualificationReservation.findUniqueOrThrow({ where: { session_id: started.sessionId } });
  expect(old.active_slot).toBeNull(); expect(old.released_at).not.toBeNull();
  await expect(prisma.grokQualificationReservation.update({ where: { session_id: started.sessionId }, data: { active_slot: "qualification", released_at: null } })).rejects.toThrow();
});
test("duration expiration stops on watchdog sweep and preserves the slot", async () => {
  f.policy.maxDurationMs = 1000; f.save(); const c = await capture(), started = await beginGrokHandoff(c);
  await new Promise(resolve => setTimeout(resolve, 1100)); await watchdogGrokSweep();
  expect(io.terminate).toHaveBeenCalledTimes(1);
  expect(await prisma.grokCallSession.findUnique({ where: { id: started.sessionId } })).toMatchObject({ stop_reason: "withdrawal_or_control_loss" });
});
test("database reservation failure rolls back before provider I/O", async () => {
  const c = await capture();
  await prisma.$executeRawUnsafe(`CREATE FUNCTION qualification_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic_db_failure'; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER qualification_test_fail BEFORE INSERT ON "GrokQualificationReservation" FOR EACH ROW EXECUTE FUNCTION qualification_test_fail()`);
  try { await expect(beginGrokHandoff(c)).rejects.toThrow(); }
  finally { await prisma.$executeRawUnsafe(`DROP TRIGGER qualification_test_fail ON "GrokQualificationReservation"`); await prisma.$executeRawUnsafe(`DROP FUNCTION qualification_test_fail()`); }
  expect(await prisma.grokCallSession.count()).toBe(0); expect(io.handoff).not.toHaveBeenCalled();
});
test("retained termination rejects changed credentials without releasing the consumed claim", async () => {
  const c = await capture(), started = await beginGrokHandoff(c); await requestGrokStop(started.sessionId, "synthetic");
  vi.stubEnv("TELNYX_API_KEY", "different-synthetic-key"); await dispatchGrokTermination(started.sessionId);
  expect(await prisma.grokCallCommand.findFirst({ where: { session_id: started.sessionId, kind: "telnyx_hangup" } })).toMatchObject({ status: "uncertain" });
  await dispatchGrokTermination(started.sessionId); expect(io.terminate).toHaveBeenCalledTimes(1);
});

test.each(["client", "anonymous"])("%s cannot admit a qualification call", async role => {
 const c=await capture();if(role==="anonymous")delete process.env.RESPONSEOS_DEV_SESSION;else setDevSession(role);
 await expect(beginGrokHandoff(c)).rejects.toThrow("operator_required");expect(io.handoff).not.toHaveBeenCalled();
});
