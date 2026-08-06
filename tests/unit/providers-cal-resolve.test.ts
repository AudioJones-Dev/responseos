import { describe, expect, test } from "vitest";
import {
  resolveCarrierProvider,
  resolveCrmProvider,
  resolveSchedulingProvider,
  resolveSmsProvider,
  resolveVoiceAgentProvider,
} from "@/lib/providers/resolve";

describe("CAL mock resolver (ADR-0040 / authorization brief §1)", () => {
  test("resolves carrier mock as telnyx", async () => {
    const p = resolveCarrierProvider();
    expect(p.id).toBe("telnyx");
    const numbers = await p.listNumbers();
    expect(numbers[0]?.carrier).toBe("telnyx");
  });

  test("resolves voice agent mock as vapi", async () => {
    const p = resolveVoiceAgentProvider();
    expect(p.id).toBe("vapi");
    const session = await p.startSession({
      accountId: "org_mock_1",
      callSessionId: "call_1",
    });
    expect(session.provider).toBe("vapi");
  });

  test("resolves sms / crm / scheduling mocks", async () => {
    expect(resolveSmsProvider().id).toBe("telnyx");
    expect(resolveCrmProvider().id).toBe("hubspot");
    const sched = resolveSchedulingProvider();
    expect(sched.id).toBe("calendly");
    const link = await sched.getBookingLink({ accountId: "org_mock_1" });
    expect(link.url).toContain("org_mock_1");
  });
});
