import { db } from "@/lib/db/client";
import { runCrmSyncForCall } from "@/lib/crm/syncFinalizedCall";
import { retryCompletedInteractionNotification } from "@/lib/notifications/completedInteraction";
import { MockCrmProvider } from "@/lib/providers/crm";

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  if (process.env.NODE_ENV !== "test" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.endsWith("_test")) throw new Error("Disposable test database required");
  const [accountId, callId, id] = process.argv.slice(2);
  let crmWrites = 0, emailSends = 0;
  const provider = new MockCrmProvider();
  for (const method of ["createContact", "createCallActivity", "createFollowUpTask", "associateContact"] as const) {
    Object.assign(provider, { [method]: async () => { crmWrites++; throw new Error("Unexpected synthetic effect"); } });
  }
  try {
    const crm = await runCrmSyncForCall({ accountId, callId, providerOverride: provider });
    const email = await retryCompletedInteractionNotification({ id, providerOverride: { providerId: "mock", send: async () => { emailSends++; return { providerMessageId: "unexpected" }; } } });
    process.stdout.write(JSON.stringify({ crmCode: crm.ok ? null : crm.error.code, emailCode: email.ok ? null : email.error.code, crmWrites, emailSends }));
  } finally { await db?.$disconnect(); }
}
void main().catch(() => { process.stderr.write("Synthetic restart fixture failed"); process.exitCode = 1; });
