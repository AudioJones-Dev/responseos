import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { configureSupervisedTenant } from "@/lib/agentExecution/supervisedTenant";
import { startSupervisedQualification } from "@/lib/agentExecution/supervisedQualification";
import { ingestCallControlEvent, requestQualifiedTransfer } from "@/lib/callControl/service";
import { withCaptureLock } from "@/lib/callReview/consent";
import type { CallControlEvent } from "@/lib/providers/telnyx/callControl";
import { disconnectTestDb, prisma, resetAndSeedTestDb, setDevSession } from "./setup";

const sendCommand = vi.hoisted(() => vi.fn());
vi.mock("@/lib/providers/telnyx/callControl", async (original) => ({
  ...await original<typeof import("@/lib/providers/telnyx/callControl")>(),
  sendTelnyxCallCommand: sendCommand,
}));

const NUMBER = "+15555550188";
const NOW = new Date("2026-09-16T12:00:00.000Z");
const CONFIGURATION = [
  { key: "business.knowledge", value: { facts: [{ topic: "services", statement: "VPL evaluations are available.", sourceRef: "test-approval" }], fictionalScenarios: [] } },
  { key: "notification.completed_interaction.recipient", value: { channel: "email", recipient: "owner@example.test", event: "completed_interaction", enabled: true, temporary: true } },
  { key: "operating_hours.weekly", value: { type: "always_open" } },
  { key: "operating_hours.holidays", value: { type: "always_open" } },
  { key: "service_area.coverage", value: { regions: ["South Florida"], precision: "broad_region", countyInferenceAllowed: false, locationConfirmationRequired: true, collectFromCaller: ["city", "postal_code"] } },
  { key: "contact.escalation.primary", value: { name: "Operator", phone: "+15555550123" } },
  { key: "policy.consent", value: { aiDisclosure: "This call uses an AI receptionist and may be transcribed to help with your request.", transcription: { enabled: true }, recording: { enabled: false }, refusal: { acknowledgement: "No problem. I won't collect any more details.", stopRecordingWhenSupported: true, offer: "transfer_or_callback", minimizeCollection: true } } },
];

function event(type: CallControlEvent["data"]["event_type"], id: string, payload: Partial<CallControlEvent["data"]["payload"]> = {}, offset = 0): CallControlEvent {
  return { data: { id, event_type: type, occurred_at: new Date(NOW.getTime() + offset).toISOString(), payload: { call_control_id: "call-control-1", call_session_id: "call-session-1", call_leg_id: "call-leg-1", ...payload } } };
}

function state(captureId: string, generation = 1) {
  return Buffer.from(JSON.stringify({ captureId, generation })).toString("base64");
}

async function ingest(value: CallControlEvent) {
  return ingestCallControlEvent({ event: value, rawBody: JSON.stringify(value), signature: "verified-test-signature" });
}

async function setupQualification() {
  const configured = await configureSupervisedTenant({
    accountSlug: "frl-call-control-test",
    businessName: "Florida Ramp & Lift",
    timezone: "America/New_York",
    agentName: "Sam",
    executionMode: "SUPERVISED_PILOT",
    approvalRecordRef: "approval:test",
    configuration: CONFIGURATION,
  }, NOW);
  if (!configured.ok) throw new Error(configured.error.code);
  const started = await startSupervisedQualification({ accountSlug: "frl-call-control-test", providerNumberId: "number-frl", e164: NUMBER, providerAssistantId: "assistant-frl", approvalRecordRef: "qualification:test" }, NOW);
  if (!started.ok) throw new Error(started.error.code);
  return started.data;
}

async function matureTerminalEvidence(providerCallId: string) {
  await prisma.webhookEvent.updateMany({
    where: { provider_call_id: providerCallId, event_type: { in: ["call.ai_gather.message_history_updated", "call.conversation.ended", "call.hangup"] } },
    data: { received_at: new Date(Date.now() - 10_000) },
  });
}

