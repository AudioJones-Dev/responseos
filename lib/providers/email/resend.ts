import type { EmailMessage, EmailProvider, EmailSendResult } from "./types";

interface ResendSendResponse {
  id?: string;
}

interface ResendErrorResponse {
  name?: string;
  message?: string;
}

/**
 * Resend transactional email, written the same way as the HubSpot adapter:
 * raw fetch, no SDK, a bounded timeout, and error codes that carry the HTTP
 * status so an operator can tell a rate limit from a rejected sender.
 *
 * `User-Agent` is required by the API. `Idempotency-Key` makes a retry of the
 * same notification a no-op at the provider, which is why the stored subject
 * and body are resent verbatim rather than rebuilt.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly providerId = "resend" as const;
  private readonly baseUrl = "https://api.resend.com";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/emails`, {
        method: "POST",
        signal: AbortSignal.timeout(8_000),
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
          "user-agent": "ResponseOS/0.3 (+https://responseos.ai)",
          "idempotency-key": message.idempotencyKey.slice(0, 256),
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
      });
    } catch {
      throw new Error("email_request_failed");
    }

    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as ResendErrorResponse | null;
      const name = typeof detail?.name === "string" ? detail.name.replace(/[^a-z0-9_]+/gi, "_") : null;
      throw new Error(`email_http_${response.status}${name ? `_${name}` : ""}`);
    }

    const body = (await response.json().catch(() => null)) as ResendSendResponse | null;
    if (!body?.id) throw new Error("email_response_missing_id");
    return { providerMessageId: body.id };
  }
}
