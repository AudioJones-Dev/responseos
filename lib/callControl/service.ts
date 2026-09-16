import "@/lib/serverOnlyGuard";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { buildSupervisedAgentContext } from "@/lib/agentExecution/supervisedContext";
import { resolveSupervisedTenantForNumber, touchSupervisedAssignment } from "@/lib/agentExecution/supervisedRuntime";
import { recordWebhookEvent, setWebhookProcessStatus } from "@/lib/data/webhookEvents";
import { extractTelnyxTranscript } from "@/lib/providers/telnyx/insights";
import { normalizeTelnyxEvent } from "@/lib/providers/telnyx/normalize";
import type { TelnyxWebhookEnvelope } from "@/lib/providers/telnyx/webhook";
import { type CallControlEvent, sendTelnyxCallCommand, type TelnyxCommandAction } from "@/lib/providers/telnyx/callControl";
import { asJson, conservativePostCallAnalysis, POST_CALL_ANALYSIS_PROMPT_VERSION, POST_CALL_ANALYSIS_SCHEMA_VERSION } from "./analysis";
import { queueCallReview } from "@/lib/callReview/service";
import { withCaptureLock } from "@/lib/callReview/consent";
import { BusinessMemorySnapshotSchema } from "@/lib/prospectBootstrap/contracts";
import { readOperatingConfigurationValue } from "@/lib/agentExecution/operatingConfiguration";
import type { Prisma } from "@prisma/client";

const DISCLOSURE_PROMPT = " To continue, press 1. To decline, press 2.";
const GATHER_PROMPT = "Press 1 to continue, or press 2 to decline.";

type CommandType = "answer" | "disclosure" | "consent_gather" | "refusal_ack" | "ambiguous_end" | "ai_assistant_start" | "ai_assistant_stop" | "transfer" | "hangup";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function providerPayload(event: CallControlEvent): TelnyxWebhookEnvelope {
  return { data: { id: event.data.id, event_type: event.data.event_type, occurred_at: event.data.occurred_at, payload: event.data.payload } };
}

function clientState(captureId: string, generation: number) {
  return Buffer.from(JSON.stringify({ captureId, generation })).toString("base64");
}

function validClientState(value: string | undefined, captureId: string, generation: number) {
  if (!value) return false;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64").toString("utf8")) as { captureId?: unknown; generation?: unknown };
    return parsed.captureId === captureId && parsed.generation === generation;
  } catch {
    return false;
  }
}

async function persistCommandIntent(params: {
  captureId: string;
  accountId: string;
  assignmentId: string;
  generation: number;
  commandType: CommandType;
  providerResource: string;
  request: Record<string, unknown>;
}) {
  if (!db) throw new Error("database_unavailable");
  return db.telnyxCallCommand.upsert({
    where: { capture_session_id_command_type_generation: { capture_session_id: params.captureId, command_type: params.commandType, generation: params.generation } },
    update: {},
    create: {
      account_id: params.accountId,
      capture_session_id: params.captureId,
      assignment_id: params.assignmentId,
      command_type: params.commandType,
      generation: params.generation,
      command_id: randomUUID(),
      provider_resource: params.providerResource,
      request_json: asJson(params.request),
    },
  });
}

async function executeCommand(params: {
  capture: { id: string; account_id: string; assignment_id: string | null; generation: number; provider_call_id: string };
  commandType: CommandType;
  action: TelnyxCommandAction;
  request: Record<string, unknown>;
}) {
  if (!db || !params.capture.assignment_id) throw new Error("qualification_capture_invalid");
  const intent = await persistCommandIntent({
    captureId: params.capture.id,
    accountId: params.capture.account_id,
    assignmentId: params.capture.assignment_id,
    generation: params.capture.generation,
    commandType: params.commandType,
    providerResource: params.capture.provider_call_id,
    request: params.request,
  });
  if (intent.status === "succeeded") return intent;
  if (!["intent_recorded", "uncertain", "failed"].includes(intent.status)) throw new Error("telnyx_command_not_executable");
  const body = { ...params.request, command_id: intent.command_id };
  const result = await sendTelnyxCallCommand({ callControlId: params.capture.provider_call_id, action: params.action, body });
  return db.telnyxCallCommand.update({
    where: { id: intent.id },
    data: {
      status: result.ok ? "succeeded" : result.errorCode === "telnyx_response_uncertain" ? "uncertain" : "failed",
      provider_responded_at: result.status > 0 ? new Date() : null,
      provider_response_status: result.status,
      provider_date_at: result.providerDate,
      conversation_id: result.conversationId,
      error_code: result.errorCode,
      reconciliation_state: result.ok ? null : "operator_review_required",
    },
  });
}

