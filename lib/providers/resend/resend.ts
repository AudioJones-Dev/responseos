import "@/lib/serverOnlyGuard";
import { z } from "zod";
import { EmailProviderError, RESPONSEOS_NOTIFICATION_SENDER, type EmailReceipt, type QualifiedEmailProvider, type QualifiedEmailRequest } from "./types";

const MessageId = z.uuid();
const RequestSchema = z.object({
  recipient: z.email(), subject: z.string().min(1).max(200).regex(/^[^\r\n]+$/),
  text: z.string().min(1).max(20_000), idempotencyKey: z.string().min(1).max(256).regex(/^[a-zA-Z0-9_-]+$/),
}).strict();
const ReceiptSchema = z.object({
  id: MessageId, to: z.array(z.email()), from: z.string(), subject: z.string(), text: z.string().nullable(),
  cc: z.array(z.string()).default([]), bcc: z.array(z.string()).default([]),
  last_event: z.string(),
});
const events = new Set<EmailReceipt["event"]>(["sent", "delivered", "bounced", "failed", "canceled", "suppressed", "complained", "delivery_delayed", "opened", "clicked"]);

export class ResendQualifiedEmailProvider implements QualifiedEmailProvider {
  readonly providerId = "resend" as const;
  constructor(private readonly key: string, private readonly request: typeof fetch = fetch) {}

  private async call(path: string, init: RequestInit) {
    let response: Response;
    try {
      response = await this.request(`https://api.resend.com${path}`, {
        ...init, redirect: "error", signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", ...init.headers },
      });
    } catch { throw new EmailProviderError("resend_transport_unknown", true); }
    let body: unknown;
    try { body = await response.json(); }
    catch { throw new EmailProviderError("resend_response_unknown", response.ok || response.status >= 500); }
    if (!response.ok) {
      const name = z.object({ name: z.string() }).safeParse(body);
      if (response.status === 409 && name.success && name.data.name === "invalid_idempotent_request") {
        throw new EmailProviderError("resend_idempotency_conflict", false);
      }
      const retryable = response.status === 429 || response.status >= 500
        || (response.status === 409 && name.success && name.data.name === "concurrent_idempotent_requests");
      throw new EmailProviderError(`resend_http_${response.status}`, retryable);
    }
    return body;
  }

  async send(input: QualifiedEmailRequest): Promise<EmailReceipt> {
    const parsed = RequestSchema.safeParse(input);
    if (!parsed.success) throw new EmailProviderError("email_request_invalid", false);
    const result = z.object({ id: MessageId }).safeParse(await this.call("/emails", {
      method: "POST", headers: { "Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify({ from: RESPONSEOS_NOTIFICATION_SENDER, to: [input.recipient], subject: input.subject, text: input.text }),
    }));
    if (!result.success) throw new EmailProviderError("resend_response_unknown", true);
    return { messageId: result.data.id, event: "accepted" };
  }

  async inspect(messageId: string, input: QualifiedEmailRequest): Promise<EmailReceipt> {
    if (!MessageId.safeParse(messageId).success) throw new EmailProviderError("email_message_id_invalid", false);
    const result = ReceiptSchema.safeParse(await this.call(`/emails/${messageId}`, { method: "GET" }));
    if (!result.success) throw new EmailProviderError("resend_readback_invalid", false);
    const email = result.data;
    if (email.id !== messageId || email.to.length !== 1 || email.to[0] !== input.recipient
      || email.from !== RESPONSEOS_NOTIFICATION_SENDER || email.subject !== input.subject || email.text !== input.text
      || email.cc.length || email.bcc.length) {
      throw new EmailProviderError("resend_readback_mismatch", false);
    }
    return { messageId, event: events.has(email.last_event as EmailReceipt["event"]) ? email.last_event as EmailReceipt["event"] : "unknown" };
  }
}
