import fs from "node:fs";

import { validateVercelPreviewPosture } from "./validate-staging-env.mjs";

const [readablePath, metadataPath] = process.argv.slice(2);
if (!readablePath || !metadataPath) {
  console.error(
    "Usage: node scripts/validate-staging-vercel-posture.mjs <readable.json> <metadata.json>",
  );
  process.exit(1);
}

const errors = validateVercelPreviewPosture(
  JSON.parse(fs.readFileSync(readablePath, "utf8")),
  JSON.parse(fs.readFileSync(metadataPath, "utf8")),
);

if (errors.length > 0) {
  console.error(
    ["Staging Preview posture verification failed:", ...errors].join("\n"),
  );
  process.exit(1);
}

console.log(
  "Staging Preview posture verification passed: auth, readable configuration, Sensitive boundaries, and mock-only policy are valid.",
);