async function createQualificationCapture(event: CallControlEvent) {
  if (!db) throw new Error("database_unavailable");
  const target = event.data.payload.to;
  if (!target) throw new Error("destination_required");
  const occurredAt = new Date(event.data.occurred_at);
  const runtime = await resolveSupervisedTenantForNumber(target, occurredAt);
  if (!runtime || runtime.assignmentStatus !== "qualification" || !runtime.providerEvidenceAuthorized || !runtime.readiness.ready) throw new Error("qualification_runtime_unavailable");
  const capture = await db.callCaptureSession.upsert({
    where: { account_id_provider_call_id: { account_id: runtime.accountId, provider_call_id: event.data.payload.call_control_id } },
    update: {},
    create: {
      account_id: runtime.accountId,
      provider_call_id: event.data.payload.call_control_id,
      assignment_id: runtime.assignmentId,
      snapshot_id: runtime.snapshotId,
      snapshot_json: asJson(runtime.memory),
      call_session_id: event.data.payload.call_session_id,
      call_leg_id: event.data.payload.call_leg_id,
      control_state: "CALL_RECEIVED",
    },
  });
  await touchSupervisedAssignment(runtime.assignmentId, occurredAt);
  return { capture, runtime };
}

async function captureForEvent(event: CallControlEvent) {
  if (!db) throw new Error("database_unavailable");
  return db.callCaptureSession.findFirst({
    where: {
      OR: [
        { provider_call_id: event.data.payload.call_control_id },
        { call_session_id: event.data.payload.call_session_id },
        ...(event.data.payload.conversation_id ? [{ conversation_id: event.data.payload.conversation_id }] : []),
      ],
    },
    orderBy: { created_at: "desc" },
  });
}

async function normalizeMetadata(event: CallControlEvent, capture: { account_id: string; provider_call_id: string }, webhookEventId: string, numberE164: string) {
  return normalizeTelnyxEvent({
    accountId: capture.account_id,
    providerCallId: capture.provider_call_id,
    demoNumber: numberE164,
    webhookEventId,
    event: providerPayload(event),
    options: { captureCallerIdentity: false, createQuoteRequest: false, reviewRequired: true },
  });
}

async function recordTranscriptRevision(event: CallControlEvent, capture: NonNullable<Awaited<ReturnType<typeof captureForEvent>>>, webhookEventId: string, numberE164: string, client: Prisma.TransactionClient) {
  const terminalReconciliation = capture.control_state === "FINALIZING" && capture.capture_ended_at !== null;
  if (!capture.assignment_id || !capture.conversation_id || !capture.capture_started_at || (capture.content_admission_closed_at && !terminalReconciliation)) return "rejected" as const;
  const latestConsent = await client.callConsentEvent.findFirst({ where: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, artifact: "transcript" }, orderBy: [{ occurred_at: "desc" }, { id: "desc" }] });
  if (latestConsent?.action !== "grant") return "rejected" as const;
  const start = await client.telnyxCallCommand.findFirst({ where: { capture_session_id: capture.id, command_type: "ai_assistant_start", generation: capture.generation, status: "succeeded", conversation_id: capture.conversation_id } });
  if (!start?.provider_date_at) return "rejected" as const;
  const transcript = extractTelnyxTranscript(event.data.payload);
  if (!transcript?.text) return "rejected" as const;
  const sourceHash = hash(transcript.text);
  const prior = await client.callTranscriptRevision.findUnique({ where: { capture_session_id_source_hash: { capture_session_id: capture.id, source_hash: sourceHash } } });
  if (prior) return "duplicate" as const;
  const latest = await client.callTranscriptRevision.findFirst({ where: { capture_session_id: capture.id }, orderBy: { revision: "desc" } });
  if (latest && (transcript.turns <= latest.inline_text.split("\n").length || !transcript.text.startsWith(`${latest.inline_text}\n`))) return "stale_or_conflicting" as const;
  const normalized = await normalizeTelnyxEvent({
    accountId: capture.account_id,
    providerCallId: capture.provider_call_id,
    demoNumber: numberE164,
    webhookEventId,
    event: providerPayload(event),
    client,
    options: { captureCallerIdentity: true, createQuoteRequest: false, reviewRequired: true },
  });
  if (!normalized.callId) return "rejected" as const;
  await client.callTranscriptRevision.create({ data: {
    account_id: capture.account_id,
    call_id: normalized.callId,
    capture_session_id: capture.id,
    assignment_id: capture.assignment_id,
    snapshot_id: capture.snapshot_id,
    conversation_id: capture.conversation_id,
    revision: (latest?.revision ?? 0) + 1,
    source_hash: sourceHash,
    inline_text: transcript.text,
    source_event_ids: [...new Set([...(latest?.source_event_ids ?? []), event.data.id])],
    capture_started_at: capture.capture_started_at,
  } });
  return "admitted" as const;
}

