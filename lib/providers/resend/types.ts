export const RESPONSEOS_NOTIFICATION_SENDER = "notifications@ajdigital.app";

export interface QualifiedEmailRequest {
  recipient: string;
  subject: string;
  text: string;
  idempotencyKey: string;
}

export interface EmailReceipt {
  messageId: string;
  event: "accepted" | "sent" | "delivered" | "bounced" | "failed" | "canceled" | "suppressed" | "complained" | "delivery_delayed" | "opened" | "clicked" | "unknown";
}

export interface QualifiedEmailProvider {
  readonly providerId: "mock" | "resend";
  send(request: QualifiedEmailRequest): Promise<EmailReceipt>;
  inspect(messageId: string, request: QualifiedEmailRequest): Promise<EmailReceipt>;
}

export class EmailProviderError extends Error {
  constructor(readonly code: string, readonly retryable: boolean) {
    super(code);
  }
}
