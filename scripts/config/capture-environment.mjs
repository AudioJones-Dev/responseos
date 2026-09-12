import fs from "node:fs";
import { pathToFileURL } from "node:url";
import {
  normalizeEnvironmentReadback,
  prettyCanonicalJson,
  readJson,
} from "./environment-contract.mjs";

export function captureEnvironment(input) {
  return normalizeEnvironmentReadback(input);
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    console.error(
      "Usage: node scripts/config/capture-environment.mjs <readback-fixture.json> <environment.json>",
    );
    process.exit(1);
  }

  try {
    const captured = captureEnvironment(readJson(inputPath));
    fs.writeFileSync(outputPath, prettyCanonicalJson(captured));
    console.log(`Environment contract captured from repository-controlled input: ${outputPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Environment capture failed");
    process.exit(1);
  }
}
