import fs from "node:fs";
import { pathToFileURL } from "node:url";

import {
  CANONICAL_STAGING_DATABASE,
  canonicalNeonMetadataErrors,
  parseNeonTarget,
} from "./validate-staging-env.mjs";

// The A10 observer must read the same canonical staging database the application
// is bound to. Messages name the problem only; the URL is never echoed.
export function validateStagingObserverDatabase(observerUrl, neonMetadata) {
  const errors = [];
  const target = parseNeonTarget(observerUrl);
  if (!target) {
    errors.push("STAGING_READONLY_DATABASE_URL must resolve to an identifiable Neon endpoint and database");
  } else {
    if (target.endpointId !== CANONICAL_STAGING_DATABASE.endpointId) {
      errors.push("STAGING_READONLY_DATABASE_URL must use the canonical Neon staging endpoint");
    }
    if (target.databaseName !== CANONICAL_STAGING_DATABASE.databaseName) {
      errors.push("STAGING_READONLY_DATABASE_URL must use the canonical Neon staging database");
    }
  }
  errors.push(...canonicalNeonMetadataErrors(neonMetadata));
  return errors;
}

function main() {
  const metadataPaths = process.argv.slice(2, 6);
  if (metadataPaths.length !== 4) {
    console.error(
      "Usage: node scripts/validate-staging-observer-database.mjs <project.json> <branch.json> <endpoints.json> <databases.json>",
    );
    process.exit(1);
  }
  const names = ["project", "branch", "endpoints", "databases"];
  const metadata = Object.fromEntries(
    names.map((name, index) => [name, JSON.parse(fs.readFileSync(metadataPaths[index], "utf8"))]),
  );
  const errors = validateStagingObserverDatabase(process.env.STAGING_READONLY_DATABASE_URL, metadata);
  if (errors.length > 0) {
    console.error(["Observer database verification failed:", ...errors].join("\n"));
    process.exit(1);
  }
  console.log("Observer database verification passed: it resolves to the canonical Neon staging endpoint and database.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