async function freezeEvidence(captureId: string) {
  if (!db) return;
  const capture = await db.callCaptureSession.findUnique({ where: { id: captureId } });
  if (!capture?.conversation_id || !capture.capture_ended_at) return;
  const [conversationEnded, callHangup] = await Promise.all([
    db.webhookEvent.findFirst({ where: { account_id: capture.account_id, provider: "telnyx", provider_call_id: capture.provider_call_id, event_type: "call.conversation.ended", signature_valid: true }, select: { id: true } }),
    db.webhookEvent.findFirst({ where: { account_id: capture.account_id, provider: "telnyx", provider_call_id: capture.provider_call_id, event_type: "call.hangup", signature_valid: true }, select: { id: true } }),
  ]);
  if (!conversationEnded || !callHangup) return;
  const withdrawal = await db.callConsentEvent.findFirst({ where: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, action: "withdraw", artifact: "transcript" }, orderBy: { occurred_at: "desc" } });
  const endBoundary = withdrawal?.occurred_at ?? capture.capture_ended_at;
  const stop = withdrawal ? await db.telnyxCallCommand.findFirst({ where: { capture_session_id: capture.id, command_type: "ai_assistant_stop", generation: capture.generation, status: "succeeded" } }) : null;
  if (withdrawal && !stop) return;
  const transferState = ["TRANSFER_PENDING", "TRANSFERRED"].includes(capture.control_state);
  const revision = await db.callTranscriptRevision.findFirst({ where: { capture_session_id: capture.id }, orderBy: { revision: "desc" } });
  if (!revision) return;
  const frozen = revision.frozen_at ? revision : await db.callTranscriptRevision.update({ where: { id: revision.id }, data: { capture_ended_at: endBoundary, frozen_at: new Date() } });
  const analysis = await conservativePostCallAnalysis.analyze({ transcript: frozen.inline_text });
  await db.callPostCallAnalysis.upsert({ where: { transcript_revision_id: frozen.id }, update: {}, create: {
    account_id: frozen.account_id,
    call_id: frozen.call_id,
    transcript_revision_id: frozen.id,
    transcript_hash: frozen.source_hash,
    provider: analysis.provider,
    model: analysis.model,
    prompt_version: POST_CALL_ANALYSIS_PROMPT_VERSION,
    schema_version: POST_CALL_ANALYSIS_SCHEMA_VERSION,
    result_json: asJson(analysis.result),
    completeness: analysis.completeness,
    uncertainty_json: asJson(analysis.uncertainty),
  } });
  await queueCallReview(frozen.account_id, frozen.call_id, analysis.result);
  if (!transferState) await db.callCaptureSession.update({ where: { id: capture.id }, data: { control_state: withdrawal ? "STOPPED" : "EVIDENCE_FROZEN" } });
}

