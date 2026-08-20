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

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  const pulledEnvPath = process.argv[2];
  const checkedEnv = pulledEnvPath
    ? parseEnv(fs.readFileSync(pulledEnvPath, "utf8"))
    : process.env;
  const expectedDatabaseEnv = pulledEnvPath ? process.env : undefined;
  const errors = validateStagingEnvironment(
    checkedEnv,
    expectedDatabaseEnv,
  );
  if (errors.length > 0) {
    console.error(["Staging environment preflight failed:", ...errors].join("\n"));
    process.exit(1);
  }

  console.log(
    "Staging environment preflight passed: required names are present and live-provider names are absent.",
  );
}
