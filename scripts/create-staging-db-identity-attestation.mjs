import fs from "node:fs";

import { createDatabaseIdentityAttestation } from "./validate-staging-env.mjs";

const metadataPath = process.argv[2];
if (!metadataPath) {
  console.error("Usage: node scripts/create-staging-db-identity-attestation.mjs <vercel-env-metadata.json>");
  process.exit(1);
}

try {
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  const attestation = createDatabaseIdentityAttestation(process.env, metadata);
  process.stdout.write(`${JSON.stringify(attestation)}\n`);
} catch (error) {
  console.error(
    error instanceof Error
      ? `Database identity attestation failed: ${error.message}`
      : "Database identity attestation failed",
  );
  process.exit(1);
}
