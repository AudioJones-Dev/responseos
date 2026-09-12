import fs from "node:fs";
import { pathToFileURL } from "node:url";

import { CANONICAL_STAGING_VERCEL } from "./staging-vercel-custom-environment.mjs";

const DEPLOYMENT_ID_PATTERN = /^dpl_[A-Za-z0-9_]+$/;
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/;

function isRecord(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function validateExpectedIdentity(expectedDeploymentId, expectedDeploymentHost) {
  const errors = [];

  if (!DEPLOYMENT_ID_PATTERN.test(expectedDeploymentId)) {
    errors.push("Expected deployment ID must be an exact Vercel deployment ID");
  }
  if (
    typeof expectedDeploymentHost !== "string" ||
    !HOST_PATTERN.test(expectedDeploymentHost) ||
    expectedDeploymentHost === CANONICAL_STAGING_VERCEL.managedEnvironmentAlias
  ) {
    errors.push("Expected deployment host must be a distinct immutable vercel.app hostname");
  }

  return errors;
}

export function validateStagingManagedAlias(
  metadata,
  expectedDeploymentId,
  expectedDeploymentHost,
) {
  const errors = validateExpectedIdentity(
    expectedDeploymentId,
    expectedDeploymentHost,
  );

  if (!isRecord(metadata)) {
    return [...errors, "Managed alias readback must be a JSON object"];
  }
  if (metadata.alias !== CANONICAL_STAGING_VERCEL.managedEnvironmentAlias) {
    errors.push("Managed alias readback does not name canonical staging");
  }
  if (metadata.projectId !== CANONICAL_STAGING_VERCEL.projectId) {
    errors.push("Managed alias readback is not bound to the canonical staging project");
  }
  if (metadata.deploymentId !== expectedDeploymentId) {
    errors.push("Managed alias does not target the exact READY deployment ID");
  }
  if (metadata.redirect != null || metadata.redirectStatusCode != null) {
    errors.push("Managed staging alias must not be a redirect");
  }

  if (metadata.deployment != null) {
    if (!isRecord(metadata.deployment)) {
      errors.push("Managed alias deployment identity must be a JSON object");
    } else {
      const hasDeploymentId = Object.hasOwn(metadata.deployment, "id");
      const hasDeploymentUrl = Object.hasOwn(metadata.deployment, "url");

      if (!hasDeploymentId && !hasDeploymentUrl) {
        errors.push("Managed alias deployment object lacks identity evidence");
      }
      if (hasDeploymentId && metadata.deployment.id !== expectedDeploymentId) {
        errors.push("Managed alias deployment object has the wrong deployment ID");
      }
      if (
        hasDeploymentUrl &&
        metadata.deployment.url !== expectedDeploymentHost
      ) {
        errors.push("Managed alias deployment object has the wrong immutable URL");
      }
    }
  }

  return errors;
}

function isSafeStaleBinding(
  metadata,
  expectedDeploymentId,
  expectedDeploymentHost,
) {
  if (
    validateExpectedIdentity(expectedDeploymentId, expectedDeploymentHost)
      .length !== 0 ||
    !isRecord(metadata) ||
    metadata.alias !== CANONICAL_STAGING_VERCEL.managedEnvironmentAlias ||
    metadata.projectId !== CANONICAL_STAGING_VERCEL.projectId ||
    !DEPLOYMENT_ID_PATTERN.test(metadata.deploymentId) ||
    metadata.deploymentId === expectedDeploymentId ||
    metadata.redirect != null ||
    metadata.redirectStatusCode != null
  ) {
    return false;
  }

  if (metadata.deployment == null) return true;
  if (!isRecord(metadata.deployment)) return false;
  if (
    Object.hasOwn(metadata.deployment, "id") &&
    metadata.deployment.id !== metadata.deploymentId
  ) {
    return false;
  }
  if (Object.hasOwn(metadata.deployment, "url")) {
    return (
      typeof metadata.deployment.url === "string" &&
      HOST_PATTERN.test(metadata.deployment.url) &&
      metadata.deployment.url !==
        CANONICAL_STAGING_VERCEL.managedEnvironmentAlias &&
      metadata.deployment.url !== expectedDeploymentHost
    );
  }

  return true;
}

export function classifyStagingManagedAlias(
  metadata,
  expectedDeploymentId,
  expectedDeploymentHost,
) {
  const errors = validateStagingManagedAlias(
    metadata,
    expectedDeploymentId,
    expectedDeploymentHost,
  );
  if (errors.length === 0) return { status: "bound", errors: [] };
  if (
    isSafeStaleBinding(
      metadata,
      expectedDeploymentId,
      expectedDeploymentHost,
    )
  ) {
    return { status: "pending", errors };
  }
  return { status: "unsafe", errors };
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  const [mode, metadataPath, expectedDeploymentId, expectedDeploymentHost] =
    process.argv.slice(2);

  if (mode !== "poll" || !metadataPath) {
    console.error(
      "Usage: node scripts/validate-staging-managed-alias.mjs poll <alias.json> <expected-deployment-id> <expected-deployment-host>",
    );
    process.exit(1);
  }

  const result = classifyStagingManagedAlias(
    JSON.parse(fs.readFileSync(metadataPath, "utf8")),
    expectedDeploymentId,
    expectedDeploymentHost,
  );
  if (result.status === "bound") {
    console.log("Canonical managed staging alias targets the exact READY deployment.");
  } else if (result.status === "pending") {
    console.log("Canonical managed staging alias has not reached the expected deployment yet.");
    process.exit(2);
  } else {
    console.error(
      ["Managed staging alias verification failed:", ...result.errors].join(
        "\n",
      ),
    );
    process.exit(1);
  }
}
