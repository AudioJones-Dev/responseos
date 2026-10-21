import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma, resetAndSeedTestDb, disconnectTestDb, setDevSession } from "./setup";
import { qualificationFixture } from "../qualificationFixture";
import { knowledgeFixture } from "../knowledgeFixture";
import { EXECUTION_MODE_POLICIES } from "@/lib/agentExecution/policy";
import { buildOperatingConfigurationSnapshot } from "@/lib/agentExecution/operatingConfigurationSnapshot";
import { beginGrokHandoff } from "@/lib/grok/service";
import { authorizeQualificationTransport, qualificationConfigHash } from "@/lib/grok/qualification";
import { recordWebhookEvent } from "@/lib/data/webhookEvents";
import { mediaClientState } from "@/lib/grok/mediaContract";
import { startMediaBridge } from "@/lib/grok/mediaBridge";
import { draftGrokPilotReview } from "@/lib/grok/pilotReview";
import { purgeExpiredPilotTranscripts } from "@/lib/retention/pilotTranscripts";
import { ReviewPayloadSchema } from "@/lib/callReview/contracts";
import { MockCrmProvider } from "@/lib/providers/crm";
import * as crmProviders from "@/lib/providers/crm";
import * as emailProviders from "@/lib/providers/email";

const io = vi.hoisted(() => { vi.resetModules(); return { handoff: vi.fn(), terminate: vi.fn() }; });
vi.mock("@/lib/grok/provider", async original => ({ ...await original<typeof import("@/lib/grok/provider")>(), handoffToGrok: io.handoff, terminateGrokCall: io.terminate }));

let f: ReturnType<typeof qualificationFixture>;
let k: ReturnType<typeof knowledgeFixture>;
let memory: unknown;
beforeEach(async () => {
  await resetAndSeedTestDb(); setDevSession("operator");
  const account = await prisma.account.findFirstOrThrow();
  await prisma.account.update({ where: { id: account.id }, data: { account_type: "customer" } });
  vi.stubEnv("RESPONSEOS_AUTHORIZED_EXECUTION_GATES", "v0.3-live-communications");
  await prisma.agentProfile.create({ data: { account_id: account.id, name: "Sam", type: "supervised_receptionist", slug: "frl-pilot", enabled: true, system_policy_json: EXECUTION_MODE_POLICIES.SUPERVISED_PILOT as unknown as Prisma.InputJsonValue } });
  const number = await prisma.telephonyNumber.create({ data: { provider: "telnyx", provider_number_id: "synthetic-provider-number", e164: "+15555550188", status: "assigned" } });
  const assignment = await prisma.telephonyNumberAssignment.create({ data: { account_id: account.id, telephony_number_id: number.id, number_exclusivity_key: number.id, provider_assistant_id: "synthetic", status: "active", activated_at: new Date(Date.now() - 1000) } });
  f = qualificationFixture({ mode: "carrier-pilot", crm: true, email: true, transcript: true, transcriptRetentionDays: 30, accountId: account.id, assignmentId: assignment.id, numberId: number.id });
  vi.stubEnv("RESPONSEOS_LIVE_HUBSPOT_ENABLED", "true");
  vi.stubEnv("RESPONSEOS_LIVE_EMAIL_ENABLED", "true");
  vi.stubEnv("RESPONSEOS_PILOT_ACTIVATION", "ENABLED");
  k = knowledgeFixture(account.id, "frl-sam-ara-pilot-v1");
  f.policy.knowledge = k.binding; f.policy.configSha256 = qualificationConfigHash(); f.save();
  const now = new Date();
  memory = buildOperatingConfigurationSnapshot({ accountId: account.id, generatedAt: now, assertion: { sourceId: "fixture", recordRef: "fixture-only", contentHash: "f".repeat(64), assertedBy: "test", assertedAt: now }, entries: [
    { key: "notification.completed_interaction.recipient", value: { channel: "email", recipient: "team@example.test", event: "completed_interaction", enabled: true, temporary: true } },
  ] }).memory;
  io.handoff.mockReset().mockResolvedValue("accepted");
  io.terminate.mockReset().mockImplementation(async (_provider, resource, command) => { await authorizeQualificationTransport("hangup", resource, command); return "accepted"; });
});
afterEach(() => { f?.cleanup(); k?.cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await disconnectTestDb(); vi.doUnmock("@/lib/grok/provider"); vi.resetModules(); });

