import fs from "node:fs";

import {
  validateVercelCustomEnvironmentPosture,
  validateVercelPreviewPosture,
} from "./validate-staging-env.mjs";

const [scope, readablePath, metadataPath] = process.argv.slice(2);
if (!scope || !readablePath || !metadataPath) {
  console.error(
    "Usage: node scripts/validate-staging-vercel-posture.mjs <source-preview|custom-environment> <readable.json> <metadata.json>",
  );
  process.exit(1);
}

const validator = scope === "source-preview"
  ? validateVercelPreviewPosture
  : scope === "custom-environment"
    ? validateVercelCustomEnvironmentPosture
    : undefined;
if (!validator) {
  console.error("Staging posture scope must be source-preview or custom-environment");
  process.exit(1);
}

const errors = validator(
  JSON.parse(fs.readFileSync(readablePath, "utf8")),
  JSON.parse(fs.readFileSync(metadataPath, "utf8")),
);

if (errors.length > 0) {
  console.error(
    ["Staging posture verification failed:", ...errors].join("\n"),
  );
  process.exit(1);
}

console.log(
  "Staging posture verification passed: auth, readable configuration, Sensitive boundaries, and mock-only policy are valid.",
);
