import fs from "node:fs";
import { parseEnv } from "node:util";
import { pathToFileURL } from "node:url";

const REQUIRED_NAMES = [
  "DATABASE_URL",
  "DIRECT_URL",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_WEBHOOK_SECRET",
  "AJ_DIGITAL_CLERK_ORG_ID",
  "NEXT_PUBLIC_APP_URL",
  "RESPONSEOS_REQUIRE_AUTH",
];

const SENSITIVE_REQUIRED_NAMES = new Set([
  "DATABASE_URL",
  "DIRECT_URL",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SECRET",
]);

const FORBIDDEN_NAMES = [
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
];

const PRODUCTION_HOSTS = new Set([
  "responseos.ajdigital.app",
  "responseos.vercel.app",
]);

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function authIsRequired(value) {
  return (
    hasValue(value) &&
    value !== "0" &&
    value.toLowerCase() !== "false"
  );
}

function targetsPreview(entry) {
  const targets = Array.isArray(entry?.target)
    ? entry.target
    : [entry?.target];
  return targets.includes("preview") && !entry?.gitBranch;
}

function isPostgresUrl(value) {
  if (!hasValue(value)) {
    return false;
  }

  try {
    const protocol = new URL(value).protocol;
    return protocol === "postgres:" || protocol === "postgresql:";
  } catch {
    return false;
  }
}

/**
 * @param {Readonly<Record<string, string | undefined>>} env
 * @param {Readonly<Record<string, string | undefined>> | undefined} expectedDatabaseEnv
 */
export function validateStagingEnvironment(env, expectedDatabaseEnv = undefined) {
  const errors = [];

  for (const name of REQUIRED_NAMES) {
    if (!hasValue(env[name])) {
      errors.push(`Missing required staging variable: ${name}`);
    }
  }

  if (!authIsRequired(env.RESPONSEOS_REQUIRE_AUTH)) {
    errors.push("RESPONSEOS_REQUIRE_AUTH must be enabled for hosted staging");
  }

  if (expectedDatabaseEnv) {
    for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
      if (
        hasValue(expectedDatabaseEnv[name]) &&
        env[name] !== expectedDatabaseEnv[name]
      ) {
        errors.push(
          `${name} in Vercel must match the GitHub staging Environment`,
        );
      }
    }
  }

  for (const name of FORBIDDEN_NAMES) {
    if (hasValue(env[name])) {
      errors.push(`Forbidden in mock-only staging: ${name}`);
    }
  }

  if (hasValue(env.NEXT_PUBLIC_APP_URL)) {
    try {
      const appUrl = new URL(env.NEXT_PUBLIC_APP_URL);
      if (appUrl.protocol !== "https:") {
        errors.push("NEXT_PUBLIC_APP_URL must use HTTPS in hosted staging");
      }
      if (PRODUCTION_HOSTS.has(appUrl.hostname)) {
        errors.push("NEXT_PUBLIC_APP_URL must not use a production hostname");
      }
    } catch {
      errors.push("NEXT_PUBLIC_APP_URL must be a valid absolute URL");
    }
  }

  return errors;
}

/**
 * Vercel never returns values for variables marked Sensitive. This validator
 * verifies those variables by name, Preview scope, and type while validating
 * readable mock-staging values without printing any value.
 *
 * @param {Readonly<Record<string, string | undefined>>} pulledEnv
 * @param {{ envs?: ReadonlyArray<Record<string, unknown>> } | ReadonlyArray<Record<string, unknown>>} metadata
 * @param {Readonly<Record<string, string | undefined>>} expectedDatabaseEnv
 */
export function validateVercelPreviewEnvironment(
  pulledEnv,
  metadata,
  expectedDatabaseEnv,
) {
  const errors = [];
  const entries = Array.isArray(metadata) ? metadata : metadata?.envs;

  if (!Array.isArray(entries)) {
    return ["Vercel environment metadata must contain an envs array"];
  }

  for (const name of REQUIRED_NAMES) {
    const entry = entries.find(
      (candidate) => candidate?.key === name && targetsPreview(candidate),
    );
    if (!entry) {
      errors.push(`Missing required Preview variable metadata: ${name}`);
      continue;
    }

    if (
      SENSITIVE_REQUIRED_NAMES.has(name) &&
      entry.type !== "sensitive"
    ) {
      errors.push(`Required Preview variable must be Sensitive: ${name}`);
    }

    if (!SENSITIVE_REQUIRED_NAMES.has(name) && !hasValue(pulledEnv[name])) {
      errors.push(`Missing readable Preview variable: ${name}`);
    }
  }

  for (const name of FORBIDDEN_NAMES) {
    if (
      entries.some(
        (entry) => entry?.key === name && targetsPreview(entry),
      )
    ) {
      errors.push(`Forbidden in mock-only Preview metadata: ${name}`);
    }
  }

  if (!authIsRequired(pulledEnv.RESPONSEOS_REQUIRE_AUTH)) {
    errors.push("RESPONSEOS_REQUIRE_AUTH must be enabled for hosted staging");
  }

  if (
    hasValue(pulledEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    !pulledEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith("pk_test_")
  ) {
    errors.push(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must be a Clerk test-mode key",
    );
  }

  if (
    hasValue(pulledEnv.AJ_DIGITAL_CLERK_ORG_ID) &&
    !pulledEnv.AJ_DIGITAL_CLERK_ORG_ID.startsWith("org_")
  ) {
    errors.push("AJ_DIGITAL_CLERK_ORG_ID must have Clerk organization shape");
  }

  if (hasValue(pulledEnv.NEXT_PUBLIC_APP_URL)) {
    try {
      const appUrl = new URL(pulledEnv.NEXT_PUBLIC_APP_URL);
      if (appUrl.protocol !== "https:") {
        errors.push("NEXT_PUBLIC_APP_URL must use HTTPS in hosted staging");
      }
      if (PRODUCTION_HOSTS.has(appUrl.hostname)) {
        errors.push("NEXT_PUBLIC_APP_URL must not use a production hostname");
      }
    } catch {
      errors.push("NEXT_PUBLIC_APP_URL must be a valid absolute URL");
    }
  }

  for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
    if (!isPostgresUrl(expectedDatabaseEnv[name])) {
      errors.push(`${name} must be a valid GitHub staging Postgres secret`);
    }
  }

  if (
    hasValue(expectedDatabaseEnv.DATABASE_URL) &&
    expectedDatabaseEnv.DATABASE_URL === expectedDatabaseEnv.DIRECT_URL
  ) {
    errors.push("DATABASE_URL and DIRECT_URL must be distinct staging secrets");
  }

  return errors;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  const pulledEnvPath = process.argv[2];
  const metadataPath = process.argv[3];
  const checkedEnv = pulledEnvPath
    ? parseEnv(fs.readFileSync(pulledEnvPath, "utf8"))
    : process.env;
  const errors = metadataPath
    ? validateVercelPreviewEnvironment(
        checkedEnv,
        JSON.parse(fs.readFileSync(metadataPath, "utf8")),
        process.env,
      )
    : validateStagingEnvironment(
        checkedEnv,
        pulledEnvPath ? process.env : undefined,
      );
  if (errors.length > 0) {
    console.error(["Staging environment preflight failed:", ...errors].join("\n"));
    process.exit(1);
  }

  console.log(
    metadataPath
      ? "Staging environment preflight passed: required Preview metadata and readable mock-only values are valid."
      : "Staging environment preflight passed: required names are present and live-provider names are absent.",
  );
}
