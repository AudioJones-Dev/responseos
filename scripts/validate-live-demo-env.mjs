import fs from "node:fs";
import { parseEnv } from "node:util";
import { pathToFileURL } from "node:url";

const REQUIRED = [
  "DATABASE_URL",
  "DIRECT_URL",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_WEBHOOK_SECRET",
  "AJ_DIGITAL_CLERK_ORG_ID",
  "NEXT_PUBLIC_APP_URL",
  "RESPONSEOS_REQUIRE_AUTH",
  "RESPONSEOS_DEMO_ACCOUNT_ID",
  "RESPONSEOS_DEMO_PHONE_E164",
  "TELNYX_PUBLIC_KEY",
  "HUBSPOT_ACCESS_TOKEN",
];

const FORBIDDEN = [
  "RESPONSEOS_DEV_SESSION",
  "TELNYX_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "RETELL_API_KEY",
  "VAPI_API_KEY",
  "BLAND_API_KEY",
  "GHL_API_KEY",
  "CALENDLY_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
];

const hasValue = (value) => typeof value === "string" && value.trim().length > 0;
const enabled = (value) => hasValue(value) && value !== "0" && value.toLowerCase() !== "false";

/**
 * @param {Readonly<Record<string, string | undefined>>} env
 * @param {Readonly<Record<string, string | undefined>> | undefined} expectedDatabaseEnv
 */
export function validateLiveDemoEnvironment(env, expectedDatabaseEnv = undefined) {
  const errors = [];
  for (const name of REQUIRED) {
    if (!hasValue(env[name])) errors.push(`Missing required live-demo variable: ${name}`);
  }
  if (expectedDatabaseEnv) {
    for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
      if (hasValue(expectedDatabaseEnv[name]) && env[name] !== expectedDatabaseEnv[name]) {
        errors.push(`${name} in Vercel must match the GitHub live-demo-staging Environment`);
      }
    }
  }
  if (env.RESPONSEOS_DEPLOYMENT_LANE !== "live-demo") {
    errors.push("RESPONSEOS_DEPLOYMENT_LANE must equal live-demo");
  }
  if (!enabled(env.RESPONSEOS_REQUIRE_AUTH)) {
    errors.push("RESPONSEOS_REQUIRE_AUTH must be enabled for live-demo staging");
  }
  if (env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED !== "true") {
    errors.push("RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED must equal true");
  }
  if (env.RESPONSEOS_LIVE_HUBSPOT_ENABLED !== "true") {
    errors.push("RESPONSEOS_LIVE_HUBSPOT_ENABLED must equal true");
  }
  if (env.RESPONSEOS_DEMO_PHONE_E164 !== "+17867560897") {
    errors.push("RESPONSEOS_DEMO_PHONE_E164 must equal the authorized demo number");
  }
  for (const name of FORBIDDEN) {
    if (hasValue(env[name])) errors.push(`Forbidden in live-demo staging: ${name}`);
  }
  if (hasValue(env.NEXT_PUBLIC_APP_URL)) {
    try {
      if (new URL(env.NEXT_PUBLIC_APP_URL).protocol !== "https:") {
        errors.push("NEXT_PUBLIC_APP_URL must use HTTPS");
      }
    } catch {
      errors.push("NEXT_PUBLIC_APP_URL must be a valid absolute URL");
    }
  }
  return errors;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (invokedPath === import.meta.url) {
  const pulledPath = process.argv[2];
  const env = pulledPath ? parseEnv(fs.readFileSync(pulledPath, "utf8")) : process.env;
  const errors = validateLiveDemoEnvironment(env, pulledPath ? process.env : undefined);
  if (errors.length) {
    console.error(["Live-demo environment preflight failed:", ...errors].join("\n"));
    process.exit(1);
  }
  console.log("Live-demo environment preflight passed for the isolated supervised lane.");
}
