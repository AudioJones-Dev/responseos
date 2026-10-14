import { createHash } from "node:crypto";
import type { EmailMessage, EmailProvider, EmailSendResult } from "./types";

/**
 * Default adapter. It never sends anything: the id it returns is derived from
 * the idempotency key so tests are deterministic, and a supervised tenant that
 * requires a live provider treats a mock result as a visible failure rather
 * than a delivery.
 */
export class MockEmailProvider implements EmailProvider {
  readonly providerId = "mock" as const;

  async send(message: EmailMessage): Promise<EmailSendResult> {
    return {
      providerMessageId: `mock-email:${createHash("sha256").update(message.idempotencyKey).digest("hex").slice(0, 24)}`,
    };
  }
}
