export const GROK_VOICE_MODEL = "grok-voice-3.0";

const callIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseUnverifiedIncomingCall(raw) {
  if (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > 65536) throw new Error("invalid_incoming_envelope");
  let event;
  try { event = JSON.parse(raw); } catch { throw new Error("invalid_incoming_envelope"); }
  if (!event || event.object !== "event" || event.type !== "realtime.call.incoming" ||
      typeof event.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(event.id) ||
      !Number.isSafeInteger(event.created_at) || event.created_at <= 0 ||
      typeof event.data?.call_id !== "string" || !callIdPattern.test(event.data.call_id)) {
    throw new Error("invalid_incoming_envelope");
  }
  // SIP headers and metadata cannot assign a tenant or prove a Telnyx call binding.
  return Object.freeze({ authenticated: false, eventId: event.id, callId: event.data.call_id, createdAt: event.created_at });
}

export function previewSipSession(callId) {
  if (typeof callId !== "string" || !callIdPattern.test(callId)) throw new Error("invalid_call_id");
  const url = new URL("wss://api.x.ai/v1/realtime");
  url.searchParams.set("call_id", callId);
  url.searchParams.set("model", GROK_VOICE_MODEL);
  return {
    executable: false,
    url: url.href,
    frames: [{
      type: "session.update",
      session: {
        voice: "eve",
        instructions: "This is an offline fictional qualification fixture. Do not claim to book, send messages, update records or transfer calls.",
        tools: [],
        turn_detection: null,
        resumption: { enabled: false },
      },
    }],
  };
}
