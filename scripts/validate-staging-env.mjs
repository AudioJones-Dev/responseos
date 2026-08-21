import crypto from "node:crypto";
import fs from "node:fs";
import { parseEnv } from "node:util";
import { pathToFileURL } from "node:url";

export const CANONICAL_STAGING_DATABASE = Object.freeze({
  projectName: "responseos-staging-mock",
  projectId: "patient-snow-16014934",
  branchName: "main",
  branchId: "br-mute-boat-a6ylen11",
});

const DATABASE_IDENTITY_NAME = "RESPONSEOS_DATABASE_IDENTITY";
const DATABASE_URL_NAMES = ["DATABASE_URL", "DIRECT_URL"];

const REQUIRED_NAMES = [
  ...DATABASE_URL_NAMES,
  DATABASE_IDENTITY_NAME,
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_WEBHOOK_SECRET",
  "AJ_DIGITAL_CLERK_ORG_ID",
  "NEXT_PUBLIC_APP_URL",
  "RESPONSEOS_REQUIRE_AUTH",
];

const SENSITIVE_REQUIRED_NAMES = new Set([
  ...DATABASE_URL_NAMES,
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

function matchingPreviewEntries(entries, name) {
  return entries.filter(
    (entry) => entry?.key === name && targetsPreview(entry),
  );
}

function parseNeonTarget(value) {
  if (!hasValue(value)) {
    return undefined;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      return undefined;
    }

    const match = url.hostname
      .toLowerCase()
      .match(/^(ep-[a-z0-9-]+?)(-pooler)?\.(?:[^.]+\.)+neon\.tech$/);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (!match || !databaseName || databaseName.includes("/")) {
      return undefined;
    }

    return {
      endpointId: match[1],
      databaseName,
    };
  } catch {
    return undefined;
  }
}

function identityFingerprint(identity) {
  const canonical = [
    "responseos-neon-identity-v1",
    identity.projectId,
    identity.branchId,
    identity.endpointId,
    identity.databaseName,
  ].join(":");
  return `sha256:${crypto.createHash("sha256").update(canonical).digest("hex")}`;
}

function unwrapMetadata(metadata, name) {
  const value = metadata?.[name];
  return value?.[name] ?? value;
}

export function validateCanonicalStagingDatabaseSource(
  migrationEnv,
  neonMetadata,
) {
  const errors = [];
  const migrationTargets = Object.fromEntries(
    DATABASE_URL_NAMES.map((name) => [name, parseNeonTarget(migrationEnv[name])]),
  );

  for (const name of DATABASE_URL_NAMES) {
    if (!migrationTargets[name]) {
      errors.push(
        `${name} must resolve to an identifiable Neon endpoint and database`,
      );
    }
  }

  if (
    migrationTargets.DATABASE_URL &&
    migrationTargets.DIRECT_URL &&
    (migrationTargets.DATABASE_URL.endpointId !==
      migrationTargets.DIRECT_URL.endpointId ||
      migrationTargets.DATABASE_URL.databaseName !==
        migrationTargets.DIRECT_URL.databaseName)
  ) {
    errors.push(
      "GitHub migration and runtime database URLs must resolve to the same Neon endpoint and database",
    );
  }

  const migrationTarget = migrationTargets.DIRECT_URL;
  const project = unwrapMetadata(neonMetadata, "project");
  const branch = unwrapMetadata(neonMetadata, "branch");
  const endpoints = neonMetadata?.endpoints?.endpoints;
  const databases = neonMetadata?.databases?.databases;

  if (
    project?.id !== CANONICAL_STAGING_DATABASE.projectId ||
    project?.name !== CANONICAL_STAGING_DATABASE.projectName
  ) {
    errors.push("Neon project identity is not the canonical mock-staging project");
  }

  if (
    branch?.id !== CANONICAL_STAGING_DATABASE.branchId ||
    branch?.project_id !== CANONICAL_STAGING_DATABASE.projectId ||
    branch?.name !== CANONICAL_STAGING_DATABASE.branchName
  ) {
    errors.push("Neon branch identity is not the canonical mock-staging branch");
  }

  if (migrationTarget) {
    const matchingEndpoints = Array.isArray(endpoints)
      ? endpoints.filter(
          (endpoint) =>
            endpoint?.id === migrationTarget.endpointId &&
            endpoint?.project_id === CANONICAL_STAGING_DATABASE.projectId &&
            endpoint?.branch_id === CANONICAL_STAGING_DATABASE.branchId &&
            endpoint?.type === "read_write" &&
            endpoint?.disabled !== true,
        )
      : [];
    if (matchingEndpoints.length !== 1) {
      errors.push(
        "Neon endpoint evidence does not bind the migration connection to the canonical staging branch",
      );
    }

    const matchingDatabases = Array.isArray(databases)
      ? databases.filter(
          (database) =>
            database?.name === migrationTarget.databaseName &&
            database?.branch_id === CANONICAL_STAGING_DATABASE.branchId,
        )
      : [];
    if (matchingDatabases.length !== 1) {
      errors.push(
        "Neon database evidence does not bind the migration connection to the canonical staging branch",
      );
    }
  }

  return errors;
}

function databaseIdentityErrors(
  pulledEnv,
  entries,
  migrationEnv,
  neonMetadata,
) {
  const errors = validateCanonicalStagingDatabaseSource(
    migrationEnv,
    neonMetadata,
  );
  const migrationTargets = Object.fromEntries(
    DATABASE_URL_NAMES.map((name) => [name, parseNeonTarget(migrationEnv[name])]),
  );

  const identityEntries = matchingPreviewEntries(
    entries,
    DATABASE_IDENTITY_NAME,
  );
  if (identityEntries.length !== 1) {
    errors.push(
      `Expected exactly one unbranched Preview identity variable: ${DATABASE_IDENTITY_NAME}`,
    );
  } else if (identityEntries[0].type !== "encrypted") {
    errors.push(`${DATABASE_IDENTITY_NAME} must be readable encrypted metadata`);
  }

  const databaseEntries = {};
  for (const name of DATABASE_URL_NAMES) {
    const matches = matchingPreviewEntries(entries, name);
    if (matches.length !== 1) {
      errors.push(`Expected exactly one unbranched Preview variable: ${name}`);
    } else {
      databaseEntries[name] = matches[0];
    }
  }

  let attestation;
  if (hasValue(pulledEnv[DATABASE_IDENTITY_NAME])) {
    try {
      attestation = JSON.parse(pulledEnv[DATABASE_IDENTITY_NAME]);
    } catch {
      errors.push(`${DATABASE_IDENTITY_NAME} must be valid JSON`);
    }
  }

  const migrationTarget = migrationTargets.DIRECT_URL;
  if (attestation) {
    const identity = attestation.identity;
    if (attestation.version !== 1 || !identity) {
      errors.push("Vercel database identity evidence must use version 1");
    } else {
      for (const [field, expected] of Object.entries(
        CANONICAL_STAGING_DATABASE,
      )) {
        if (identity[field] !== expected) {
          errors.push(`Vercel database identity has wrong ${field}`);
        }
      }

      if (
        migrationTarget &&
        (identity.endpointId !== migrationTarget.endpointId ||
          identity.databaseName !== migrationTarget.databaseName)
      ) {
        errors.push(
          "Vercel runtime database identity does not match the GitHub migration database identity",
        );
      }

      if (
        identity.endpointId &&
        identity.databaseName &&
        attestation.fingerprint !== identityFingerprint(identity)
      ) {
        errors.push("Vercel database identity fingerprint is conflicting");
      }
    }

    for (const name of DATABASE_URL_NAMES) {
      const revision = attestation.vercel?.[name];
      const entry = databaseEntries[name];
      if (
        !revision ||
        !entry ||
        revision.envId !== entry.id ||
        revision.updatedAt !== entry.updatedAt
      ) {
        errors.push(`Vercel database identity evidence is stale for ${name}`);
      }
    }
  }

  return errors;
}

export function createDatabaseIdentityAttestation(
  databaseEnv,
  metadata,
  attestedAt = Date.now(),
) {
  const entries = Array.isArray(metadata) ? metadata : metadata?.envs;
  if (!Array.isArray(entries)) {
    throw new Error("Vercel environment metadata must contain an envs array");
  }

  const targets = Object.fromEntries(
    DATABASE_URL_NAMES.map((name) => [name, parseNeonTarget(databaseEnv[name])]),
  );
  if (!targets.DATABASE_URL || !targets.DIRECT_URL) {
    throw new Error("Database URLs must identify Neon endpoint and database targets");
  }
  if (
    targets.DATABASE_URL.endpointId !== targets.DIRECT_URL.endpointId ||
    targets.DATABASE_URL.databaseName !== targets.DIRECT_URL.databaseName
  ) {
    throw new Error("Database URLs must identify the same Neon target");
  }

  const vercel = {};
  for (const name of DATABASE_URL_NAMES) {
    const matches = matchingPreviewEntries(entries, name);
    if (
      matches.length !== 1 ||
      !hasValue(matches[0].id) ||
      !Number.isSafeInteger(matches[0].updatedAt)
    ) {
      throw new Error(`Missing unique Vercel revision metadata for ${name}`);
    }
    vercel[name] = {
      envId: matches[0].id,
      updatedAt: matches[0].updatedAt,
    };
  }

  const identity = {
    ...CANONICAL_STAGING_DATABASE,
    ...targets.DIRECT_URL,
  };
  return {
    version: 1,
    attestedAt,
    identity,
    fingerprint: identityFingerprint(identity),
    vercel,
  };
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
    for (const name of DATABASE_URL_NAMES) {
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
 * Vercel never returns values for variables marked Sensitive. Database
 * identity is therefore derived from the GitHub URLs, bound to the exact
 * Vercel Sensitive-variable revisions by a non-secret attestation, and
 * checked against live Neon control-plane resource metadata.
 *
 * @param {Readonly<Record<string, string | undefined>>} pulledEnv
 * @param {{ envs?: ReadonlyArray<Record<string, unknown>> } | ReadonlyArray<Record<string, unknown>>} metadata
 * @param {Readonly<Record<string, string | undefined>>} expectedDatabaseEnv
 * @param {Readonly<Record<string, unknown>>} neonMetadata
 */
export function validateVercelPreviewEnvironment(
  pulledEnv,
  metadata,
  expectedDatabaseEnv,
  neonMetadata = {},
) {
  const errors = [];
  const entries = Array.isArray(metadata) ? metadata : metadata?.envs;

  if (!Array.isArray(entries)) {
    return ["Vercel environment metadata must contain an envs array"];
  }

  for (const name of REQUIRED_NAMES) {
    const matches = matchingPreviewEntries(entries, name);
    if (matches.length === 0) {
      errors.push(`Missing required Preview variable metadata: ${name}`);
      continue;
    }
    if (matches.length > 1) {
      errors.push(`Conflicting unbranched Preview variable metadata: ${name}`);
      continue;
    }

    const entry = matches[0];
    if (SENSITIVE_REQUIRED_NAMES.has(name) && entry.type !== "sensitive") {
      errors.push(`Required Preview variable must be Sensitive: ${name}`);
    }

    if (!SENSITIVE_REQUIRED_NAMES.has(name) && !hasValue(pulledEnv[name])) {
      errors.push(`Missing readable Preview variable: ${name}`);
    }
  }

  for (const name of FORBIDDEN_NAMES) {
    if (entries.some((entry) => entry?.key === name && targetsPreview(entry))) {
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

  if (
    hasValue(expectedDatabaseEnv.DATABASE_URL) &&
    expectedDatabaseEnv.DATABASE_URL === expectedDatabaseEnv.DIRECT_URL
  ) {
    errors.push("DATABASE_URL and DIRECT_URL must be distinct staging secrets");
  }

  errors.push(
    ...databaseIdentityErrors(
      pulledEnv,
      entries,
      expectedDatabaseEnv,
      neonMetadata,
    ),
  );

  return errors;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  const pulledEnvPath = process.argv[2];
  const metadataPath = process.argv[3];
  const neonMetadataPaths = process.argv.slice(4, 8);
  const checkedEnv = pulledEnvPath
    ? parseEnv(fs.readFileSync(pulledEnvPath, "utf8"))
    : process.env;
  const neonMetadataNames = ["project", "branch", "endpoints", "databases"];
  const neonMetadata = Object.fromEntries(
    neonMetadataNames.map((name, index) => [
      name,
      neonMetadataPaths[index]
        ? JSON.parse(fs.readFileSync(neonMetadataPaths[index], "utf8"))
        : undefined,
    ]),
  );
  const errors = metadataPath
    ? validateVercelPreviewEnvironment(
        checkedEnv,
        JSON.parse(fs.readFileSync(metadataPath, "utf8")),
        process.env,
        neonMetadata,
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
      ? "Staging environment preflight passed: Vercel, Neon, database-revision, auth, and mock-only identities are valid."
      : "Staging environment preflight passed: required names are present and live-provider names are absent.",
  );
}