export async function ingestCallControlEvent(params: { event: CallControlEvent; rawBody: string; signature: string; timestamp?: string }) {
  if (!db) throw new Error("database_unavailable");
  const event = params.event;
  const occurredAt = new Date(event.data.occurred_at);
  const existing = event.data.event_type === "call.initiated" ? await captureForEvent(event) : null;
  const initial = event.data.event_type === "call.initiated" && !existing ? await createQualificationCapture(event) : null;
  const capture = existing ?? initial?.capture ?? await captureForEvent(event);
  if (!capture?.assignment_id) throw new Error("qualification_capture_not_found");
  const assignment = await db.telephonyNumberAssignment.findFirst({ where: { id: capture.assignment_id, account_id: capture.account_id, status: "qualification" } });
  if (!assignment) throw new Error("qualification_assignment_mismatch");
  const generationBoundEvent = ["call.speak.ended", "call.gather.ended", "call.bridged", "call.ai_gather.message_history_updated", "call.conversation.ended"].includes(event.data.event_type);
  if (generationBoundEvent && !validClientState(event.data.payload.client_state, capture.id, capture.generation)) throw new Error("stale_or_missing_call_control_generation");
  const runtime = initial?.runtime ?? await resolveSupervisedTenantForNumber(event.data.payload.to ?? "", occurredAt);
  const number = await db.telephonyNumber.findUnique({ where: { id: assignment.telephony_number_id }, select: { e164: true } });
  const numberE164 = runtime?.numberE164 ?? number?.e164 ?? event.data.payload.to ?? "unavailable";
  const persistedEvent = { data: { ...event.data, payload: { ...event.data.payload, message_history: undefined } } };
  const record = async (rawBody: string, client?: Prisma.TransactionClient) => {
    const ledger = await recordWebhookEvent({
      client,
      account_id: capture.account_id,
      provider: "telnyx",
      provider_event_id: event.data.id,
      event_type: event.data.event_type,
      raw_body: rawBody,
      signature_header: params.timestamp ? `telnyx-timestamp=${params.timestamp};telnyx-signature-ed25519=${params.signature}` : params.signature,
      signature_valid: true,
      provider_call_id: capture.provider_call_id,
      provider_call_ids: [event.data.payload.call_control_id, event.data.payload.call_session_id, event.data.payload.call_leg_id ?? "", event.data.payload.conversation_id ?? ""].filter(Boolean),
      agent_target: event.data.payload.to,
    });
    if (!ledger.ok) throw new Error(ledger.error.code);
    const database = client ?? db;
    if (!database) throw new Error("database_unavailable");
    if (ledger.data.process_status === "duplicate") {
      const prior = await database.webhookEvent.findUnique({ where: { id: ledger.data.id }, select: { process_status: true } });
      if (prior?.process_status !== "error") return { id: ledger.data.id, duplicate: true };
      await database.webhookEvent.update({ where: { id: ledger.data.id }, data: { process_status: "received", process_error: null, processed_at: null } });
    }
    return { id: ledger.data.id, duplicate: false };
  };

  if (event.data.event_type === "call.ai_gather.message_history_updated") {
    const historyResult = await withCaptureLock(capture.account_id, capture.provider_call_id, async (client) => {
      const current = await client.callCaptureSession.findUnique({ where: { id: capture.id } });
      const [latestConsent, start] = await Promise.all([
        client.callConsentEvent.findFirst({ where: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, artifact: "transcript" }, orderBy: [{ occurred_at: "desc" }, { id: "desc" }] }),
        client.telnyxCallCommand.findFirst({ where: { capture_session_id: capture.id, command_type: "ai_assistant_start", generation: capture.generation, status: "succeeded" } }),
      ]);
      const activeAdmission = current?.content_admission_closed_at === null && ["START_PENDING", "AI_ACTIVE"].includes(current.control_state);
      const terminalReconciliation = current?.control_state === "FINALIZING" && current.capture_ended_at !== null;
      const admitted = Boolean(current && latestConsent?.action === "grant" && start?.provider_date_at && start.conversation_id && (activeAdmission || terminalReconciliation) && (!event.data.payload.conversation_id || event.data.payload.conversation_id === start.conversation_id));
      const ledger = await record(admitted ? params.rawBody : JSON.stringify(persistedEvent), client);
      if (ledger.duplicate) return { duplicate: true as const };
      if (!admitted || !current || !start?.provider_date_at || !start.conversation_id) {
        await setWebhookProcessStatus({ client, id: ledger.id, process_status: "rejected", process_error: "protected_content_not_admitted" });
        return { duplicate: false as const, captureId: capture.id };
      }
      try {
        if (!current.capture_started_at) {
          await client.callCaptureSession.updateMany({ where: { id: capture.id, control_state: "START_PENDING", generation: capture.generation, content_admission_closed_at: null }, data: { control_state: "AI_ACTIVE", capture_started_at: start.provider_date_at, conversation_id: start.conversation_id } });
        }
        const refreshed = await client.callCaptureSession.findUnique({ where: { id: capture.id } });
        const admission = refreshed ? await recordTranscriptRevision(event, refreshed, ledger.id, numberE164, client) : "rejected";
        if (admission === "rejected" || admission === "stale_or_conflicting") await setWebhookProcessStatus({ client, id: ledger.id, process_status: "rejected", process_error: admission === "stale_or_conflicting" ? "cumulative_history_conflict" : "protected_content_not_admitted" });
        else if (admission === "duplicate") await setWebhookProcessStatus({ client, id: ledger.id, process_status: "processed" });
        return { duplicate: false as const, captureId: capture.id };
      } catch (error) {
        await setWebhookProcessStatus({ client, id: ledger.id, process_status: "error", process_error: error instanceof Error ? error.message : "call_control_failed" });
        return { processingError: error };
      }
    });
    if ("processingError" in historyResult) throw historyResult.processingError;
    await freezeEvidence(capture.id);
    return historyResult;
  }

  const ledger = await record(params.rawBody);
  if (ledger.duplicate) return { duplicate: true };
  try {
    if (event.data.event_type === "call.initiated") {
      await normalizeMetadata(event, capture, ledger.id, numberE164);
      if (capture.control_state === "CALL_RECEIVED") {
        const result = await executeCommand({ capture, commandType: "answer", action: "answer", request: { client_state: clientState(capture.id, capture.generation) } });
        if (result.status !== "succeeded") throw new Error(result.error_code ?? "telnyx_answer_unconfirmed");
      }
    } else if (event.data.event_type === "call.answered") {
      if (["CALL_RECEIVED", "DISCLOSURE_PLAYING"].includes(capture.control_state)) {
        if (!runtime) throw new Error("qualification_runtime_unavailable");
        const context = buildSupervisedAgentContext({ businessName: runtime.accountName, agentName: runtime.agentName, memory: runtime.memory, policy: runtime.contextPolicy });
        await db.callCaptureSession.updateMany({ where: { id: capture.id, control_state: "CALL_RECEIVED" }, data: { control_state: "DISCLOSURE_PLAYING" } });
        const result = await executeCommand({ capture, commandType: "disclosure", action: "speak", request: { payload: context.ai_disclosure + DISCLOSURE_PROMPT, voice: "female", service_level: "basic", language: "en-US", client_state: clientState(capture.id, capture.generation) } });
        if (result.status !== "succeeded") throw new Error(result.error_code ?? "telnyx_disclosure_unconfirmed");
      } else {
        await setWebhookProcessStatus({ id: ledger.id, process_status: "processed" });
      }
    } else if (event.data.event_type === "call.speak.ended") {
      const moved = await db.callCaptureSession.updateMany({ where: { id: capture.id, control_state: "DISCLOSURE_PLAYING", generation: capture.generation }, data: { control_state: "AWAITING_DTMF", disclosure_completed_at: occurredAt } });
      if (moved.count || capture.control_state === "AWAITING_DTMF") {
        const result = await executeCommand({ capture, commandType: "consent_gather", action: "gather_using_speak", request: { payload: GATHER_PROMPT, voice: "female", service_level: "basic", language: "en-US", maximum_digits: 1, maximum_tries: 1, timeout_millis: 10_000, valid_digits: "12", client_state: clientState(capture.id, capture.generation) } });
        if (result.status !== "succeeded") throw new Error(result.error_code ?? "telnyx_gather_unconfirmed");
      } else if (["REFUSED", "AMBIGUOUS"].includes(capture.control_state)) {
        const result = await executeCommand({ capture, commandType: "hangup", action: "hangup", request: { client_state: clientState(capture.id, capture.generation) } });
        if (result.status !== "succeeded") throw new Error(result.error_code ?? "telnyx_hangup_unconfirmed");
      }
    } else if (event.data.event_type === "call.gather.ended") {
      const decision = event.data.payload.status === "valid" && event.data.payload.digits === "1" ? "affirmative" : event.data.payload.status === "valid" && event.data.payload.digits === "2" ? "refused" : "ambiguous";
      const moved = await db.callCaptureSession.updateMany({ where: { id: capture.id, control_state: "AWAITING_DTMF", generation: capture.generation }, data: { control_state: decision === "ambiguous" ? "AMBIGUOUS" : "CONSENT_PENDING_OPERATOR", dtmf_decision: decision, dtmf_event_id: event.data.id } });
      const expectedState = decision === "ambiguous" ? "AMBIGUOUS" : "CONSENT_PENDING_OPERATOR";
      if (!moved.count && (capture.control_state !== expectedState || capture.dtmf_decision !== decision)) throw new Error("stale_capture_state");
      if (decision === "ambiguous") {
        const result = await executeCommand({ capture: { ...capture, generation: capture.generation }, commandType: "ambiguous_end", action: "speak", request: { payload: "I did not receive clear permission, so I will not collect any details. Please contact the team directly for help.", voice: "female", service_level: "basic", language: "en-US", client_state: clientState(capture.id, capture.generation) } });
        if (result.status !== "succeeded") throw new Error(result.error_code ?? "telnyx_ambiguous_end_unconfirmed");
      }
      await setWebhookProcessStatus({ id: ledger.id, process_status: "processed" });
    } else if (event.data.event_type === "call.conversation.ended") {
      await normalizeMetadata(event, capture, ledger.id, numberE164);
      await withCaptureLock(capture.account_id, capture.provider_call_id, async (client) => {
        const current = await client.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id } });
        const withdrawal = await client.callConsentEvent.findFirst({ where: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, action: "withdraw", artifact: "transcript" }, orderBy: { occurred_at: "desc" } });
        const transferState = ["TRANSFER_PENDING", "TRANSFERRED"].includes(current.control_state);
        await client.callCaptureSession.update({ where: { id: capture.id }, data: {
          capture_ended_at: withdrawal?.occurred_at ?? occurredAt,
          content_admission_closed_at: current.content_admission_closed_at ?? withdrawal?.occurred_at ?? occurredAt,
          control_state: transferState ? current.control_state : withdrawal ? "STOP_PENDING" : "FINALIZING",
        } });
      });
      await freezeEvidence(capture.id);
    } else if (event.data.event_type === "call.bridged") {
      const moved = await db.callCaptureSession.updateMany({ where: { id: capture.id, control_state: "TRANSFER_PENDING", generation: capture.generation }, data: { control_state: "TRANSFERRED" } });
      if (!moved.count) throw new Error("stale_capture_state");
      await setWebhookProcessStatus({ id: ledger.id, process_status: "processed" });
    } else if (event.data.event_type === "call.hangup") {
      await normalizeMetadata(event, capture, ledger.id, numberE164);
      await withCaptureLock(capture.account_id, capture.provider_call_id, async (client) => {
        const current = await client.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id } });
        if (["REFUSED", "AMBIGUOUS", "STOPPED", "TRANSFERRED", "EVIDENCE_FROZEN"].includes(current.control_state)) return;
        const terminalConversation = ["START_PENDING", "AI_ACTIVE", "STOP_PENDING", "FINALIZING"].includes(current.control_state);
        await client.callCaptureSession.update({ where: { id: capture.id }, data: {
          control_state: terminalConversation ? current.control_state === "STOP_PENDING" ? "STOP_PENDING" : "FINALIZING" : "SAFE_FALLBACK",
          content_admission_closed_at: current.content_admission_closed_at ?? occurredAt,
          capture_ended_at: current.capture_ended_at ?? occurredAt,
        } });
      });
      await freezeEvidence(capture.id);
    } else {
      await setWebhookProcessStatus({ id: ledger.id, process_status: "processed" });
    }
    return { duplicate: false, captureId: capture.id };
  } catch (error) {
    await setWebhookProcessStatus({ id: ledger.id, process_status: "error", process_error: error instanceof Error ? error.message : "call_control_failed" });
    throw error;
  }
}

