import { describe, expect, it } from "vitest";
import { initialCaptureState, transitionCapture, permitsTranscript, type CaptureEvent } from "@/lib/communications/consent/capture";
import { classifyTelnyxPayload, contentFreeReceipt } from "@/lib/providers/telnyx/content-policy";

const at = "2026-11-06T12:00:00Z";
const now = new Date("2026-11-06T12:05:00Z");
const initial = () => initialCaptureState("disclosure-test", "2026-11-06T13:00:00Z", [
  { legId: "caller-leg", role: "caller" }, { legId: "founder-leg", role: "founder" },
]);
function accepted() {
  let state = initial();
  for (const legId of ["caller-leg", "founder-leg"]) state = transitionCapture(state, { id: legId, at, kind: "decision", legId, choice: "accept" });
  return transitionCapture(state, { id: "ack", at, kind: "start_ack" });
}
const permitted = (state = accepted(), leg = "caller-leg", legs = ["caller-leg", "founder-leg"], start = at, end = "2026-11-06T12:01:00Z") => permitsTranscript(state, leg, legs, start, end, now);

describe("durable capture policy", () => {
  it("requires independent decisions and acknowledged start", () => {
    const state = initial();
    expect(permitted(state)).toBe(false);
    expect(() => transitionCapture(state, { id: "start", at, kind: "start_ack" })).toThrow("capture_start_not_authorized");
    expect(permitted()).toBe(true);
    expect(accepted().recordingPermitted).toBe(false);
  });
  it.each(["decline", "timeout", "revoke"] as const)("%s is terminal even after a late accept", choice => {
    let state = transitionCapture(accepted(), { id: "stop", at, kind: "decision", legId: "founder-leg", choice });
    state = transitionCapture(state, { id: "late", at, kind: "decision", legId: "founder-leg", choice: "accept" });
    expect(permitted(state)).toBe(false);
  });
  it.each(["stop_failed", "provider_failure", "transfer_failed", "participant_joined"] as const)("%s closes capture without claiming a successful stop", kind => {
    const state = transitionCapture(accepted(), { id: "failure", at, kind });
    expect(permitted(state)).toBe(false);
    expect(state.stopAcknowledged).toBe(false);
  });
  it("rejects delayed earlier content after revocation, even after stop acknowledgment", () => {
    let state = transitionCapture(accepted(), { id: "revoke", at: "2026-11-06T12:02:00Z", kind: "decision", legId: "caller-leg", choice: "revoke" });
    state = transitionCapture(state, { id: "stopped", at: "2026-11-06T12:03:00Z", kind: "stop_ack" });
    expect(state.stopAcknowledged).toBe(true);
    expect(permitted(state)).toBe(false);
  });
  it("deduplicates identical decisions and rejects conflicting reuse", () => {
    const event: CaptureEvent = { id: "event", at, kind: "decision", legId: "caller-leg", choice: "accept" };
    const state = transitionCapture(initial(), event);
    expect(transitionCapture(state, event)).toBe(state);
    expect(() => transitionCapture(state, { ...event, choice: "revoke" })).toThrow("conflicting_capture_event");
  });
  it("closes capture at the event budget and still accepts revocation", () => {
    let state = accepted();
    for (let i = state.events.length; i < 256; i++) state = transitionCapture(state, {
      id: `repeat-${i}`, at, kind: "decision", legId: "caller-leg", choice: "accept",
    });
    expect(permitted(state)).toBe(false);
    state = transitionCapture(state, { id: "late-revoke", at, kind: "decision", legId: "caller-leg", choice: "revoke" });
    expect(state.participants[0].choice).toBe("revoke");
  });
  it("rejects new legs, missing participants and unknown participants", () => {
    expect(permitted(accepted(), "new-leg")).toBe(false);
    expect(permitted(accepted(), "caller-leg", ["caller-leg"])).toBe(false);
    expect(permitted(accepted(), "caller-leg", ["caller-leg", "founder-leg", "new-leg"])).toBe(false);
  });
  it("rejects pre-consent, reversed, invalid and expired intervals", () => {
    expect(permitted(accepted(), "caller-leg", ["caller-leg", "founder-leg"], "2026-11-06T11:59:59Z")).toBe(false);
    expect(permitted(accepted(), "caller-leg", ["caller-leg", "founder-leg"], "2026-11-06T12:02:00Z")).toBe(false);
    expect(permitted(accepted(), "caller-leg", ["caller-leg", "founder-leg"], "invalid")).toBe(false);
    expect(permitted({ ...accepted(), expiresAt: at })).toBe(false);
  });
  it("does not use out-of-order start acknowledgment to authorize earlier capture", () => {
    let state = initial();
    for (const legId of ["caller-leg", "founder-leg"]) state = transitionCapture(state, { id: legId, at: "2026-11-06T12:01:00Z", kind: "decision", legId, choice: "accept" });
    expect(() => transitionCapture(state, { id: "start", at, kind: "start_ack" })).toThrow();
  });
  it("stores only a digest of arbitrary nested content in webhook receipts", () => {
    const receipt = contentFreeReceipt(JSON.stringify({ transcript: "SENSITIVE_SENTINEL", nested: { recording_url: "SENSITIVE_SENTINEL" } }));
    expect(receipt).not.toContain("SENSITIVE_SENTINEL");
    expect(JSON.parse(receipt).payload_sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it("projects routing fields and drops all other content", () => {
    const result = classifyTelnyxPayload({ data: { id: "event", event_type: "call.answered", payload: {
      call_control_id: "call", call_leg_id: "leg", transcript: "SENSITIVE_SENTINEL", result: { summary: "SENSITIVE_SENTINEL" },
    } } });
    expect(result.kind).toBe("routing");
    expect(JSON.stringify(result)).not.toContain("SENSITIVE_SENTINEL");
  });
  it.each(["call.recording.saved", "call.conversation_insights.generated", "call.dtmf.received", "unknown"])("%s cannot grant consent or enter content processing", event_type => {
    expect(classifyTelnyxPayload({ data: { id: "event", event_type, payload: { consent: true, transcript: "SENSITIVE_SENTINEL" } } }).kind).toBe("rejected");
  });
});