async function capture() {
  const c = await prisma.callCaptureSession.create({ data: { account_id: f.policy.accountId, provider_call_id: randomUUID(), assignment_id: f.policy.assignmentId, admission_mode: "pilot", snapshot_id: "synthetic", snapshot_json: memory as Prisma.InputJsonValue, call_session_id: randomUUID(), call_leg_id: randomUUID(), control_state: "START_PENDING", dtmf_decision: "affirmative", disclosure_completed_at: new Date() } });
  const eventId = randomUUID();
  const raw = JSON.stringify({ data: { id: eventId, event_type: "call.gather.ended", occurred_at: new Date().toISOString(), payload: { call_control_id: c.provider_call_id, call_session_id: c.call_session_id, call_leg_id: c.call_leg_id, client_state: mediaClientState(c.id, c.generation), connection_id: f.policy.connectionId, to: f.policy.e164, status: "valid", digits: "1" } } });
  const result = await recordWebhookEvent({ account_id: c.account_id, provider: "telnyx", provider_call_id: c.provider_call_id, provider_event_id: eventId, event_type: "call.gather.ended", signature_valid: true, raw_body: raw, verifiedBytes: Buffer.from(raw) });
  if (!result.ok) throw Error("synthetic_proof_failed");
  // The call-control handler marks a handled keypress processed; dispatch waits on unprocessed evidence.
  await prisma.webhookEvent.updateMany({ where: { provider_event_id: eventId }, data: { process_status: "processed" } });
  await prisma.callCaptureSession.update({ where: { id: c.id }, data: { dtmf_event_id: eventId } });
  await consent(c, "grant");
  return c;
}
function consent(c: { account_id: string; provider_call_id: string }, action: "grant" | "withdraw") {
  return prisma.callConsentEvent.create({ data: { account_id: c.account_id, provider_call_id: c.provider_call_id, event_key: randomUUID(), action, artifact: "transcript", disclosure_ref: "synthetic", evidence_ref: "synthetic", jurisdiction_basis: "synthetic", source_channel: "call", actor_user_id: "user_operator_mock" } });
}
async function admittedBridge(c: Awaited<ReturnType<typeof capture>>) {
  const started = await beginGrokHandoff(c);
  const token = io.handoff.mock.calls.at(-1)![1] as string;
  const keys = generateKeyPairSync("ed25519"), streamUrl = process.env.RESPONSEOS_GROK_STREAM_URL!;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers = new Headers({ "telnyx-timestamp": timestamp, "telnyx-signature-ed25519": sign(null, Buffer.from(`${timestamp}|${streamUrl}`), keys.privateKey).toString("base64"), "x-telnyx-streaming-auth-token": token });
  const carrier = { bufferedAmount: 0, send: vi.fn(), close: vi.fn() }, realtime = { bufferedAmount: 0, send: vi.fn(), close: vi.fn() };
  const bridge = await startMediaBridge({
    headers, connectedToken: token,
    trusted: { streamUrl, publicKey: keys.publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64") },
    rawStart: JSON.stringify({ event: "start", stream_id: randomUUID(), start: { call_control_id: c.provider_call_id, call_session_id: c.call_session_id, client_state: mediaClientState(c.id, c.generation), media_format: { encoding: "PCMU", sample_rate: 8000, channels: 1 } } }),
  }, { carrier, openRealtime: vi.fn().mockResolvedValue(realtime) });
  const sent = JSON.parse(realtime.send.mock.calls[0][0]);
  await bridge.xai(JSON.stringify({ type: "session.updated", session: { ...sent.session, id: `pilot-${c.id}`, model: "grok-voice-3.0" } }));
  return { bridge, sent, sessionId: started.sessionId };
}
const turns = (sessionId: string) => prisma.grokTranscriptTurn.findMany({ where: { session_id: sessionId }, orderBy: { sequence: "asc" } });
const said = (bridge: Awaited<ReturnType<typeof startMediaBridge>>, speaker: "caller" | "agent", transcript: string) =>
  bridge.xai(JSON.stringify({ type: speaker === "caller" ? "conversation.item.input_audio_transcription.completed" : "response.output_audio_transcript.done", transcript }));

test("a pilot call keeps consented turns, drafts a review after it ends, and dispatches once to CRM and email", async () => {
  const c = await capture();
  const { bridge, sent, sessionId } = await admittedBridge(c);
  try {
    expect(bridge.acceptingAudio).toBe(true);
    expect(sent.session.audio.input.transcription).toEqual({ model: "grok-transcribe" });
    expect(sent.session.instructions).toContain("live call with a real caller");
    await said(bridge, "caller", "Hi, this is Pat Example. I need a ramp in Tampa.");
    await said(bridge, "agent", "Thanks, Pat. What is the best callback number?");
    await vi.waitFor(async () => expect(await turns(sessionId)).toHaveLength(2));
    const stored = await turns(sessionId);
    expect(stored.map(turn => turn.speaker)).toEqual(["caller", "agent"]);
    expect(stored[0].expires_at.getTime() - stored[0].occurred_at.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    expect(await draftGrokPilotReview(c.id)).toBe("in_progress");
  } finally { await bridge.stop("synthetic_cleanup"); }

  await said(bridge, "caller", "Late words after the stop.");
  expect(await turns(sessionId)).toHaveLength(2);
  const call = await prisma.call.create({ data: { account_id: c.account_id, provider: "telnyx", provider_call_id: c.provider_call_id, direction: "inbound", status: "completed", from_number: "+15555550100", to_number: f.policy.e164, started_at: new Date(), review_required: true } });
  expect(await draftGrokPilotReview(c.id)).toBe("queued");
  expect(await draftGrokPilotReview(c.id)).toBe("queued");
  const reviews = await prisma.callReview.findMany({ where: { call_id: call.id } });
  expect(reviews).toHaveLength(1);
  expect(reviews[0].recipient).toBe("team@example.test");
  expect(reviews[0].evidence_json).toMatchObject({ pilot: true, transcript: "Caller: Hi, this is Pat Example. I need a ramp in Tampa.\nSam: Thanks, Pat. What is the best callback number?" });
  expect(reviews[0].payload_json).toMatchObject({ phone: "+15555550100" });

  const provider = new MockCrmProvider();
  Object.defineProperty(provider, "providerId", { value: "hubspot" });
  const create = vi.spyOn(provider, "createContact");
  const send = vi.fn().mockResolvedValue({ providerMessageId: "synthetic-pilot-message" });
  vi.spyOn(crmProviders, "getCrmProvider").mockReturnValue(provider);
  vi.spyOn(emailProviders, "getEmailProvider").mockReturnValue({ providerId: "resend", send });
  const value = ReviewPayloadSchema.parse({ caller: "Pat Example", phone: "+15555550100", interaction: "new_sales", product: "ramp", location: "Tampa", summary: "Ramp inquiry.", qualification: "qualified", outcome: "QUALIFIED_FREE_EVALUATION", urgency: "medium", callbackWindow: "", nextAction: "Call back.", flags: [] });
  const route = await import("@/app/api/admin/call-reviews/[id]/route");
  const post = (body: unknown) => route.POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: reviews[0].id }) });
  expect((await post({ action: "approve", revision: reviews[0].revision, payload: value })).status).toBe(200);
  expect((await post({ action: "dispatch" })).status).toBe(200);
  expect(create).toHaveBeenCalledOnce();
  expect(send).toHaveBeenCalledOnce();
  expect(send.mock.calls[0][0].text).toContain("Supervised FRL pilot — live caller");
  expect(send.mock.calls[0][0].text).not.toContain("fictional");
});

