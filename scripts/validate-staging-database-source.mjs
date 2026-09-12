import fs from "node:fs";

import { validateCanonicalStagingDatabaseSource } from "./validate-staging-env.mjs";

const metadataPaths = process.argv.slice(2, 6);
if (metadataPaths.length !== 4) {
  console.error(
    "Usage: node scripts/validate-staging-database-source.mjs <project.json> <branch.json> <endpoints.json> <databases.json>",
  );
  process.exit(1);
}

const metadataNames = ["project", "branch", "endpoints", "databases"];
const metadata = Object.fromEntries(
  metadataNames.map((name, index) => [
    name,
    JSON.parse(fs.readFileSync(metadataPaths[index], "utf8")),
  ]),
);
const errors = validateCanonicalStagingDatabaseSource(process.env, metadata);

if (errors.length > 0) {
  console.error(
    ["Staging database source verification failed:", ...errors].join("\n"),
  );
  process.exit(1);
}

console.log(
  "Staging database source verification passed: GitHub URLs resolve to the canonical Neon project, branch, endpoint, and database.",
);