export async function runOperatorConsentEffect(params: { captureId: string; action: "grant" | "refuse" | "withdraw" }) {
  if (!db) throw new Error("database_unavailable");
  const capture = await db.callCaptureSession.findUnique({ where: { id: params.captureId } });
  if (!capture?.assignment_id) throw new Error("qualification_capture_not_found");
  if (params.action === "grant") {
    if (capture.control_state !== "START_PENDING" || capture.dtmf_decision !== "affirmative") throw new Error("affirmative_dtmf_required");
    const assignment = await db.telephonyNumberAssignment.findUnique({ where: { id: capture.assignment_id } });
    if (!assignment || assignment.status !== "qualification") throw new Error("qualification_assignment_mismatch");
    const result = await executeCommand({ capture, commandType: "ai_assistant_start", action: "ai_assistant_start", request: { assistant: { id: assignment.provider_assistant_id }, send_message_history_updates: true, client_state: clientState(capture.id, capture.generation) } });
    if (result.status === "succeeded" && result.conversation_id) await db.callCaptureSession.update({ where: { id: capture.id }, data: { conversation_id: result.conversation_id } });
    if (result.status !== "succeeded" || !result.conversation_id) throw new Error(result.error_code ?? "telnyx_start_unconfirmed");
    return;
  }
  if (params.action === "refuse") {
    if (capture.control_state !== "REFUSED" || capture.dtmf_decision !== "refused") throw new Error("refusal_dtmf_required");
    const memory = BusinessMemorySnapshotSchema.parse(capture.snapshot_json);
    const configured = readOperatingConfigurationValue(memory, "policy.consent")?.refusal.acknowledgement;
    const result = await executeCommand({ capture, commandType: "refusal_ack", action: "speak", request: { payload: configured || "No problem. I won't collect any more details.", voice: "female", service_level: "basic", language: "en-US", client_state: clientState(capture.id, capture.generation) } });
    if (result.status !== "succeeded") throw new Error(result.error_code ?? "telnyx_refusal_ack_unconfirmed");
    return;
  }
  if (capture.control_state !== "STOP_PENDING") throw new Error("active_capture_required");
  const generation = capture.generation;
  const result = await executeCommand({ capture, commandType: "ai_assistant_stop", action: "ai_assistant_stop", request: { client_state: clientState(capture.id, generation) } });
  if (result.status !== "succeeded") throw new Error(result.error_code ?? "telnyx_stop_unconfirmed");
  await freezeEvidence(capture.id);
}

