import { describe, expect, it } from "vitest";
import {
  FRL_GREETING, FRL_CONSENT_PROMPT, FRL_NAME_PROMPT,
  MockFrlIntake,
} from "@/lib/communications/consent/mock-intake";

describe("FRL greeting, name collection and transfer (mock only)", () => {
  it("greet -> explicit two-party consent -> name -> transfer -> authorized transcript", () => {
    const flow = new MockFrlIntake("synthetic-call-1");
    expect(flow.greet()).toContain(FRL_GREETING);
    expect(flow.greet).toBeDefined();
    expect(FRL_CONSENT_PROMPT).toContain("Press 1");
    expect(() => flow.submitName("Example Caller")).toThrow("name_capture_not_permitted");
    flow.decide("founder", "accept");
    expect(flow.snapshot().recordingPermitted).toBe(false);
    flow.decide("caller", "accept");
    expect(flow.namePrompt()).toBe(FRL_NAME_PROMPT);
    flow.submitName("  Example   Caller  ");
    expect(flow.transferPrompt()).toContain("Please hold");
    flow.connected();
    flow.ingestConversationSegment("Synthetic customer inquiry about a ramp.");
    expect(flow.snapshot()).toMatchObject({
      stage: "connected",
      callerName: "Example Caller",
      recordingPermitted: true,
      transferRequested: true,
    });
    expect(flow.snapshot().transcript).toEqual([
      "Caller name: Example Caller",
      "Synthetic customer inquiry about a ramp.",
    ]);
  });

  it.each(["decline", "timeout"] as const)(
    "transfers on caller %s without speech capture or name", (choice) => {
      const flow = new MockFrlIntake("synthetic-call-refusal");
      flow.greet();
      flow.decide("founder", "accept");
      flow.decide("caller", choice);
      expect(flow.snapshot().stage).toBe("transfer");
      expect(flow.transferPrompt()).toContain("without recording");
      expect(() => flow.submitName("Must not persist")).toThrow("name_capture_not_permitted");
      flow.connected();
      expect(() => flow.ingestConversationSegment("Must not persist")).toThrow("consent_required");
      expect(flow.snapshot().callerName).toBeNull();
      expect(flow.snapshot().transcript).toEqual([]);
    },
  );

  it("proceeds with consented transfer even if caller skips name", () => {
    const flow = new MockFrlIntake("synthetic-call-no-name");
    flow.greet();
    flow.decide("founder", "accept");
    flow.decide("caller", "accept");
    flow.submitName(null);
    expect(flow.snapshot().callerName).toBeNull();
    expect(flow.snapshot().transferRequested).toBe(true);
  });

  it("blocks transcript after an accepted caller revokes", () => {
    const flow = new MockFrlIntake("synthetic-call-revoke");
    flow.greet();
    flow.decide("founder", "accept");
    flow.decide("caller", "accept");
    flow.submitName("Example Caller");
    flow.connected();
    flow.decide("caller", "revoke");
    expect(() => flow.ingestConversationSegment("Not permitted")).toThrow("consent_required");
    expect(flow.snapshot().recordingPermitted).toBe(false);
    expect(flow.snapshot().transcript).toEqual(["Caller name: Example Caller"]);
    expect(flow.snapshot().events).toContain("capture_stopped");
  });

  it("never triggers real provider operations", () => {
    const flow = new MockFrlIntake("synthetic-call-3");
    expect(flow.snapshot().events).toEqual([]);
    expect(flow.snapshot().transferRequested).toBe(false);
  });
});
