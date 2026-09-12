import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { CANONICAL_STAGING_VERCEL } from "./staging-vercel-custom-environment.mjs";
import { CANONICAL_STAGING_DATABASE } from "./validate-staging-env.mjs";

export const REQUIRED_STAGING_VARIABLES = Object.freeze({
  DATABASE_URL: "sensitive",
  DIRECT_URL: "sensitive",
  RESPONSEOS_DATABASE_IDENTITY: "encrypted",
  CLERK_SECRET_KEY: "sensitive",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "encrypted",
  CLERK_WEBHOOK_SECRET: "sensitive",
  AJ_DIGITAL_CLERK_ORG_ID: "encrypted",
  NEXT_PUBLIC_APP_URL: "encrypted",
  RESPONSEOS_REQUIRE_AUTH: "encrypted",
});

const FORBIDDEN_PROVIDER_NAMES = new Set([
  "RESPONSEOS_DEV_SESSION",
  "TELNYX_API_KEY",
  "TELNYX_PUBLIC_KEY",
  "RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED",
  "RESPONSEOS_LIVE_HUBSPOT_ENABLED",
  "RESPONSEOS_LIVE_CALL_DEMO_PUBLIC",
  "RESPONSEOS_PUBLIC_AUDIT_INTAKE_ENABLED",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "RETELL_API_KEY",
  "VAPI_API_KEY",
  "BLAND_API_KEY",
  "GHL_API_KEY",
  "HUBSPOT_ACCESS_TOKEN",
  "CALENDLY_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
]);

function entriesFrom(metadata) {
  const entries = Array.isArray(metadata) ? metadata : metadata?.envs;
  if (!Array.isArray(entries)) {
    throw new Error("Vercel environment metadata must contain an envs array");
  }
  return entries;
}

function isGenericPreviewSource(entry) {
  return (
    Array.isArray(entry?.target) &&
    entry.target.includes("preview") &&
    !entry.gitBranch &&
    (!Array.isArray(entry.customEnvironmentIds) ||
      entry.customEnvironmentIds.length === 0)
  );
}

export function createScopePatchBody() {
  return {
    target: [],
    customEnvironmentIds: [CANONICAL_STAGING_VERCEL.customEnvironmentId],
  };
}

function fingerprint(identity) {
  const canonical = [
    "responseos-neon-identity-v1",
    identity.projectId,
    identity.branchId,
    identity.endpointId,
    identity.databaseName,
  ].join(":");
  return `sha256:${crypto.createHash("sha256").update(canonical).digest("hex")}`;
}

export function validateCertifiedGenericPreviewSource(readable, metadata) {
  const errors = [];
  const entries = entriesFrom(metadata);
  let attestation;
  try {
    attestation = JSON.parse(readable?.RESPONSEOS_DATABASE_IDENTITY ?? "");
  } catch {
    return ["Generic Preview database identity must be valid JSON"];
  }
  if (attestation?.version !== 1) {
    errors.push("Generic Preview source attestation must use version 1");
  }
  for (const [field, expected] of Object.entries(CANONICAL_STAGING_DATABASE)) {
    if (attestation?.identity?.[field] !== expected) {
      errors.push(`Generic Preview source attestation has wrong ${field}`);
    }
  }
  if (attestation?.fingerprint !== fingerprint(attestation?.identity ?? {})) {
    errors.push("Generic Preview source attestation fingerprint is conflicting");
  }
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const matches = entries.filter((entry) => entry?.key === key && isGenericPreviewSource(entry));
    const revision = attestation?.vercel?.[key];
    if (matches.length !== 1 || revision?.envId !== matches[0]?.id || revision?.updatedAt !== matches[0]?.updatedAt) {
      errors.push(`Generic Preview source attestation is stale for ${key}`);
    }
  }
  return errors;
}

export function createStagingMigrationPlan(metadata) {
  const entries = entriesFrom(metadata);
  const variables = [];

  for (const [key, expectedType] of Object.entries(REQUIRED_STAGING_VARIABLES)) {
    const keyed = entries.filter((entry) => entry?.key === key);
    if (keyed.length !== 1) {
      throw new Error(`Expected exactly one source variable named ${key}`);
    }

    const entry = keyed[0];
    if (!isGenericPreviewSource(entry)) {
      throw new Error(`Source variable is not certified generic Preview: ${key}`);
    }
    if (entry.type !== expectedType) {
      throw new Error(`Source variable has wrong type: ${key}`);
    }
    if (typeof entry.id !== "string" || entry.id.length === 0) {
      throw new Error(`Source variable has no valid Vercel id: ${key}`);
    }

    variables.push({ key, id: entry.id, type: entry.type });
  }

  for (const entry of entries) {
    if (FORBIDDEN_PROVIDER_NAMES.has(entry?.key) && isGenericPreviewSource(entry)) {
      throw new Error(`Forbidden live-provider source variable: ${entry.key}`);
    }
  }

  return {
    version: 1,
    projectId: CANONICAL_STAGING_VERCEL.projectId,
    customEnvironmentId: CANONICAL_STAGING_VERCEL.customEnvironmentId,
    customEnvironmentSlug: CANONICAL_STAGING_VERCEL.customEnvironmentSlug,
    variables,
  };
}

