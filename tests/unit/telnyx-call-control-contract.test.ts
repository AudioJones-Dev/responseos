import { describe, expect, test } from "vitest";
import { parseCallControlEvent } from "@/lib/providers/telnyx/callControl";

function envelope(eventType: string, payload: Record<string, unknown>) {
  return JSON.stringify({ data: { id: "event-1", event_type: eventType, occurred_at: "2026-09-16T12:00:00.000Z", payload } });
}

describe("Telnyx Call Control contract", () => {
  test("accepts only allowlisted signed-JSON shapes and strips unknown fields", () => {
    const parsed = parseCallControlEvent(envelope("call.gather.ended", { call_control_id: "control", call_session_id: "session", digits: "1", status: "valid", access_token: "must-not-persist" }));
    expect(parsed?.data.payload).toEqual({ call_control_id: "control", call_session_id: "session", digits: "1", status: "valid" });
    expect(JSON.stringify(parsed)).not.toContain("access_token");
  });

  test("rejects TeXML form data, unknown events, and malformed protected history", () => {
    expect(parseCallControlEvent("CallStatus=completed&CallSid=abc")).toBeNull();
    expect(parseCallControlEvent(envelope("call.recording.saved", { call_control_id: "control", call_session_id: "session" }))).toBeNull();
    expect(parseCallControlEvent(envelope("call.ai_gather.message_history_updated", { call_control_id: "control", call_session_id: "session", message_history: [{ role: "user" }] }))).toBeNull();
    expect(parseCallControlEvent(envelope("call.hangup", { call_control_id: "control", call_session_id: "session", message_history: [{ role: "user", content: "protected" }] }))).toBeNull();
  });
});
