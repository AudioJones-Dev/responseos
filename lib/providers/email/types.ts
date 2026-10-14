export type EmailProviderId = "mock" | "resend";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /**
   * Stable per-notification key. The same key with the same body is a
   * no-op at the provider, so a retry cannot deliver a second copy.
   */
  idempotencyKey: string;
}

export interface EmailSendResult {
  providerMessageId: string;
}

export interface EmailProvider {
  readonly providerId: EmailProviderId;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/**
 * Rate limiting and provider-side faults are worth another attempt; a rejected
 * address, an unverified sender, or a bad key are not, and retrying them just
 * burns quota.
 */
export function isRetryableEmailErrorCode(code: string): boolean {
  return /^email_http_(?:408|409|429|5\d\d)/.test(code) || code === "email_request_failed";
}
