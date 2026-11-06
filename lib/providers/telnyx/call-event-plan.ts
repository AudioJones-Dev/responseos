import { z } from "zod";
import type { CallInput, CallInputEnvelope } from "@/lib/communications/orchestration/mock-call";
import type { CallCommand } from "@/lib/communications/orchestration/contracts";
import { parseTelnyxWebhook, verifyTelnyxWebhook } from "./webhook";

const metadata = z.object({
  call_control_id: z.string().min(1).max(512), call_leg_id: z.string().min(1).max(200),
  call_session_id: z.string().min(1).max(200), client_state: z.string().max(512).optional(),
  digits: z.string().max(16).optional(), status: z.string().max(32).optional(),
});
export interface TrustedCallBinding {
  accountId: string;
  callId: string;
  caller: { controlId: string; legId: string; sessionId: string };
  target?: { controlId: string; legId: string; sessionId: string };
  commands: CallCommand[];
}

/** Offline mapping exercise; not mounted as a webhook route or a consent writer. */
export function normalizeCallControlFixture(input: {
  rawBody: string; signature: string | null; timestamp: string | null; publicKey: string; now: Date;
}, binding: TrustedCallBinding): { ok: true; event: CallInputEnvelope } | { ok: false; reason: "signature" | "mapping" | "unsupported" } {
  if (!verifyTelnyxWebhook(input).ok) return { ok: false, reason: "signature" };
  const envelope = parseTelnyxWebhook(input.rawBody);
  if (!envelope || !envelope.data.occurred_at || !z.iso.datetime({ offset: true }).safeParse(envelope.data.occurred_at).success ||
      !/^[A-Za-z0-9:_-]{1,160}$/.test(envelope.data.id)) return { ok: false, reason: "mapping" };
  const kind = envelope.data.event_type;
  if (!["call.initiated", "call.answered", "call.speak.ended", "call.gather.ended", "call.bridged", "call.hangup"].includes(kind)) return { ok: false, reason: "unsupported" };
  const parsed = metadata.safeParse(envelope.data.payload);
  if (!parsed.success) return { ok: false, reason: "mapping" };
  const payload = parsed.data;
  const matches = (leg: TrustedCallBinding["caller"] | undefined) => !!leg && payload.call_control_id === leg.controlId && payload.call_leg_id === leg.legId && payload.call_session_id === leg.sessionId;
  const caller = matches(binding.caller), target = matches(binding.target);
  if (!caller && !target) return { ok: false, reason: "mapping" };
  const command = binding.commands.find(c => c.accountId === binding.accountId && c.callId === binding.callId &&
    c.callControlId === binding.caller.controlId && c.legId === binding.caller.legId && Buffer.from(c.id).toString("base64") === payload.client_state);
  let event: CallInput;
  if (kind === "call.initiated" && caller) event = { kind: "inbound" };
  else if (kind === "call.answered" && caller) event = { kind: "answered" };
  else if (kind === "call.speak.ended" && caller && command?.kind === "speak" && payload.status === "completed") event = { kind: "prompt_finished", commandId: command.id };
  else if (kind === "call.gather.ended" && caller && command?.kind === "collect_dtmf") event = { kind: "dtmf", digit: payload.status === "valid" && payload.digits === "1" ? "1" : "2" };
  else if (kind === "call.bridged" && target && command?.kind === "transfer") event = { kind: "transfer_connected" };
  else if (kind === "call.hangup" && caller) event = { kind: "hangup" };
  else if (kind === "call.hangup" && target && command?.kind === "transfer") event = { kind: "transfer_failed" };
  else return { ok: false, reason: "unsupported" };
  return { ok: true, event: { ...event, id: envelope.data.id, accountId: binding.accountId, callId: binding.callId,
    legId: binding.caller.legId, at: envelope.data.occurred_at } };
}
