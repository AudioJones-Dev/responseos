import { createHash } from "node:crypto";
import { z } from "zod";
import type { Leg, Role } from "./machine";
import type { TelnyxWebhookEnvelope } from "@/lib/providers/telnyx/webhook";
import { decodeToken, stateToken } from "@/lib/providers/telnyx/pilot";

export type SpeechDecision = "agree" | "decline_capture" | "withdraw" | "unclear";
export type SpeechBinding = {
  accountId: string; applicationId: string; runId: string; commandId: string;
  role: Role; leg: Leg; disclosure: "frl-spoken-v2";
  issuedAt: number; expiresAt: number; consumedAt?: number;
  conversationId?: string;
};
export type SpeechEvidence = {
  method: "speech"; decision: SpeechDecision; eventId: string; at: number;
  role: Role; disclosure: "frl-spoken-v2";
};

export function classifyConsentSpeech(value: unknown): SpeechDecision {
  if (typeof value !== "string" || value.length > 200) return "unclear";
  const text = value.trim().toLowerCase().replace(/[.!?]+$/, "").replace(/\s+/g, " ");
  if (["yes", "yes please", "i agree", "yes i agree", "yes, i agree", "i consent", "yes i consent", "yes, i consent"].includes(text)) return "agree";
  if (["no", "no thanks", "no thank you", "no, thank you", "do not record", "don't record", "i do not consent"].includes(text)) return "decline_capture";
  if (["stop recording", "please stop recording", "withdraw consent", "i withdraw consent", "end the call"].includes(text)) return "withdraw";
  return "unclear";
}

function matches(event: TelnyxWebhookEnvelope, binding: SpeechBinding, accountId: string) {
  const p = event.data.payload;
  const token = decodeToken(p.client_state);
  return accountId === binding.accountId && p.connection_id === binding.applicationId &&
    p.call_control_id === binding.leg.controlId && p.call_leg_id === binding.leg.legId &&
    p.call_session_id === binding.leg.sessionId && token?.runId === binding.runId && token.commandId === binding.commandId;
}

// Call only after raw-body signature/freshness verification and tenant resolution.
export function bindSpeechConversation(event: TelnyxWebhookEnvelope, binding: SpeechBinding, accountId: string, now: number): SpeechBinding | null {
  if (event.data.event_type !== "call.conversation.created" || !matches(event, binding, accountId)) return null;
  const at = Date.parse(event.data.occurred_at ?? "");
  const id = z.string().uuid().safeParse(event.data.payload.conversation_id);
  if (!id.success || !Number.isFinite(at) || at < binding.issuedAt || at > now + 2000 ) return null;
  if (binding.conversationId && binding.conversationId !== id.data) return null;
  return { ...binding, conversationId: id.data };
}

export function consumeSpeechConsent(event: TelnyxWebhookEnvelope, binding: SpeechBinding, accountId: string, now: number): { binding: SpeechBinding; evidence: SpeechEvidence } | null {
  if (event.data.event_type !== "call.ai_gather.ended" || !matches(event, binding, accountId) ||
      !binding.conversationId || binding.consumedAt !== undefined || now >= binding.expiresAt) return null;
  const at = Date.parse(event.data.occurred_at ?? "");
  if (!Number.isFinite(at) || at < binding.issuedAt || at > now + 2000 || at >= binding.expiresAt) return null;
  const payload = event.data.payload;
  if (payload.conversation_id !== undefined && payload.conversation_id !== binding.conversationId) return null;
  const parsed = z.object({
    status: z.literal("valid"),
    result: z.object({ decision: z.enum(["agree", "decline_capture", "withdraw", "unclear"]) }).strict(),
    message_history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(8),
  }).safeParse(payload);
  const history = z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(8).safeParse(payload.message_history);
  const withdrawal = history.success && history.data.some(m => m.role === "user" && classifyConsentSpeech(m.content) === "withdraw");
  let decision: SpeechDecision = withdrawal ? "withdraw" : "unclear";
  if (parsed.success && !withdrawal) {
    const turns = parsed.data.message_history.filter(m => m.role === "user");
    // Multiple answers or model-only agreement cannot establish unambiguous consent.
    if (turns.length === 1) {
      const spoken = classifyConsentSpeech(turns[0].content);
      if (spoken === "withdraw" || spoken === "decline_capture" || spoken === parsed.data.result.decision) decision = spoken;
    }
  }
  return { binding: { ...binding, consumedAt: now }, evidence: {
    method: "speech", decision, eventId: createHash("sha256").update(`telnyx:${event.data.id}`).digest("hex"),
    at, role: binding.role, disclosure: binding.disclosure,
  } };
}

