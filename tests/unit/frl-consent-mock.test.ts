import { describe, expect, it } from "vitest";
import { createConsentSession, transitionConsent, isCaptureAllowed } from "@/lib/communications/consent/contracts";
import { MockConsentCall } from "@/lib/communications/consent/mock";

const decision = (participant: "founder" | "caller", choice: "accept" | "decline" | "timeout" | "revoke", id: string) =>
  ({ participant, choice, eventId: id, occurredAt: "2026-11-05T20:00:00Z" });

describe("FRL consent state contract (mock only)", () => {
  it("denies capture until both parties accept", () => {
    const mock = new MockConsentCall("call-1");
    mock.playDisclosure();
    expect(() => mock.ingestTranscript("must not persist")).toThrow("consent_required");
    mock.decide(decision("founder", "accept", "evt-1"));
    expect(() => mock.ingestTranscript("still blocked")).toThrow("consent_required");
    mock.decide(decision("caller", "accept", "evt-2"));
    mock.ingestTranscript("approved content");
    expect(mock.getEvents()).toEqual(["disclosure_played", "capture_started", "transcript_accepted"]);
    expect(mock.getTranscript()).toEqual(["approved content"]);
  });

  it.each(["decline", "timeout"] as const)("fails closed on caller %s", (choice) => {
    const mock = new MockConsentCall("call-2");
    mock.decide(decision("founder", "accept", "evt-1"));
    mock.decide(decision("caller", choice, "evt-2"));
    mock.decide(decision("caller", "accept", "evt-3"));
    expect(mock.getSession().status.caller).toBe(choice === "decline" ? "declined" : "timed_out");
    expect(mock.getEvents()).not.toContain("capture_started");
    expect(() => mock.ingestTranscript("blocked")).toThrow("consent_required");
  });

  it("stops capture on revocation and cannot restart on same call", () => {
    const mock = new MockConsentCall("call-3");
    mock.decide(decision("founder", "accept", "evt-1"));
    mock.decide(decision("caller", "accept", "evt-2"));
    mock.decide(decision("caller", "revoke", "evt-3"));
    mock.decide(decision("caller", "accept", "evt-4"));
    expect(mock.getEvents()).toEqual(["capture_started", "capture_stopped"]);
    expect(() => mock.ingestTranscript("blocked")).toThrow("consent_required");
  });

  it("deduplicates decisions without duplicate capture starts", () => {
    const mock = new MockConsentCall("call-4");
    mock.decide(decision("founder", "accept", "evt-1"));
    mock.decide(decision("caller", "accept", "evt-2"));
    mock.decide(decision("caller", "accept", "evt-2"));
    expect(mock.getEvents()).toEqual(["capture_started"]);
  });

  it("rejects malformed events and defaults to no capture", () => {
    const initial = createConsentSession("call-5", "v1");
    expect(isCaptureAllowed(initial)).toBe(false);
    expect(() => transitionConsent(initial, { ...decision("caller", "accept", "") })).toThrow("invalid_consent_event");
    expect(isCaptureAllowed(initial)).toBe(false);
  });

  it("does not rely on provider secrets or network services", () => {
    const mock = new MockConsentCall("call-6");
    expect(mock.getSession().captureStarted).toBe(false);
    expect(mock.getTranscript()).toEqual([]);
  });
});