test("a withdrawal stops transcript capture and blocks the review", async () => {
  const c = await capture();
  const { bridge, sessionId } = await admittedBridge(c);
  try {
    await said(bridge, "caller", "My name is Pat.");
    await vi.waitFor(async () => expect(await turns(sessionId)).toHaveLength(1));
    await consent(c, "withdraw");
    await said(bridge, "caller", "Please stop.");
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(await turns(sessionId)).toHaveLength(1);
  } finally { await bridge.stop("synthetic_cleanup"); }
  await prisma.call.create({ data: { account_id: c.account_id, provider: "telnyx", provider_call_id: c.provider_call_id, direction: "inbound", status: "completed", from_number: "+15555550100", to_number: f.policy.e164, started_at: new Date(), review_required: true } });
  expect(await draftGrokPilotReview(c.id)).toBe("withdrawn");
  expect(await prisma.callReview.count()).toBe(0);
});

test("the 30-day purge removes pilot turns and transcript copies but keeps the approved payload", async () => {
  const c = await capture();
  const { bridge, sessionId } = await admittedBridge(c);
  try {
    await said(bridge, "caller", "Hi, this is Pat Example.");
    await vi.waitFor(async () => expect(await turns(sessionId)).toHaveLength(1));
  } finally { await bridge.stop("synthetic_cleanup"); }
  const call = await prisma.call.create({ data: { account_id: c.account_id, provider: "telnyx", provider_call_id: c.provider_call_id, direction: "inbound", status: "completed", from_number: "+15555550100", to_number: f.policy.e164, started_at: new Date(), review_required: true } });
  expect(await draftGrokPilotReview(c.id)).toBe("queued");
  const later = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
  expect(await purgeExpiredPilotTranscripts({ now: new Date(), preview: true })).toMatchObject({ ok: true, data: { sessions: 0 } });
  expect(await purgeExpiredPilotTranscripts({ now: later, preview: true })).toMatchObject({ ok: true, data: { sessions: 1, turnsDeleted: 1 } });
  expect(await purgeExpiredPilotTranscripts({ now: later })).toMatchObject({ ok: true, data: { sessions: 1, turnsDeleted: 1, callsCleared: 1, reviewsCleared: 1 } });
  expect(await turns(sessionId)).toHaveLength(0);
  expect((await prisma.call.findUniqueOrThrow({ where: { id: call.id } })).transcript).toBeNull();
  const review = await prisma.callReview.findFirstOrThrow({ where: { call_id: call.id } });
  expect(review.evidence_json).toMatchObject({ transcript: null, pilot: true });
  expect(review.payload_json).toMatchObject({ phone: "+15555550100" });
  expect(await prisma.auditLog.count({ where: { action: "retention.pilot_transcript_purged" } })).toBe(1);
});
