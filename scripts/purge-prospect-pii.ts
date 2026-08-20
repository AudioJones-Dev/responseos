import { purgeExpiredUnqualifiedProspectPii } from "../lib/data/prospectIntakes";
import { assertProspectPurgeAllowed } from "../lib/prospects/purgePolicy";

async function main() {
  const accountId = assertProspectPurgeAllowed(process.env);
  const result = await purgeExpiredUnqualifiedProspectPii({ accountId });
  if (!result.ok) throw new Error(result.error.message);
  console.log(`Purged PII from ${result.data.purged} expired prospect intake record(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Prospect purge failed.");
  process.exitCode = 1;
});