function customOnly(entry) {
  return (
    Array.isArray(entry?.target) &&
    entry.target.length === 0 &&
    !entry.gitBranch &&
    Array.isArray(entry.customEnvironmentIds) &&
    entry.customEnvironmentIds.length === 1 &&
    entry.customEnvironmentIds[0] ===
      CANONICAL_STAGING_VERCEL.customEnvironmentId
  );
}

export function verifyStagingMigrationReadback({
  plan,
  unfilteredMetadata,
  filteredMetadata,
}) {
  const errors = [];
  const unfiltered = entriesFrom(unfilteredMetadata);
  const filtered = entriesFrom(filteredMetadata);

  for (const planned of plan.variables ?? []) {
    const allMatches = unfiltered.filter((entry) => entry?.key === planned.key);
    if (allMatches.length !== 1 || allMatches[0]?.id !== planned.id) {
      errors.push(`Migrated variable identity changed or became ambiguous: ${planned.key}`);
      continue;
    }
    if (!customOnly(allMatches[0])) {
      errors.push(`Generic Preview scope remains or custom scope is wrong: ${planned.key}`);
    }

    const filteredMatches = filtered.filter(
      (entry) => entry?.key === planned.key && entry?.id === planned.id,
    );
    if (filteredMatches.length !== 1 || !customOnly(filteredMatches[0])) {
      errors.push(`Variable is not available only to governed staging: ${planned.key}`);
    }
  }

  return errors;
}

export function changedScopeReport({ changed, metadata }) {
  const entries = entriesFrom(metadata);
  return (changed ?? []).map(({ key, id }) => {
    const entry = entries.find((candidate) => candidate?.id === id);
    return {
      key,
      id,
      target: Array.isArray(entry?.target) ? entry.target : null,
      customEnvironmentIds: Array.isArray(entry?.customEnvironmentIds)
        ? entry.customEnvironmentIds
        : null,
    };
  });
}

function assertRunnerTemp(outputPath) {
  const runnerTemp = process.env.RUNNER_TEMP;
  if (!outputPath || !runnerTemp) {
    throw new Error("Output path and RUNNER_TEMP are required");
  }
  const output = path.resolve(outputPath);
  const temp = path.resolve(runnerTemp);
  if (output !== temp && !output.startsWith(`${temp}${path.sep}`)) {
    throw new Error("Migration evidence must remain under RUNNER_TEMP");
  }
  return output;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  const [mode, firstPath, secondPath, outputPath] = process.argv.slice(2);
  try {
    if (mode === "plan") {
      const plan = createStagingMigrationPlan(
        JSON.parse(fs.readFileSync(firstPath, "utf8")),
      );
      fs.writeFileSync(assertRunnerTemp(secondPath), JSON.stringify(plan), {
        encoding: "utf8",
        mode: 0o600,
      });
      console.log(`Validated scope-only migration plan for ${plan.variables.length} variables.`);
    } else if (mode === "certify-source") {
      const errors = validateCertifiedGenericPreviewSource(
        JSON.parse(fs.readFileSync(firstPath, "utf8")),
        JSON.parse(fs.readFileSync(secondPath, "utf8")),
      );
      if (errors.length > 0) throw new Error(errors.join("\n"));
      console.log("Certified generic Preview source attestation verified.");
    } else if (mode === "verify") {
      const plan = JSON.parse(fs.readFileSync(firstPath, "utf8"));
      const errors = verifyStagingMigrationReadback({
        plan,
        unfilteredMetadata: JSON.parse(fs.readFileSync(secondPath, "utf8")),
        filteredMetadata: JSON.parse(fs.readFileSync(outputPath, "utf8")),
      });
      if (errors.length > 0) throw new Error(errors.join("\n"));
      console.log("Custom-environment-only scope readback verified.");
    } else if (mode === "report") {
      const report = changedScopeReport({
        changed: JSON.parse(fs.readFileSync(firstPath, "utf8")),
        metadata: JSON.parse(fs.readFileSync(secondPath, "utf8")),
      });
      console.log(JSON.stringify(report));
    } else {
      throw new Error("Mode must be plan, certify-source, verify, or report");
    }
  } catch (error) {
    console.error(`Staging scope migration ${mode ?? "unknown"} failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exit(1);
  }
}
