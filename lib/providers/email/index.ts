import { MockEmailProvider } from "./mock";
import { ResendEmailProvider } from "./resend";
import type { EmailProvider } from "./types";

export * from "./types";
export * from "./mock";
export * from "./resend";

/**
 * Falls back to the mock adapter whenever the live gate is closed or either
 * credential is absent, so the app boots and runs without secrets. The sending
 * address must belong to a domain verified with the provider; the shared
 * sandbox sender only reaches the provider account's own owner.
 */
export function getEmailProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (process.env.RESPONSEOS_LIVE_EMAIL_ENABLED === "true" && apiKey && from) {
    return new ResendEmailProvider(apiKey, from);
  }
  return new MockEmailProvider();
}
