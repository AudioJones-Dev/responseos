import type { SmsMessageResult, SmsProvider } from "@/lib/providers/sms/types";

export class MockSmsProvider implements SmsProvider {
  readonly id = "telnyx" as const;

  async send(input: {
    to: string;
    body: string;
  }): Promise<SmsMessageResult> {
    void input.body;
    return {
      messageId: `mock_sms_${input.to}`,
      to: input.to,
      status: "queued",
    };
  }
}
