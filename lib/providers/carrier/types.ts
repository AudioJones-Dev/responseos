/** CarrierProvider — Telnyx primary / Twilio failover (mock-only slice). */

export type CarrierId = "telnyx" | "twilio";

export interface CarrierNumber {
  e164: string;
  carrier: CarrierId;
}

export interface CarrierCallSession {
  sessionId: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  startedAt: string;
}

export interface CarrierProvider {
  readonly id: CarrierId;
  listNumbers(): Promise<CarrierNumber[]>;
  startInboundSession(input: {
    from: string;
    to: string;
  }): Promise<CarrierCallSession>;
}
