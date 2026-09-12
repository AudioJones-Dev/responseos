import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const CANONICAL_STAGING_VERCEL = Object.freeze({
  accountId: "team_BHxIkAGPW6qEKKQBAt9c0NGz",
  projectId: "prj_pbzqdkzp322jcHWIsi19GhsnWXRm",
  projectName: "responseos-staging-mock",
  nodeVersion: "24.x",
});

export function validateStagingVercelProject(metadata, domainsMetadata, env) {
  const errors = [];
  const expected = CANONICAL_STAGING_VERCEL;

  if (
    env.VERCEL_ORG_ID !== expected.accountId ||
    env.VERCEL_PROJECT_ID !== expected.projectId
  ) {
    errors.push("GitHub staging Vercel ids do not match the canonical target");
  }
  if (
    metadata?.id !== expected.projectId ||
    metadata?.accountId !== expected.accountId ||
    metadata?.name !== expected.projectName
  ) {
    errors.push("Vercel project identity is not the canonical mock-staging target");
  }
  if (metadata?.nodeVersion !== expected.nodeVersion) {
    errors.push("Vercel project must use Node 24.x");
  }
  if (metadata?.live !== false || metadata?.targets?.production) {
    errors.push("Vercel project must remain non-production");
  }
  if (metadata?.ssoProtection?.deploymentType !== "all_except_custom_domains") {
    errors.push("Vercel Deployment Protection must remain enabled");
  }
  if (
    !env.VERCEL_AUTOMATION_BYPASS_SECRET ||
    !Object.hasOwn(
      metadata?.protectionBypass ?? {},
      env.VERCEL_AUTOMATION_BYPASS_SECRET,
    )
  ) {
    errors.push("Vercel automation bypass does not match the protected project");
  }
  if (Array.isArray(metadata?.alias) && metadata.alias.length > 0) {
    errors.push("Vercel mock-staging project must not have aliases");
  }
  const domains = domainsMetadata?.domains;
  const defaultDomain = `${expected.projectName}.vercel.app`;
  if (
    !Array.isArray(domains) ||
    domains.some((domain) => domain?.name !== defaultDomain)
  ) {
    errors.push("Vercel mock-staging project must not have custom domains");
  }

  return errors;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  const metadataPath = process.argv[2];
  const domainsPath = process.argv[3];
  if (!metadataPath || !domainsPath) {
    console.error(
      "Usage: node scripts/validate-staging-vercel-project.mjs <project.json> <domains.json>",
    );
    process.exit(1);
  }

  const errors = validateStagingVercelProject(
    JSON.parse(fs.readFileSync(metadataPath, "utf8")),
    JSON.parse(fs.readFileSync(domainsPath, "utf8")),
    process.env,
  );
  if (errors.length > 0) {
    console.error(
      ["Staging Vercel project verification failed:", ...errors].join("\n"),
    );
    process.exit(1);
  }

  console.log(
    "Staging Vercel project verification passed: identity, protection, runtime, and non-production posture are canonical.",
  );
}
