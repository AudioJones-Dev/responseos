import fs from "node:fs";
import { pathToFileURL } from "node:url";

import { CANONICAL_STAGING_VERCEL } from "./staging-vercel-custom-environment.mjs";

function hasExactConstant(source, name, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*${name}:\\s*["']?${escaped}["']?\\s*$`, "m").test(source);
}

function usesOptionValue(source, option, valuePattern) {
  return new RegExp(`--${option}(?:=|\\s+)["']?(?:${valuePattern})["']?(?=\\s|\\\\|$)`, "m").test(source);
}

function runBlocks(source) {
  const lines = source.split(/\r?\n/);
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)(?:-\s+)?run:\s*(?:\|\s*)?$/);
    if (!match) continue;

    const indent = match[1].length;
    const block = [];
    for (index += 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim() && line.search(/\S/) <= indent) {
        index -= 1;
        break;
      }
      block.push(line);
    }
    blocks.push(block.join("\n"));
  }

  return blocks;
}

export function validateStagingDeployEnvironmentContract(source) {
  const errors = [];
  const commands = runBlocks(source).join("\n");

  if (!hasExactConstant(source, "EXPECTED_VERCEL_CUSTOM_ENV_ID", CANONICAL_STAGING_VERCEL.customEnvironmentId)) {
    errors.push("Deploy Staging must declare the exact governed custom environment id");
  }
  if (!hasExactConstant(source, "EXPECTED_VERCEL_CUSTOM_ENV_SLUG", CANONICAL_STAGING_VERCEL.customEnvironmentSlug)) {
    errors.push("Deploy Staging must declare the exact governed custom environment slug");
  }

  if (usesOptionValue(commands, "environment", "preview")) {
    errors.push("Deploy Staging must not pull generic Preview configuration");
  }
  if (usesOptionValue(commands, "target", "preview")) {
    errors.push("Deploy Staging must not target generic Preview");
  }

  const idVariable = "\\$\\{?EXPECTED_VERCEL_CUSTOM_ENV_ID\\}?";
  const slugVariable = "\\$\\{?EXPECTED_VERCEL_CUSTOM_ENV_SLUG\\}?";
  const exactIdReadback = new RegExp(
    `(?:/custom-environments/${idVariable}|customEnvironmentId=${idVariable})`,
  ).test(commands);
  if (!exactIdReadback) {
    errors.push("Deploy Staging must verify the exact governed custom environment id through REST readback");
  }

  const cliTarget = usesOptionValue(
    commands,
    "target",
    `(?:${CANONICAL_STAGING_VERCEL.customEnvironmentSlug}|${slugVariable})`,
  );
  const restTarget = new RegExp(
    `customEnvironmentSlugOrId[^\\n]*(?:${idVariable}|${slugVariable}|${CANONICAL_STAGING_VERCEL.customEnvironmentSlug})`,
  ).test(commands);
  if (!cliTarget && !restTarget) {
    errors.push("Deploy Staging must explicitly target the governed custom environment");
  }

  if (/\bvercel\s+pull\b/.test(commands)) {
    const customPull = usesOptionValue(
      commands,
      "environment",
      `(?:${CANONICAL_STAGING_VERCEL.customEnvironmentSlug}|${slugVariable})`,
    );
    if (!customPull) {
      errors.push("Deploy Staging vercel pull must use the governed staging environment");
    }
  }

  return errors;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  const workflowPath = process.argv[2];
  if (!workflowPath) {
    console.error("Usage: node scripts/validate-staging-deploy-environment-contract.mjs <deploy-staging.yml>");
    process.exit(1);
  }

  const errors = validateStagingDeployEnvironmentContract(
    fs.readFileSync(workflowPath, "utf8"),
  );
  if (errors.length > 0) {
    console.error([
      "Deploy Staging is not compatible with governed custom-environment configuration:",
      ...errors,
    ].join("\n"));
    process.exit(1);
  }

  console.log("Deploy Staging explicitly targets the governed custom environment.");
}