export function speechGatherRequest(binding: SpeechBinding, approvedPrompt: string, now: number) {
  if (binding.consumedAt !== undefined || now < binding.issuedAt || now >= binding.expiresAt ||
      !approvedPrompt.trim() || approvedPrompt.length > 3000) throw new Error("speech_gather_not_authorized");
  return { path: `/v2/calls/${encodeURIComponent(binding.leg.controlId)}/actions/gather_using_ai`, body: {
    command_id: binding.commandId, client_state: stateToken(binding.runId, binding.commandId), greeting: approvedPrompt,
    user_response_timeout_ms: Math.min(10000, binding.expiresAt - now),
    send_partial_results: false, send_message_history_updates: false,
    parameters: { type: "object", additionalProperties: false, required: ["decision"], properties: {
      decision: { type: "string", enum: ["agree", "decline_capture", "withdraw", "unclear"],
        description: "Classify the answer to the disclosure. Only an explicit unqualified yes grants agreement. No means decline_capture. Stop recording or withdrawal means withdraw. Silence, mixed answers, conditional agreement or uncertainty mean unclear. Never infer agreement or persuade the caller." },
    } },
  } };
}

export async function deleteSpeechConversation(binding: SpeechBinding, accountId: string, key: string): Promise<"verified" | "retry" | "identity_mismatch"> {
  if (binding.accountId !== accountId || !binding.conversationId || !z.string().uuid().safeParse(binding.conversationId).success) return "identity_mismatch";
  const path = `https://api.telnyx.com/v2/ai/conversations/${encodeURIComponent(binding.conversationId)}`;
  const request = (method = "GET") => fetch(path, { method, headers: { Authorization: `Bearer ${key}` }, redirect: "error", signal: AbortSignal.timeout(5000) });
  try {
    const found = await request();
    if (found.status === 404) return "verified";
    if (!found.ok) return "retry";
    const parsed = z.object({ data: z.object({ id: z.string().uuid(), metadata: z.object({
      call_control_id: z.string(), call_leg_id: z.string(), call_session_id: z.string(), telnyx_conversation_channel: z.literal("phone_call"),
    }) }) }).safeParse(await found.json());
    if (!parsed.success || parsed.data.data.id !== binding.conversationId ||
        parsed.data.data.metadata.call_control_id !== binding.leg.controlId ||
        parsed.data.data.metadata.call_leg_id !== binding.leg.legId ||
        parsed.data.data.metadata.call_session_id !== binding.leg.sessionId) return "identity_mismatch";
    const removed = await request("DELETE");
    if (!removed.ok && removed.status !== 404) return "retry";
    return (await request()).status === 404 ? "verified" : "retry";
  } catch { return "retry"; }
}

export const SPOKEN_CALLER_PROMPT = "This automated system processes your speech for call controls, including requests to stop. May we also save a recording and transcript of your name and this call to document your request and coordinate follow-up? Say yes to agree, or no to continue without saving a recording or transcript. Say stop recording to withdraw permission and end the call.";
export const SPOKEN_OPERATOR_PROMPT = SPOKEN_CALLER_PROMPT;
export const SPOKEN_UNRECORDED_OPERATOR_PROMPT = SPOKEN_CALLER_PROMPT;
