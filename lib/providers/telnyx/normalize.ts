import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { computeDedupeHash } from "@/lib/data/webhookEvents";
import { PURGED_CALLER_NUMBER } from "@/lib/retention/periods";
import { captureStateSchema, permitsTranscript, transitionCapture } from "@/lib/communications/consent/capture";
import { lockCapture } from "@/lib/communications/consent/store";
import { classifyTelnyxPayload, eventDigest } from "./content-policy";
import { getTelnyxCallId, getTelnyxOccurredAt, type TelnyxWebhookEnvelope } from "./webhook";

type NormalizeInput = {
  accountId: string; demoNumber: string; webhookEventId: string;
  event: TelnyxWebhookEnvelope; transcriptExpiresAt?: Date;
};

export async function normalizeTelnyxEvent(params: NormalizeInput): Promise<{ callId: string | null; finalized: boolean }> {
  if (!db) throw new Error("database_unavailable");
  const providerCallId = getTelnyxCallId(params.event.data.payload);
  if (!providerCallId) return { callId: null, finalized: false };
  return db.$transaction(async tx => {
    await lockCapture(tx, params.accountId, providerCallId);
    const receipt = await tx.webhookEvent.findFirst({ where: {
      id: params.webhookEventId, account_id: params.accountId, provider: "telnyx",
      provider_event_id: computeDedupeHash("telnyx", params.event.data.id), signature_valid: true,
    } });
    const reject = async (code: string) => {
      if (receipt && receipt.process_status !== "processed") await tx.webhookEvent.update({
        where: { id: receipt.id, account_id: params.accountId },
        data: { process_status: "rejected", process_error: code, processed_at: new Date() },
      });
      return { callId: null, finalized: false };
    };
    if (!receipt || receipt.payload_purged_at || (receipt.payload_expires_at && receipt.payload_expires_at <= new Date())) return reject("consent_receipt_unavailable");
    let evidence: { payload_sha256?: string };
    try { evidence = JSON.parse(receipt.raw_body); } catch { return reject("consent_receipt_invalid"); }
    if (evidence.payload_sha256 !== eventDigest(params.event)) return reject("consent_payload_mismatch");
    if (receipt.process_status === "processed" || receipt.process_status === "rejected") return { callId: null, finalized: false };
    const existing = await tx.call.findUnique({ where: { account_id_provider_provider_call_id: {
      account_id: params.accountId, provider: "telnyx", provider_call_id: providerCallId,
    } } });
    if (existing?.from_number === PURGED_CALLER_NUMBER) return reject("call_content_purged");
    const classified = classifyTelnyxPayload(params.event);
    const occurredAt = getTelnyxOccurredAt(params.event);
    if (classified.kind === "rejected" || !occurredAt) return reject("consent_content_unproven");
    const payload = classified.payload;
    if (payload.to && payload.to !== params.demoNumber) return reject("unexpected_destination");
    const consent = await tx.callCaptureConsent.findUnique({ where: { account_id_provider_call_id: {
      account_id: params.accountId, provider_call_id: providerCallId,
    } } });
    const parsed = captureStateSchema.safeParse(consent?.state_json);
    let state = parsed.success ? parsed.data : null;
    if (consent && state && (params.event.data.event_type === "call.transfer.failed" || params.event.data.event_type === "call.bridged" ||
        !state.participants.some(p => p.legId === payload.call_leg_id) ||
        (classified.kind === "transcript" && (classified.payload.participant_leg_ids.length !== state.participants.length ||
          classified.payload.participant_leg_ids.some(leg => !state!.participants.some(p => p.legId === leg)))))) {
      state = transitionCapture(state, { id: eventDigest(params.event), at: occurredAt.toISOString(), kind: params.event.data.event_type === "call.transfer.failed" ? "transfer_failed" : "participant_joined" });
      await tx.callCaptureConsent.update({ where: { id: consent.id, account_id: params.accountId }, data: { state_json: state, revision: { increment: 1 } } });
    }
    if (classified.kind === "transcript") {
      const content = classified.payload;
      if (!existing || !consent || consent.call_id !== existing.id || !state ||
          occurredAt < new Date(content.end_time) || !permitsTranscript(state, content.call_leg_id, content.participant_leg_ids, content.start_time, content.end_time, new Date())) {
        return reject("consent_required");
      }
      const previousSegment = await tx.callSegment.findFirst({ where: { account_id: params.accountId, call_id: existing.id }, orderBy: { sequence: "desc" } });
      const segment = await tx.callSegment.create({ data: {
        account_id: params.accountId, call_id: existing.id, sequence: (previousSegment?.sequence ?? -1) + 1,
        speaker: "system", text: content.transcript, started_at: new Date(content.start_time), ended_at: new Date(content.end_time),
      } });
      const segments = await tx.callSegment.findMany({ where: { account_id: params.accountId, call_id: existing.id }, orderBy: [{ started_at: "asc" }, { sequence: "asc" }] });
      const transcript = segments.map(s => s.text).join("\n");
      await tx.call.update({ where: { id: existing.id, account_id: params.accountId }, data: { transcript, status: "completed",
        ended_at: existing.ended_at && existing.ended_at > new Date(content.end_time) ? existing.ended_at : new Date(content.end_time) } });
      await tx.callTranscript.upsert({ where: { call_id: existing.id },
        create: { account_id: params.accountId, call_id: existing.id, inline_text: transcript,
          retention_lane: "full", expires_at: params.transcriptExpiresAt ?? new Date(state.expiresAt) },
        update: { inline_text: transcript, expires_at: params.transcriptExpiresAt ?? new Date(state.expiresAt) },
      });
      await tx.webhookEvent.update({ where: { id: receipt.id, account_id: params.accountId }, data: {
        process_status: "processed", processed_at: new Date(),
        raw_body: JSON.stringify({ ...evidence, consent_id: consent.id, consent_revision: consent.revision,
          call_id: existing.id, segment_id: segment.id, speaker_verified: false, leg_id: content.call_leg_id, participant_leg_ids: content.participant_leg_ids,
          start: content.start_time, end: content.end_time, scope: "transcription", crm: "blocked" }),
      } });
      return { callId: existing.id, finalized: false };
    }
    const completed = params.event.data.event_type === "call.hangup";
    const call = await tx.call.upsert({ where: { account_id_provider_provider_call_id: {
      account_id: params.accountId, provider: "telnyx", provider_call_id: providerCallId,
    } }, create: {
      account_id: params.accountId, provider: "telnyx", provider_call_id: providerCallId,
      direction: "inbound", status: completed ? "completed" : "answered",
      from_number: payload.from ?? "unavailable", to_number: params.demoNumber,
      started_at: payload.start_time ? new Date(payload.start_time) : occurredAt,
      ended_at: completed ? occurredAt : null,
    }, update: { ...(completed ? { status: "completed", ended_at: occurredAt } : {}) } });
    await tx.webhookEvent.update({ where: { id: receipt.id, account_id: params.accountId }, data: { process_status: "processed", processed_at: new Date() } });
    return { callId: call.id, finalized: false };
  });
}
