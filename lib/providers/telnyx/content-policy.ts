import { createHash } from "node:crypto";
import { z } from "zod";
import type { TelnyxWebhookEnvelope } from "./webhook";

export const ROUTING_EVENTS = new Set(["call.initiated", "call.answered", "call.hangup", "call.bridged", "call.transfer.failed"]);
export const CONTENT_EVENTS = new Set(["call.conversation.ended", "call.transcription", "call.recording.saved", "call.conversation_insights.generated"]);
export function eventDigest(event: unknown): string {
  return createHash("sha256").update(JSON.stringify(event)).digest("hex");
}
export function contentFreeReceipt(body: string): string {
  try { return JSON.stringify({ version: 1, payload_sha256: eventDigest(JSON.parse(body)) }); }
  catch { return "<REJECTED_TELNYX_PAYLOAD>"; }
}
export function safeEventType(type: string): string {
  return ROUTING_EVENTS.has(type) || CONTENT_EVENTS.has(type) || type === "call.dtmf.received" ? type : "telnyx.unsupported";
}

const identifier = z.string().regex(/^[A-Za-z0-9:_-]{1,200}$/);
const timestamp = z.iso.datetime({ offset: true });
const phone = z.string().regex(/^\+[1-9]\d{7,14}$/);
const routingSchema = z.object({
  call_control_id: identifier, call_leg_id: identifier,
  from: phone.optional(), to: phone.optional(),
  start_time: timestamp.optional(), end_time: timestamp.optional(),
  duration_secs: z.number().int().min(0).max(86400).optional(),
});
// Capture interval and complete participant roster are a required adapter contract,
// not inferred from webhook delivery time or claimed to exist in every Telnyx event.
const transcriptSchema = routingSchema.extend({
  transcript: z.string().min(1).max(100000),
  start_time: timestamp, end_time: timestamp,
  participant_leg_ids: z.array(identifier).min(2).max(16),
});

export function classifyTelnyxPayload(event: TelnyxWebhookEnvelope) {
  if (ROUTING_EVENTS.has(event.data.event_type)) {
    const parsed = routingSchema.safeParse(event.data.payload);
    return parsed.success ? { kind: "routing" as const, payload: parsed.data } : { kind: "rejected" as const };
  }
  if (event.data.event_type === "call.conversation.ended") {
    const parsed = transcriptSchema.safeParse(event.data.payload);
    return parsed.success ? { kind: "transcript" as const, payload: parsed.data } : { kind: "rejected" as const };
  }
  return { kind: "rejected" as const };
}
