import "@/lib/serverOnlyGuard";
import { MockQualifiedEmailProvider } from "./mock";
import { ResendQualifiedEmailProvider } from "./resend";
import { RESPONSEOS_NOTIFICATION_SENDER, type QualifiedEmailProvider } from "./types";

export function getQualifiedEmailProvider(): QualifiedEmailProvider {
  const key = process.env.RESEND_API_KEY;
  return process.env.RESPONSEOS_LIVE_RESEND_ENABLED === "true" && key
    && process.env.EMAIL_FROM === RESPONSEOS_NOTIFICATION_SENDER
    ? new ResendQualifiedEmailProvider(key) : new MockQualifiedEmailProvider();
}
