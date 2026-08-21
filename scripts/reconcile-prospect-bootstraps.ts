import { db } from "../lib/db/client";
import { purgeExpiredWebhookPayloads } from "../lib/data/webhookEvents";
import {
  cleanupExpiredProspectBootstraps,
  expireDueProspectBootstraps,
  purgeExpiredProspectContent,
  releaseQuarantinedAssignments,
} from "../lib/prospectBootstrap/service";

async function main() {
  const expired = await expireDueProspectBootstraps();
  const content = await purgeExpiredProspectContent();
  const cleaned = await cleanupExpiredProspectBootstraps();
  const released = await releaseQuarantinedAssignments();
  const webhooks = await purgeExpiredWebhookPayloads();
  if (!expired.ok) throw new Error(`${expired.error.code}: ${expired.error.message}`);
  if (!content.ok) throw new Error(`${content.error.code}: ${content.error.message}`);
  if (!cleaned.ok) throw new Error(`${cleaned.error.code}: ${cleaned.error.message}`);
  if (!released.ok) throw new Error(`${released.error.code}: ${released.error.message}`);
  if (!webhooks.ok) throw new Error(`${webhooks.error.code}: ${webhooks.error.message}`);
  console.log(JSON.stringify({
    expired: expired.data.expired,
    prospectContentPurged: content.data.accountsPurged,
    knowledgeSourcesPurged: content.data.sourcesPurged,
    knowledgeFactsPurged: content.data.factsPurged,
    tenantWebhookPayloadsPurged: content.data.webhookPayloadsPurged,
    cleaned: cleaned.data.cleaned,
    numberReuseEligible: released.data.eligible,
    quarantinesExtended: released.data.extended,
    webhookPayloadsPurged: webhooks.data.purged,
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "prospect_bootstrap_reconciliation_failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db?.$disconnect();
  });
