import type {
  CarrierCallSession,
  CarrierNumber,
  CarrierProvider,
} from "@/lib/providers/carrier/types";

const FIXED_STARTED = "2026-01-01T00:00:00.000Z";

export class MockCarrierProvider implements CarrierProvider {
  readonly id = "telnyx" as const;

  async listNumbers(): Promise<CarrierNumber[]> {
    return [{ e164: "+15555550100", carrier: "telnyx" }];
  }

  async startInboundSession(input: {
    from: string;
    to: string;
  }): Promise<CarrierCallSession> {
    return {
      sessionId: `mock_carrier_${input.to}`,
      direction: "inbound",
      from: input.from,
      to: input.to,
      startedAt: FIXED_STARTED,
    };
  }
}