export async function requestQualifiedTransfer(params: { captureId: string; destination: string }) {
  if (!db) throw new Error("database_unavailable");
  const capture = await db.callCaptureSession.findUnique({ where: { id: params.captureId } });
  if (!capture?.assignment_id || capture.control_state !== "AI_ACTIVE") throw new Error("active_capture_required");
  const memory = BusinessMemorySnapshotSchema.safeParse(capture.snapshot_json);
  const allowed = memory.success ? readOperatingConfigurationValue(memory.data, "contact.escalation.primary")?.phone : null;
  if (!allowed || params.destination !== allowed) throw new Error("transfer_destination_denied");
  const moved = await db.callCaptureSession.updateMany({ where: { id: capture.id, generation: capture.generation, control_state: "AI_ACTIVE" }, data: { control_state: "TRANSFER_PENDING", content_admission_closed_at: new Date() } });
  if (!moved.count) throw new Error("stale_capture_state");
  const stopped = await executeCommand({ capture, commandType: "ai_assistant_stop", action: "ai_assistant_stop", request: { client_state: clientState(capture.id, capture.generation) } });
  if (stopped.status !== "succeeded") throw new Error(stopped.error_code ?? "telnyx_stop_unconfirmed");
  const result = await executeCommand({ capture, commandType: "transfer", action: "transfer", request: { to: allowed, client_state: clientState(capture.id, capture.generation) } });
  if (result.status !== "succeeded") throw new Error(result.error_code ?? "telnyx_transfer_unconfirmed");
  return { attempted: true, connected: false };
}
