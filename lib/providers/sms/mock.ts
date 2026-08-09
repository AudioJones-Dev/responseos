import type {
  SmsDeliveryStatus,
  SmsMessage,
  SmsProvider,
  SmsSendRequest,
} from "@/lib/providers/sms/types"

const FIXED_CREATED_AT = "2026-01-01T00:00:00.000Z"
const FIXED_UPDATED_AT = "2026-01-01T00:00:02.000Z"

export class MockSmsProvider implements SmsProvider {
  readonly providerId = "mock" as const

  async send(request: SmsSendRequest): Promise<SmsMessage> {
    return {
      providerMessageId: `mock-sms:${request.accountId}:${request.messageId}`,
      accountId: request.accountId,
      messageId: request.messageId,
      to: request.to,
      from: request.from,
      body: request.body,
      status: "sent",
      direction: "outbound",
      createdAt: FIXED_CREATED_AT,
    }
  }

  async getDeliveryStatus(message: SmsMessage): Promise<SmsDeliveryStatus> {
    return {
      providerMessageId: message.providerMessageId,
      status: "delivered",
      updatedAt: FIXED_UPDATED_AT,
    }
  }
}
