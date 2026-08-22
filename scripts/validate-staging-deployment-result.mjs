import fs from "node:fs";
import { pathToFileURL } from "node:url";

import { CANONICAL_STAGING_VERCEL } from "./staging-vercel-custom-environment.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/;
const PROGRESS_STATES = new Set([
  "INITIALIZING",
  "ANALYZING",
  "BUILDING",
  "DEPLOYING",
  "QUEUED",
  "READY",
  "ERROR",
  "CANCELED",
  "CANCELLED",
]);

function arrayIsEmpty(value) {
  return value == null || (Array.isArray(value) && value.length === 0);
}

export function validateDeploymentUrl(value) {
  if (typeof value !== "string") return ["Deployment URL must be a string"];

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !HOST_PATTERN.test(url.hostname) ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return ["Deployment URL must be a unique HTTPS vercel.app origin"];
    }
  } catch {
    return ["Deployment URL must be a valid absolute URL"];
  }

  return [];
}

export function validateStagingDeployment(metadata, applicationSha, deploymentHost, mode = "progress") {
  const errors = [];
  const expected = CANONICAL_STAGING_VERCEL;
  const projectId = metadata?.projectId ?? metadata?.project?.id;
  const state = metadata?.readyState ?? metadata?.state ?? metadata?.status;

  if (!SHA_PATTERN.test(applicationSha)) {
    errors.push("Application SHA must be a full lowercase commit SHA");
  }
  if (projectId !== expected.projectId || metadata?.name !== expected.projectName) {
    errors.push("Deployment is not bound to the canonical staging project");
  }
  if (
    metadata?.customEnvironment?.id !== expected.customEnvironmentId ||
    metadata?.customEnvironment?.slug !== expected.customEnvironmentSlug
  ) {
    errors.push("Deployment is not bound to the exact governed custom environment");
  }
  if (metadata?.target === "production") {
    errors.push("Deployment must not target Production");
  }
  if (metadata?.meta?.responseosApplicationSha !== applicationSha) {
    errors.push("Deployment metadata does not bind the requested application SHA");
  }
  if (
    metadata?.gitSource?.sha != null &&
    metadata.gitSource.sha !== applicationSha
  ) {
    errors.push("Deployment Git source SHA conflicts with the requested application SHA");
  }
  if (
    !arrayIsEmpty(metadata?.alias) ||
    !arrayIsEmpty(metadata?.automaticAliases) ||
    !arrayIsEmpty(metadata?.userAliases) ||
    metadata?.aliasAssigned === true
  ) {
    errors.push("Governed staging deployment must not have aliases");
  }
  if (
    typeof deploymentHost !== "string" ||
    !HOST_PATTERN.test(deploymentHost) ||
    metadata?.url !== deploymentHost
  ) {
    errors.push("Deployment readback URL does not match the validated deployment host");
  }
  if (!PROGRESS_STATES.has(state)) {
    errors.push("Deployment readiness state is missing or unsupported");
  }
  if (mode === "ready" && state !== "READY") {
    errors.push("Deployment is not READY");
  }

  return errors;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  const [mode, value, applicationSha, deploymentHost] = process.argv.slice(2);

  if (mode === "url") {
    const errors = validateDeploymentUrl(value);
    if (errors.length > 0) {
      console.error(["Staging deployment URL validation failed:", ...errors].join("\n"));
      process.exit(1);
    }
    console.log("Staging deployment URL is a valid protected candidate origin.");
  } else if (["progress", "ready", "report"].includes(mode)) {
    const metadata = JSON.parse(fs.readFileSync(value, "utf8"));
    if (mode === "report") {
      const state = metadata?.readyState ?? metadata?.state ?? metadata?.status ?? "unknown";
      const id = typeof metadata?.id === "string" ? metadata.id : "unknown";
      const environmentId = typeof metadata?.customEnvironment?.id === "string"
        ? metadata.customEnvironment.id
        : "unknown";
      console.log(`Post-migration evidence: deployment=${id} state=${state} customEnvironment=${environmentId}`);
    } else {
      const errors = validateStagingDeployment(metadata, applicationSha, deploymentHost, mode);
      if (errors.length > 0) {
        console.error(["Governed staging deployment verification failed:", ...errors].join("\n"));
        process.exit(1);
      }
      console.log(
        mode === "ready"
          ? "Governed staging deployment is READY with exact project, environment, source, and no aliases."
          : "Governed staging deployment identity remains canonical while readiness is pending.",
      );
    }
  } else {
    console.error("Usage: node scripts/validate-staging-deployment-result.mjs <url|progress|ready|report> <value> <application-sha> [deployment-host]");
    process.exit(1);
  }
}
