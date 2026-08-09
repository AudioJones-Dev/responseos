export type SmsAdapterId = "mock" | "telnyx" | "twilio"

export interface SmsSendRequest {
  accountId: string
  to: string
  from: string
  body: string
  messageId: string
}

export interface SmsMessage {
  providerMessageId: string
  accountId: string
  messageId: string
  to: string
  from: string
  body: string
  status: "queued" | "sent" | "delivered" | "failed"
  direction: "outbound" | "inbound"
  createdAt: string
}

export interface SmsDeliveryStatus {
  providerMessageId: string
  status: "queued" | "sent" | "delivered" | "failed"
  updatedAt: string
}

export interface SmsProvider {
  readonly providerId: SmsAdapterId
  send(request: SmsSendRequest): Promise<SmsMessage>
  getDeliveryStatus(message: SmsMessage): Promise<SmsDeliveryStatus>
}
