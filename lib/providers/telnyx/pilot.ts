import "@/lib/serverOnlyGuard";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { PilotConfig } from "@/lib/communications/pilot/config";
import type { Intent, Leg, Observation, PilotState } from "@/lib/communications/pilot/machine";
import { FRL_GREETING, FRL_CONSENT_PROMPT, FRL_NAME_PROMPT, FRL_TRANSFER_PROMPT, FRL_NO_CONSENT_PROMPT } from "@/lib/communications/consent/mock-intake";
import type { TelnyxWebhookEnvelope } from "./webhook";

const identifier = z.string().min(1).max(256);
const basePayload = z.object({ call_control_id: identifier, call_leg_id: identifier, call_session_id: identifier, connection_id: identifier, client_state: z.string().max(1024).optional() });
export function legFromPayload(payload: unknown): Leg | null {
  const p = basePayload.safeParse(payload);
  return p.success ? { controlId: p.data.call_control_id, legId: p.data.call_leg_id, sessionId: p.data.call_session_id } : null;
}
export function stateToken(runId: string, commandId: string): string { return Buffer.from(JSON.stringify({ v: 1, runId, commandId })).toString("base64"); }
export function decodeToken(input: unknown): { runId: string; commandId: string } | null {
  try {
    if (typeof input !== "string" || input.length > 1024) return null;
    return z.object({ v: z.literal(1), runId: z.string().uuid(), commandId: z.string().uuid() }).strict().parse(JSON.parse(Buffer.from(input, "base64").toString()));
  } catch { return null; }
}
export function observation(event: TelnyxWebhookEnvelope, s: PilotState): Observation | null {
  const p = basePayload.safeParse(event.data.payload);
  const at = Date.parse(event.data.occurred_at ?? "");
  if (!p.success || !Number.isFinite(at)) return null;
  const role = (["caller", "operator"] as const).find(r => s[r]?.controlId === p.data.call_control_id && s[r]?.legId === p.data.call_leg_id && s[r]?.sessionId === p.data.call_session_id);
  if (!role) return null;
  const token = decodeToken(p.data.client_state);
  if (token && token.runId !== s.id) return null;
  const common = { id: createHash("sha256").update(`telnyx:${event.data.id}`).digest("hex"), at, role, token: token?.commandId };
  const payload = event.data.payload;
  switch (event.data.event_type) {
    case "call.answered": return { ...common, kind: "answered" };
    case "call.hangup": return { ...common, kind: "hangup" };
    case "call.bridged": return { ...common, kind: "bridged" };
    case "call.speak.ended": return payload.status === "completed" ? { ...common, kind: "prompt_done" } : { ...common, kind: "failure" };
    case "call.gather.ended": return { ...common, kind: "consent", digit: typeof payload.digits === "string" ? payload.digits : "", valid: payload.status === "valid" };
    case "call.dtmf.received": return payload.digit === "*" ? { ...common, kind: "withdraw" } : null;
    case "call.recording.error": return { ...common, kind: "failure" };
    case "call.recording.saved": {
      const r = z.object({ recording_id: z.string().uuid(), recording_started_at: z.iso.datetime({ offset: true }), recording_ended_at: z.iso.datetime({ offset: true }), channels: z.enum(["single", "dual"]) }).safeParse(payload);
      return r.success ? { ...common, kind: "recording", recordingId: r.data.recording_id, start: Date.parse(r.data.recording_started_at), end: Date.parse(r.data.recording_ended_at), channels: r.data.channels } : { ...common, kind: "failure" };
    }
    default: return null;
  }
}
export function pilotRequest(s: PilotState, i: Intent, c: PilotConfig, now: number) {
  const body: Record<string, unknown> = { command_id: i.id, client_state: stateToken(s.id, i.id) };
  if (i.purpose === "dial") return { path: "/v2/calls", body: { ...body, connection_id: c.applicationId,
    to: c.operator, from: c.number, link_to: s.caller.controlId, bridge_on_answer: false,
    timeout_secs: 20, time_limit_secs: Math.max(1, Math.floor((s.endsAt - now) / 1000)) } };
  const leg = s[i.role];
  if (!leg) throw new Error("pilot_leg_missing");
  let action: string;
  switch (i.purpose) {
    case "answer": action = "answer"; break;
    case "hangup": action = "hangup"; delete body.client_state; break;
    case "stop": {
      action = "record_stop";
      const w = s.windows.findLast(w => !w.endedAt);
      if (w) body.client_state = stateToken(s.id, w.commandId);
      break;
    }
    case "bridge":
      if (!s.operator) throw new Error("pilot_operator_missing");
      action = "bridge"; Object.assign(body, { call_control_id: s.operator.controlId, prevent_double_bridge: true }); break;
    case "name":
    case "conversation":
      action = "record_start";
      Object.assign(body, { format: "wav", channels: i.purpose === "name" ? "single" : "dual", recording_track: i.purpose === "name" ? "inbound" : "both",
        play_beep: true, max_length: Math.min(i.purpose === "name" ? 8 : 300, Math.max(1, Math.floor(((s.windows.find(w => w.commandId === i.id)?.limitAt ?? now) - now) / 1000))),
        timeout_secs: 0, transcription: true, transcription_engine: "B", transcription_language: "en" }); break;
    default: {
      action = ["caller_consent", "operator_consent"].includes(i.purpose) ? "gather_using_speak" : "speak";
      const prompts = {
        caller_consent: `${FRL_GREETING} ${FRL_CONSENT_PROMPT} To withdraw permission and end the call at any time, press star.`,
        operator_consent: s.captureDenied
          ? "Florida Ramp and Lift pilot call. This call will not be recorded or transcribed. Press 1 to accept the call, or press 2 to accept without recording. Otherwise hang up."
          : "Florida Ramp and Lift pilot call. With your permission, the bridged conversation will be recorded and transcribed to document the request and coordinate follow-up. Press 1 to accept and consent, or press 2 to accept without recording or transcription. To withdraw permission and end the call at any time, press star.",
        name_prompt: FRL_NAME_PROMPT, hold: s.captureDenied ? FRL_NO_CONSENT_PROMPT : FRL_TRANSFER_PROMPT,
        unavailable: "We are unable to connect your call. Please try again later.",
      };
      Object.assign(body, { payload: prompts[i.purpose], payload_type: "text", voice: "female", language: "en-US", service_level: "basic" });
      if (action === "gather_using_speak") Object.assign(body, { minimum_digits: 1, maximum_digits: 1, maximum_tries: 1, timeout_millis: 10000 });
    }
  }
  return { path: `/v2/calls/${encodeURIComponent(leg.controlId)}/actions/${action}`, body };
}
export type DispatchResult = { kind: "accepted"; leg?: Leg } | { kind: "failed" | "uncertain" };
export type PilotTransport = (request: ReturnType<typeof pilotRequest>, dial: boolean) => Promise<DispatchResult>;
export function telnyxPilotTransport(apiKey: string): PilotTransport {
  return async (request, dial) => {
    try {
      const response = await fetch(`https://api.telnyx.com${request.path}`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(request.body), signal: AbortSignal.timeout(5000), redirect: "error" });
      if (!response.ok) return { kind: response.status >= 500 || response.status === 429 ? "uncertain" : "failed" };
      const result = await response.json();
      if (dial) {
        const d = z.object({ data: z.object({ call_control_id: identifier, call_leg_id: identifier, call_session_id: identifier }) }).safeParse(result);
        return d.success ? { kind: "accepted", leg: { controlId: d.data.data.call_control_id, legId: d.data.data.call_leg_id, sessionId: d.data.data.call_session_id } } : { kind: "uncertain" };
      }
      return result?.data?.result === "ok" ? { kind: "accepted" } : { kind: "uncertain" };
    } catch { return { kind: "uncertain" }; }
  };
}