describe("FRL Call Control qualification", () => {
  beforeEach(async () => {
    await resetAndSeedTestDb();
    setDevSession("operator");
    delete process.env.RESPONSEOS_AUTHORIZED_EXECUTION_GATES;
    process.env.RESPONSEOS_DEMO_PHONE_E164 = "+17867560897";
    process.env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED = "true";
    process.env.TELNYX_API_KEY = "test-only";
    sendCommand.mockReset().mockImplementation(async ({ action }: { action: string }) => ({ status: 200, providerDate: new Date(NOW.getTime() + 4_000), conversationId: action === "ai_assistant_start" ? "conversation-1" : null, ok: true, errorCode: null }));
  });
  afterAll(disconnectTestDb);

  test("disclosure completes before DTMF authority and operator grant precedes AI start intent", async () => {
    await setupQualification();
    await ingest(event("call.initiated", "cc-1", { to: NUMBER, from: "+15555550199" }, 1_000));
    const capture = await prisma.callCaptureSession.findFirstOrThrow({ where: { provider_call_id: "call-control-1" } });
    expect(capture.control_state).toBe("CALL_RECEIVED");
    expect(await prisma.telnyxCallCommand.findFirst({ where: { command_type: "answer" } })).not.toBeNull();

    await ingest(event("call.answered", "cc-2", { to: NUMBER }, 2_000));
    expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id } })).control_state).toBe("DISCLOSURE_PLAYING");
    expect((await prisma.telnyxCallCommand.findFirstOrThrow({ where: { command_type: "disclosure" } })).request_json).toMatchObject({ payload: expect.stringContaining("press 1") });

    await ingest(event("call.speak.ended", "cc-3", { client_state: state(capture.id) }, 3_000));
    expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id } })).disclosure_completed_at).toEqual(new Date(NOW.getTime() + 3_000));
    expect(await prisma.telnyxCallCommand.findFirst({ where: { command_type: "consent_gather" } })).not.toBeNull();

    await ingest(event("call.gather.ended", "cc-4", { status: "valid", digits: "1", client_state: state(capture.id) }, 4_000));
    expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id } }))).toMatchObject({ control_state: "CONSENT_PENDING_OPERATOR", dtmf_decision: "affirmative" });
    expect(await prisma.telnyxCallCommand.findFirst({ where: { command_type: "ai_assistant_start" } })).toBeNull();

    const route = await import("@/app/api/admin/call-capture/[id]/consent/route");
    const grantRequest = () => new Request("https://example.test", { method: "POST", body: JSON.stringify({ action: "grant", disclosureRef: "approved:v1", evidenceRef: "witness:test", jurisdictionBasis: "commissioning:test", eventKey: "00000000-0000-4000-8000-000000000001" }) });
    const response = await route.POST(grantRequest(), { params: Promise.resolve({ id: capture.id }) });
    expect(response.status).toBe(200);
    const start = await prisma.telnyxCallCommand.findFirstOrThrow({ where: { command_type: "ai_assistant_start" } });
    expect(start.status).toBe("succeeded");
    expect(start.conversation_id).toBe("conversation-1");
    expect(start.intended_at.getTime()).toBeLessThanOrEqual(start.provider_responded_at!.getTime());
    await prisma.callCaptureSession.update({ where: { id: capture.id }, data: { control_state: "AI_ACTIVE", capture_started_at: start.provider_date_at } });
    expect((await route.POST(grantRequest(), { params: Promise.resolve({ id: capture.id }) })).status).toBe(200);
    expect(await prisma.telnyxCallCommand.count({ where: { capture_session_id: capture.id, command_type: "ai_assistant_start" } })).toBe(1);
  });

  test("an uncertain disclosure command is retried with the same command identity", async () => {
    await setupQualification();
    await ingest(event("call.initiated", "cc-redrive-init", { to: NUMBER }, 1_000));
    const capture = await prisma.callCaptureSession.findFirstOrThrow();
    sendCommand.mockResolvedValueOnce({ status: 0, providerDate: null, conversationId: null, ok: false, errorCode: "telnyx_response_uncertain" });
    const answered = event("call.answered", "cc-redrive-answered", { to: NUMBER }, 2_000);
    await expect(ingest(answered)).rejects.toThrow("telnyx_response_uncertain");
    const uncertain = await prisma.telnyxCallCommand.findFirstOrThrow({ where: { capture_session_id: capture.id, command_type: "disclosure" } });
    expect(uncertain.status).toBe("uncertain");
    sendCommand.mockResolvedValueOnce({ status: 200, providerDate: new Date(NOW.getTime() + 2_500), conversationId: null, ok: true, errorCode: null });
    await expect(ingest(answered)).resolves.toEqual({ duplicate: false, captureId: capture.id });
    const succeeded = await prisma.telnyxCallCommand.findUniqueOrThrow({ where: { id: uncertain.id } });
    expect(succeeded).toMatchObject({ status: "succeeded", command_id: uncertain.command_id });
  });

  test("a redelivered initiation re-drives answer after capture creation", async () => {
    await setupQualification();
    sendCommand.mockResolvedValueOnce({ status: 0, providerDate: null, conversationId: null, ok: false, errorCode: "telnyx_response_uncertain" });
    const initiated = event("call.initiated", "cc-redrive-initiation", { to: NUMBER }, 1_000);
    await expect(ingest(initiated)).rejects.toThrow("telnyx_response_uncertain");
    const capture = await prisma.callCaptureSession.findFirstOrThrow();
    const uncertain = await prisma.telnyxCallCommand.findFirstOrThrow({ where: { capture_session_id: capture.id, command_type: "answer" } });
    sendCommand.mockResolvedValueOnce({ status: 200, providerDate: new Date(NOW.getTime() + 1_500), conversationId: null, ok: true, errorCode: null });
    await expect(ingest(initiated)).resolves.toEqual({ duplicate: false, captureId: capture.id });
    expect((await prisma.telnyxCallCommand.findUniqueOrThrow({ where: { id: uncertain.id } }))).toMatchObject({ status: "succeeded", command_id: uncertain.command_id });
  });

  test.each([
    ["valid", "2", "refused"],
    ["timeout", "", "ambiguous"],
    ["valid", "9", "ambiguous"],
  ])("%s/%s never starts AI", async (status, digits, decision) => {
    await setupQualification();
    await ingest(event("call.initiated", `cc-init-${decision}`, { to: NUMBER }, 1_000));
    const capture = await prisma.callCaptureSession.findFirstOrThrow();
    await prisma.callCaptureSession.update({ where: { id: capture.id }, data: { control_state: "AWAITING_DTMF", disclosure_completed_at: new Date(NOW.getTime() + 2_000) } });
    await ingest(event("call.gather.ended", `cc-gather-${decision}-${digits}`, { status, digits, client_state: state(capture.id) }, 3_000));
    expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id } })).dtmf_decision).toBe(decision);
    expect(await prisma.telnyxCallCommand.count({ where: { command_type: "ai_assistant_start" } })).toBe(0);
  });

  test("signed cumulative history qualifies the boundary once, deduplicates revisions, and withdrawal rejects later content", async () => {
    await setupQualification();
    await ingest(event("call.initiated", "cc-a", { to: NUMBER, from: "+15555550199" }, 1_000));
    const capture = await prisma.callCaptureSession.findFirstOrThrow();
    await prisma.callCaptureSession.update({ where: { id: capture.id }, data: { control_state: "START_PENDING", dtmf_decision: "affirmative", conversation_id: "conversation-1" } });
    await prisma.callConsentEvent.create({ data: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, event_key: "grant-1", action: "grant", artifact: "transcript", disclosure_ref: "approved:v1", evidence_ref: "witness:test", jurisdiction_basis: "commissioning:test", source_channel: "call", actor_user_id: "user_operator_mock", occurred_at: new Date(NOW.getTime() + 3_000) } });
    await prisma.telnyxCallCommand.create({ data: { account_id: capture.account_id, capture_session_id: capture.id, assignment_id: capture.assignment_id!, command_type: "ai_assistant_start", generation: 1, command_id: "command-start-1", provider_resource: capture.provider_call_id, request_json: {}, status: "succeeded", provider_responded_at: new Date(NOW.getTime() + 4_000), provider_response_status: 200, provider_date_at: new Date(NOW.getTime() + 4_000), conversation_id: "conversation-1" } });
    const payload = { conversation_id: "conversation-1", client_state: state(capture.id), message_history: [{ role: "assistant", content: "How can I help?" }, { role: "user", content: "I need a VPL evaluation." }] };
    await ingest(event("call.ai_gather.message_history_updated", "cc-history-1", payload, 5_000));
    expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id } }))).toMatchObject({ control_state: "AI_ACTIVE", capture_started_at: new Date(NOW.getTime() + 4_000) });
    expect(await prisma.callTranscriptRevision.count()).toBe(1);
    await expect(ingest(event("call.ai_gather.message_history_updated", "cc-history-1", payload, 5_000))).resolves.toEqual({ duplicate: true });
    expect(await prisma.callTranscriptRevision.count()).toBe(1);
    await ingest(event("call.ai_gather.message_history_updated", "cc-history-2", payload, 6_000));
    expect(await prisma.callTranscriptRevision.count()).toBe(1);
    await ingest(event("call.ai_gather.message_history_updated", "cc-history-conflict", { ...payload, message_history: [{ role: "user", content: "Conflicting shorter history" }] }, 6_500));
    expect(await prisma.callTranscriptRevision.count()).toBe(1);
    expect((await prisma.webhookEvent.findUniqueOrThrow({ where: { provider_provider_event_id: { provider: "telnyx", provider_event_id: "cc-history-conflict" } } })).process_error).toBe("cumulative_history_conflict");

    const route = await import("@/app/api/admin/call-capture/[id]/consent/route");
    const response = await route.POST(new Request("https://example.test", { method: "POST", body: JSON.stringify({ action: "withdraw", disclosureRef: "approved:v1", evidenceRef: "witness:withdraw", jurisdictionBasis: "commissioning:test", eventKey: "00000000-0000-4000-8000-000000000002" }) }), { params: Promise.resolve({ id: capture.id }) });
    expect(response.status).toBe(200);
    expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id } })).control_state).toBe("STOP_PENDING");
    await ingest(event("call.ai_gather.message_history_updated", "cc-history-after", { ...payload, message_history: [...payload.message_history, { role: "user", content: "Protected after withdrawal" }] }, 7_000));
    expect(await prisma.callTranscriptRevision.count()).toBe(1);
    expect((await prisma.webhookEvent.findUniqueOrThrow({ where: { provider_provider_event_id: { provider: "telnyx", provider_event_id: "cc-history-after" } } })).process_status).toBe("rejected");
  });

  test("a concurrent withdrawal wins the capture lock before protected history is persisted", async () => {
    await setupQualification();
    await ingest(event("call.initiated", "cc-race-init", { to: NUMBER }, 1_000));
    const capture = await prisma.callCaptureSession.findFirstOrThrow();
    await prisma.callCaptureSession.update({ where: { id: capture.id }, data: { control_state: "AI_ACTIVE", dtmf_decision: "affirmative", conversation_id: "conversation-1", capture_started_at: new Date(NOW.getTime() + 4_000) } });
    await prisma.callConsentEvent.create({ data: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, event_key: "grant-race", action: "grant", artifact: "transcript", disclosure_ref: "approved:v1", evidence_ref: "witness:test", jurisdiction_basis: "commissioning:test", source_channel: "call", actor_user_id: "user_operator_mock", occurred_at: new Date(NOW.getTime() + 3_000) } });
    await prisma.telnyxCallCommand.create({ data: { account_id: capture.account_id, capture_session_id: capture.id, assignment_id: capture.assignment_id!, command_type: "ai_assistant_start", generation: 1, command_id: "command-start-race", provider_resource: capture.provider_call_id, request_json: {}, status: "succeeded", provider_responded_at: new Date(NOW.getTime() + 4_000), provider_response_status: 200, provider_date_at: new Date(NOW.getTime() + 4_000), conversation_id: "conversation-1" } });
    let release!: () => void;
    let locked!: () => void;
    const releaseGate = new Promise<void>((resolve) => { release = resolve; });
    const lockAcquired = new Promise<void>((resolve) => { locked = resolve; });
    const withdrawal = withCaptureLock(capture.account_id, capture.provider_call_id, async (client) => {
      await client.callConsentEvent.create({ data: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, event_key: "withdraw-race", action: "withdraw", artifact: "transcript", disclosure_ref: "approved:v1", evidence_ref: "witness:withdraw", jurisdiction_basis: "commissioning:test", source_channel: "call", actor_user_id: "user_operator_mock", occurred_at: new Date(NOW.getTime() + 5_000) } });
      await client.callCaptureSession.update({ where: { id: capture.id }, data: { control_state: "STOP_PENDING", content_admission_closed_at: new Date(NOW.getTime() + 5_000) } });
      locked();
      await releaseGate;
    });
    await lockAcquired;
    const protectedText = "Protected content must remain metadata-only";
    const history = ingest(event("call.ai_gather.message_history_updated", "cc-history-race", { conversation_id: "conversation-1", client_state: state(capture.id), message_history: [{ role: "user", content: protectedText }] }, 6_000));
    release();
    await withdrawal;
    await history;
    const ledger = await prisma.webhookEvent.findUniqueOrThrow({ where: { provider_provider_event_id: { provider: "telnyx", provider_event_id: "cc-history-race" } } });
    expect(ledger.process_status).toBe("rejected");
    expect(ledger.raw_body).not.toContain(protectedText);
    expect(await prisma.callTranscriptRevision.count({ where: { capture_session_id: capture.id } })).toBe(0);
  });

  test("signed conversation end freezes evidence and creates a provider-independent review result", async () => {
    await setupQualification();
    await ingest(event("call.initiated", "cc-final-init", { to: NUMBER, from: "+15555550199" }, 1_000));
    const capture = await prisma.callCaptureSession.findFirstOrThrow();
    await prisma.callCaptureSession.update({ where: { id: capture.id }, data: { control_state: "START_PENDING", dtmf_decision: "affirmative", conversation_id: "conversation-1" } });
    await prisma.callConsentEvent.create({ data: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, event_key: "grant-final", action: "grant", artifact: "transcript", disclosure_ref: "approved:v1", evidence_ref: "witness:test", jurisdiction_basis: "commissioning:test", source_channel: "call", actor_user_id: "user_operator_mock", occurred_at: new Date(NOW.getTime() + 3_000) } });
    await prisma.telnyxCallCommand.create({ data: { account_id: capture.account_id, capture_session_id: capture.id, assignment_id: capture.assignment_id!, command_type: "ai_assistant_start", generation: 1, command_id: "command-start-final", provider_resource: capture.provider_call_id, request_json: {}, status: "succeeded", provider_responded_at: new Date(NOW.getTime() + 4_000), provider_response_status: 200, provider_date_at: new Date(NOW.getTime() + 4_000), conversation_id: "conversation-1" } });
    const payload = { conversation_id: "conversation-1", client_state: state(capture.id), message_history: [{ role: "assistant", content: "How can I help?" }, { role: "user", content: "I need a VPL evaluation." }] };
    await ingest(event("call.ai_gather.message_history_updated", "cc-final-history", payload, 5_000));
    await ingest(event("call.conversation.ended", "cc-final-ended", { conversation_id: "conversation-1", client_state: state(capture.id) }, 6_000));
    const hangup = event("call.hangup", "cc-final-hangup", { conversation_id: "conversation-1" }, 7_000);
    await expect(ingest(hangup)).rejects.toThrow("awaiting_final_history_settlement");
    await matureTerminalEvidence(capture.provider_call_id);
    await ingest(hangup);

    const finalCapture = await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id } });
    const revision = await prisma.callTranscriptRevision.findFirstOrThrow({ where: { capture_session_id: capture.id } });
    const analysis = await prisma.callPostCallAnalysis.findUniqueOrThrow({ where: { transcript_revision_id: revision.id } });
    expect(finalCapture.control_state).toBe("EVIDENCE_FROZEN");
    expect(revision.frozen_at).not.toBeNull();
    expect(analysis).toMatchObject({ transcript_hash: revision.source_hash, provider: "responseos", schema_version: "frl-post-call.v1", completeness: "unavailable" });
    expect(await prisma.callReview.count({ where: { account_id: capture.account_id, call_id: revision.call_id } })).toBe(1);
  });

  test("terminal events wait for delayed cumulative history before freezing evidence", async () => {
    await setupQualification();
    await ingest(event("call.initiated", "cc-late-init", { to: NUMBER }, 1_000));
    const capture = await prisma.callCaptureSession.findFirstOrThrow();
    await prisma.callCaptureSession.update({ where: { id: capture.id }, data: { control_state: "AI_ACTIVE", dtmf_decision: "affirmative", conversation_id: "conversation-1", capture_started_at: new Date(NOW.getTime() + 4_000) } });
    await prisma.callConsentEvent.create({ data: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, event_key: "grant-late", action: "grant", artifact: "transcript", disclosure_ref: "approved:v1", evidence_ref: "witness:test", jurisdiction_basis: "commissioning:test", source_channel: "call", actor_user_id: "user_operator_mock", occurred_at: new Date(NOW.getTime() + 3_000) } });
    await prisma.telnyxCallCommand.create({ data: { account_id: capture.account_id, capture_session_id: capture.id, assignment_id: capture.assignment_id!, command_type: "ai_assistant_start", generation: 1, command_id: "command-start-late", provider_resource: capture.provider_call_id, request_json: {}, status: "succeeded", provider_responded_at: new Date(NOW.getTime() + 4_000), provider_response_status: 200, provider_date_at: new Date(NOW.getTime() + 4_000), conversation_id: "conversation-1" } });
    await ingest(event("call.conversation.ended", "cc-late-ended", { conversation_id: "conversation-1", client_state: state(capture.id) }, 7_000));
    const hangup = event("call.hangup", "cc-late-hangup", { conversation_id: "conversation-1" }, 8_000);
    await expect(ingest(hangup)).rejects.toThrow("awaiting_final_history_settlement");
    expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id } })).control_state).toBe("FINALIZING");
    expect(await prisma.callReview.count()).toBe(0);
    const payload = { conversation_id: "conversation-1", client_state: state(capture.id), message_history: [{ role: "assistant", content: "How can I help?" }, { role: "user", content: "I need a VPL evaluation." }] };
    const history = event("call.ai_gather.message_history_updated", "cc-late-history", payload, 6_000);
    await expect(ingest(history)).rejects.toThrow("awaiting_final_history_settlement");
    await matureTerminalEvidence(capture.provider_call_id);
    await ingest(history);
    expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id } })).control_state).toBe("EVIDENCE_FROZEN");
    expect(await prisma.callReview.count()).toBe(1);
  });

  test("terminal settlement does not freeze an interim cumulative revision", async () => {
    await setupQualification();
    await ingest(event("call.initiated", "cc-interim-init", { to: NUMBER }, 1_000));
    const capture = await prisma.callCaptureSession.findFirstOrThrow();
    await prisma.callCaptureSession.update({ where: { id: capture.id }, data: { control_state: "AI_ACTIVE", dtmf_decision: "affirmative", conversation_id: "conversation-1", capture_started_at: new Date(NOW.getTime() + 4_000) } });
    await prisma.callConsentEvent.create({ data: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, event_key: "grant-interim", action: "grant", artifact: "transcript", disclosure_ref: "approved:v1", evidence_ref: "witness:test", jurisdiction_basis: "commissioning:test", source_channel: "call", actor_user_id: "user_operator_mock", occurred_at: new Date(NOW.getTime() + 3_000) } });
    await prisma.telnyxCallCommand.create({ data: { account_id: capture.account_id, capture_session_id: capture.id, assignment_id: capture.assignment_id!, command_type: "ai_assistant_start", generation: 1, command_id: "command-start-interim", provider_resource: capture.provider_call_id, request_json: {}, status: "succeeded", provider_responded_at: new Date(NOW.getTime() + 4_000), provider_response_status: 200, provider_date_at: new Date(NOW.getTime() + 4_000), conversation_id: "conversation-1" } });
    const interim = { conversation_id: "conversation-1", client_state: state(capture.id), message_history: [{ role: "assistant", content: "How can I help?" }] };
    await ingest(event("call.ai_gather.message_history_updated", "cc-interim-history", interim, 5_000));
    await ingest(event("call.conversation.ended", "cc-interim-ended", { conversation_id: "conversation-1", client_state: state(capture.id) }, 8_000));
    const hangup = event("call.hangup", "cc-interim-hangup", { conversation_id: "conversation-1" }, 9_000);
    await expect(ingest(hangup)).rejects.toThrow("awaiting_final_history_settlement");
    expect((await prisma.callTranscriptRevision.findFirstOrThrow({ where: { capture_session_id: capture.id } })).frozen_at).toBeNull();
    const final = { ...interim, message_history: [...interim.message_history, { role: "user", content: "I need a VPL evaluation." }] };
    const finalHistory = event("call.ai_gather.message_history_updated", "cc-interim-final-history", final, 7_000);
    await expect(ingest(finalHistory)).rejects.toThrow("awaiting_final_history_settlement");
    await matureTerminalEvidence(capture.provider_call_id);
    await ingest(finalHistory);
    const frozen = await prisma.callTranscriptRevision.findFirstOrThrow({ where: { capture_session_id: capture.id }, orderBy: { revision: "desc" } });
    expect(frozen).toMatchObject({ revision: 2, frozen_at: expect.any(Date) });
    expect(frozen.inline_text).toContain("I need a VPL evaluation.");
  });

  test("signed cumulative history arriving after the first freeze creates a superseding review", async () => {
    await setupQualification();
    await ingest(event("call.initiated", "cc-post-freeze-init", { to: NUMBER }, 1_000));
    const capture = await prisma.callCaptureSession.findFirstOrThrow();
    await prisma.callCaptureSession.update({ where: { id: capture.id }, data: { control_state: "AI_ACTIVE", dtmf_decision: "affirmative", conversation_id: "conversation-1", capture_started_at: new Date(NOW.getTime() + 4_000) } });
    await prisma.callConsentEvent.create({ data: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, event_key: "grant-post-freeze", action: "grant", artifact: "transcript", disclosure_ref: "approved:v1", evidence_ref: "witness:test", jurisdiction_basis: "commissioning:test", source_channel: "call", actor_user_id: "user_operator_mock", occurred_at: new Date(NOW.getTime() + 3_000) } });
    await prisma.telnyxCallCommand.create({ data: { account_id: capture.account_id, capture_session_id: capture.id, assignment_id: capture.assignment_id!, command_type: "ai_assistant_start", generation: 1, command_id: "command-start-post-freeze", provider_resource: capture.provider_call_id, request_json: {}, status: "succeeded", provider_responded_at: new Date(NOW.getTime() + 4_000), provider_response_status: 200, provider_date_at: new Date(NOW.getTime() + 4_000), conversation_id: "conversation-1" } });
    const initial = { conversation_id: "conversation-1", client_state: state(capture.id), message_history: [{ role: "assistant", content: "How can I help?" }] };
    await ingest(event("call.ai_gather.message_history_updated", "cc-post-freeze-history-1", initial, 5_000));
    await ingest(event("call.conversation.ended", "cc-post-freeze-ended", { conversation_id: "conversation-1", client_state: state(capture.id) }, 7_000));
    const hangup = event("call.hangup", "cc-post-freeze-hangup", { conversation_id: "conversation-1" }, 8_000);
    await expect(ingest(hangup)).rejects.toThrow("awaiting_final_history_settlement");
    await matureTerminalEvidence(capture.provider_call_id);
    await ingest(hangup);
    expect(await prisma.callReview.count()).toBe(1);

    const late = event("call.ai_gather.message_history_updated", "cc-post-freeze-history-2", { ...initial, message_history: [...initial.message_history, { role: "user", content: "I need a VPL evaluation." }] }, 6_000);
    await expect(ingest(late)).rejects.toThrow("awaiting_final_history_settlement");
    expect(await prisma.callReview.count()).toBe(1);
    await matureTerminalEvidence(capture.provider_call_id);
    await ingest(late);

    const revisions = await prisma.callTranscriptRevision.findMany({ where: { capture_session_id: capture.id }, orderBy: { revision: "asc" } });
    expect(revisions).toHaveLength(2);
    expect(revisions[1]).toMatchObject({ revision: 2, frozen_at: expect.any(Date) });
    expect(revisions[1].inline_text).toContain("I need a VPL evaluation.");
    expect(await prisma.callReview.count()).toBe(2);
  });

  test("post-boundary history is retained as metadata only and cannot supersede frozen evidence", async () => {
    await setupQualification();
    await ingest(event("call.initiated", "cc-post-boundary-init", { to: NUMBER }, 1_000));
    const capture = await prisma.callCaptureSession.findFirstOrThrow();
    await prisma.callCaptureSession.update({ where: { id: capture.id }, data: { control_state: "AI_ACTIVE", dtmf_decision: "affirmative", conversation_id: "conversation-1", capture_started_at: new Date(NOW.getTime() + 4_000) } });
    await prisma.callConsentEvent.create({ data: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, event_key: "grant-post-boundary", action: "grant", artifact: "transcript", disclosure_ref: "approved:v1", evidence_ref: "witness:test", jurisdiction_basis: "commissioning:test", source_channel: "call", actor_user_id: "user_operator_mock", occurred_at: new Date(NOW.getTime() + 3_000) } });
    await prisma.telnyxCallCommand.create({ data: { account_id: capture.account_id, capture_session_id: capture.id, assignment_id: capture.assignment_id!, command_type: "ai_assistant_start", generation: 1, command_id: "command-start-post-boundary", provider_resource: capture.provider_call_id, request_json: {}, status: "succeeded", provider_responded_at: new Date(NOW.getTime() + 4_000), provider_response_status: 200, provider_date_at: new Date(NOW.getTime() + 4_000), conversation_id: "conversation-1" } });
    const initial = { conversation_id: "conversation-1", client_state: state(capture.id), message_history: [{ role: "assistant", content: "How can I help?" }] };
    await ingest(event("call.ai_gather.message_history_updated", "cc-post-boundary-history-1", initial, 5_000));
    await ingest(event("call.conversation.ended", "cc-post-boundary-ended", { conversation_id: "conversation-1", client_state: state(capture.id) }, 7_000));
    const hangup = event("call.hangup", "cc-post-boundary-hangup", { conversation_id: "conversation-1" }, 8_000);
    await expect(ingest(hangup)).rejects.toThrow("awaiting_final_history_settlement");
    await matureTerminalEvidence(capture.provider_call_id);
    await ingest(hangup);

    const protectedText = "Protected content after the capture boundary";
    await ingest(event("call.ai_gather.message_history_updated", "cc-post-boundary-history-2", { ...initial, message_history: [...initial.message_history, { role: "user", content: protectedText }] }, 9_000));

    expect(await prisma.callTranscriptRevision.count({ where: { capture_session_id: capture.id } })).toBe(1);
    expect(await prisma.callReview.count()).toBe(1);
    const ledger = await prisma.webhookEvent.findFirstOrThrow({ where: { provider_event_id: "cc-post-boundary-history-2" } });
    expect(ledger).toMatchObject({ process_status: "rejected", process_error: "protected_content_not_admitted" });
    expect(ledger.raw_body).not.toContain(protectedText);
  });

  test("hangup cannot authorize history before the signed conversation boundary arrives", async () => {
    await setupQualification();
    await ingest(event("call.initiated", "cc-hangup-first-init", { to: NUMBER }, 1_000));
    const capture = await prisma.callCaptureSession.findFirstOrThrow();
    await prisma.callCaptureSession.update({ where: { id: capture.id }, data: { control_state: "AI_ACTIVE", dtmf_decision: "affirmative", conversation_id: "conversation-1", capture_started_at: new Date(NOW.getTime() + 4_000) } });
    await prisma.callConsentEvent.create({ data: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, event_key: "grant-hangup-first", action: "grant", artifact: "transcript", disclosure_ref: "approved:v1", evidence_ref: "witness:test", jurisdiction_basis: "commissioning:test", source_channel: "call", actor_user_id: "user_operator_mock", occurred_at: new Date(NOW.getTime() + 3_000) } });
    await prisma.telnyxCallCommand.create({ data: { account_id: capture.account_id, capture_session_id: capture.id, assignment_id: capture.assignment_id!, command_type: "ai_assistant_start", generation: 1, command_id: "command-start-hangup-first", provider_resource: capture.provider_call_id, request_json: {}, status: "succeeded", provider_responded_at: new Date(NOW.getTime() + 4_000), provider_response_status: 200, provider_date_at: new Date(NOW.getTime() + 4_000), conversation_id: "conversation-1" } });
    const hangup = event("call.hangup", "cc-hangup-first-hangup", { conversation_id: "conversation-1" }, 9_000);
    await expect(ingest(hangup)).rejects.toThrow("awaiting_final_history_settlement");
    const protectedText = "Content after the actual conversation boundary";
    const history = event("call.ai_gather.message_history_updated", "cc-hangup-first-history", { conversation_id: "conversation-1", client_state: state(capture.id), message_history: [{ role: "user", content: protectedText }] }, 8_000);
    await expect(ingest(history)).rejects.toThrow("awaiting_conversation_boundary");
    let ledger = await prisma.webhookEvent.findFirstOrThrow({ where: { provider_event_id: "cc-hangup-first-history" } });
    expect(ledger.raw_body).not.toContain(protectedText);
    expect(await prisma.callTranscriptRevision.count({ where: { capture_session_id: capture.id } })).toBe(0);

    await expect(ingest(event("call.conversation.ended", "cc-hangup-first-ended", { conversation_id: "conversation-1", client_state: state(capture.id) }, 7_000))).rejects.toThrow("awaiting_final_history_settlement");
    await expect(ingest(history)).rejects.toThrow("awaiting_final_history_settlement");
    ledger = await prisma.webhookEvent.findFirstOrThrow({ where: { provider_event_id: "cc-hangup-first-history" } });
    expect(ledger).toMatchObject({ process_status: "rejected", process_error: "protected_content_not_admitted" });
    expect(ledger.raw_body).not.toContain(protectedText);
    expect(await prisma.callTranscriptRevision.count({ where: { capture_session_id: capture.id } })).toBe(0);
  });

  test("a reconciled uncertain stop resumes terminal evidence finalization", async () => {
    await setupQualification();
    await ingest(event("call.initiated", "cc-stop-init", { to: NUMBER }, 1_000));
    const capture = await prisma.callCaptureSession.findFirstOrThrow();
    await prisma.callCaptureSession.update({ where: { id: capture.id }, data: { control_state: "START_PENDING", dtmf_decision: "affirmative", conversation_id: "conversation-1" } });
    await prisma.callConsentEvent.create({ data: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, event_key: "grant-stop", action: "grant", artifact: "transcript", disclosure_ref: "approved:v1", evidence_ref: "witness:test", jurisdiction_basis: "commissioning:test", source_channel: "call", actor_user_id: "user_operator_mock", occurred_at: new Date(NOW.getTime() + 3_000) } });
    await prisma.telnyxCallCommand.create({ data: { account_id: capture.account_id, capture_session_id: capture.id, assignment_id: capture.assignment_id!, command_type: "ai_assistant_start", generation: 1, command_id: "command-start-stop", provider_resource: capture.provider_call_id, request_json: {}, status: "succeeded", provider_responded_at: new Date(NOW.getTime() + 4_000), provider_response_status: 200, provider_date_at: new Date(NOW.getTime() + 4_000), conversation_id: "conversation-1" } });
    const payload = { conversation_id: "conversation-1", client_state: state(capture.id), message_history: [{ role: "assistant", content: "How can I help?" }, { role: "user", content: "I need a VPL evaluation." }] };
    await ingest(event("call.ai_gather.message_history_updated", "cc-stop-history", payload, 5_000));
    const route = await import("@/app/api/admin/call-capture/[id]/consent/route");
    const request = () => new Request("https://example.test", { method: "POST", body: JSON.stringify({ action: "withdraw", disclosureRef: "approved:v1", evidenceRef: "witness:withdraw", jurisdictionBasis: "commissioning:test", eventKey: "00000000-0000-4000-8000-000000000003" }) });
    sendCommand.mockResolvedValueOnce({ status: 0, providerDate: null, conversationId: null, ok: false, errorCode: "telnyx_response_uncertain" });
    expect((await route.POST(request(), { params: Promise.resolve({ id: capture.id }) })).status).toBe(503);
    const uncertain = await prisma.telnyxCallCommand.findFirstOrThrow({ where: { capture_session_id: capture.id, command_type: "ai_assistant_stop" } });
    expect(uncertain.status).toBe("uncertain");
    await ingest(event("call.conversation.ended", "cc-stop-ended", { conversation_id: "conversation-1", client_state: state(capture.id) }, 7_000));
    const hangup = event("call.hangup", "cc-stop-hangup", { conversation_id: "conversation-1" }, 8_000);
    await expect(ingest(hangup)).rejects.toThrow("awaiting_final_history_settlement");
    expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id } })).control_state).toBe("STOP_PENDING");
    await matureTerminalEvidence(capture.provider_call_id);
    sendCommand.mockResolvedValueOnce({ status: 200, providerDate: new Date(NOW.getTime() + 9_000), conversationId: null, ok: true, errorCode: null });
    expect((await route.POST(request(), { params: Promise.resolve({ id: capture.id }) })).status).toBe(200);
    expect((await prisma.telnyxCallCommand.findUniqueOrThrow({ where: { id: uncertain.id } }))).toMatchObject({ status: "succeeded", command_id: uncertain.command_id });
    expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id } })).control_state).toBe("STOPPED");
    expect(await prisma.callReview.count()).toBe(1);
    expect((await route.POST(request(), { params: Promise.resolve({ id: capture.id }) })).status).toBe(200);
    expect(await prisma.telnyxCallCommand.count({ where: { capture_session_id: capture.id, command_type: "ai_assistant_stop" } })).toBe(1);
  });

  test("stale generations and arbitrary transfer destinations fail closed", async () => {
    await setupQualification();
    await ingest(event("call.initiated", "cc-fence-init", { to: NUMBER }, 1_000));
    const capture = await prisma.callCaptureSession.findFirstOrThrow();
    await expect(ingest(event("call.gather.ended", "cc-stale-gather", { status: "valid", digits: "1", client_state: state(capture.id, 2) }, 2_000))).rejects.toThrow("stale_or_missing_call_control_generation");

    await prisma.callCaptureSession.update({ where: { id: capture.id }, data: { control_state: "AI_ACTIVE", conversation_id: "conversation-1", capture_started_at: new Date(NOW.getTime() + 3_000) } });
    await expect(requestQualifiedTransfer({ captureId: capture.id, destination: "+15555550999" })).rejects.toThrow("transfer_destination_denied");
    await expect(requestQualifiedTransfer({ captureId: capture.id, destination: "+15555550123" })).resolves.toEqual({ attempted: true, connected: false });
    expect(await prisma.telnyxCallCommand.findFirst({ where: { command_type: "transfer", status: "succeeded" } })).not.toBeNull();
    await ingest(event("call.bridged", "cc-transfer-bridged", { client_state: state(capture.id) }, 4_000));
    expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id } })).control_state).toBe("TRANSFERRED");
  });

  test("qualification origin remains permanently ineligible for CRM and email effects", async () => {
    const started = await setupQualification();
    await ingest(event("call.initiated", "cc-effects", { to: NUMBER }, 1_000));
    expect(await prisma.crmSyncOperation.count({ where: { account_id: started.accountId } })).toBe(0);
    expect(await prisma.notification.count({ where: { account_id: started.accountId, channel: "email" } })).toBe(0);
  });
});
