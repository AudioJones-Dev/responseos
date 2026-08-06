/** SmsProvider — mock-only. */

export type SmsProviderId = "telnyx" | "twilio" | "manual";

export interface SmsMessageResult {
  messageId: string;
  to: string;
  status: "queued" | "sent";
}

export interface SmsProvider {
  readonly id: SmsProviderId;
  send(input: {
    to: string;
    body: string;
  }): Promise<SmsMessageResult>;
}
