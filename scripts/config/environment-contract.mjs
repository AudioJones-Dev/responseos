import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

export const ENVIRONMENT_SCHEMA_VERSION = "responseos.environment.v1";
export const CERTIFICATION_SCHEMA_VERSION = "responseos.environment-certification.v1";
export const SECRET_SCHEMA_VERSION = "responseos.secret-contract.v1";
export const PROMOTION_POLICY_SCHEMA_VERSION = "responseos.promotion-policy.v1";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
export const DEFAULT_SCHEMA_DIR = path.join(
  REPOSITORY_ROOT,
  "infra",
  "environments",
  "schema",
);

const SCHEMA_FILES = Object.freeze({
  environment: "environment-contract.schema.json",
  certification: "certification-record.schema.json",
  secret: "secret-contract.schema.json",
  policy: "promotion-policy.schema.json",
});

const SCHEMA_IDS = Object.freeze({
  environment: "https://responseos.dev/schemas/environment-contract.v1.json",
  certification: "https://responseos.dev/schemas/certification-record.v1.json",
  secret: "https://responseos.dev/schemas/secret-contract.v1.json",
  policy: "https://responseos.dev/schemas/promotion-policy.v1.json",
});

const FORBIDDEN_VALUE_KEYS = new Set([
  "apikey",
  "apikeys",
  "accesstoken",
  "accesstokens",
  "authtoken",
  "bearertoken",
  "connectionstring",
  "connectionstrings",
  "credentials",
  "credentialvalue",
  "credentialvalues",
  "ciphertext",
  "databaseurl",
  "databaseurls",
  "directurl",
  "password",
  "passwords",
  "plaintext",
  "privatekey",
  "privatekeys",
  "rawbody",
  "rawbodies",
  "secret",
  "secrets",
  "secretvalue",
  "signingkey",
  "signingkeys",
  "token",
  "tokens",
  "tokenvalue",
  "value",
]);

const CREDENTIAL_PATTERNS = Object.freeze([
  { name: "private key block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "credential-bearing database URL", pattern: /postgres(?:ql)?:\/\/[^\s:/]+:[^\s@/]+@/i },
  { name: "credential-bearing URL", pattern: /https?:\/\/[^\s:/]+:[^\s@/]+@/i },
  { name: "Clerk private key", pattern: /\bsk_(?:live|test)_[A-Za-z0-9_-]{8,}\b/ },
  { name: "webhook signing secret", pattern: /\bwhsec_[A-Za-z0-9_-]{8,}\b/ },
  { name: "GitHub token", pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{16,}\b/ },
  { name: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "HubSpot private app token", pattern: /\bpat-[a-z0-9]+-[A-Za-z0-9-]{16,}\b/i },
  { name: "Neon API key", pattern: /\bnapi_[A-Za-z0-9_-]{16,}\b/ },
  { name: "Telnyx API key", pattern: /\bKEY[0-9A-Z]{16,}\b/ },
  { name: "authorization bearer value", pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/i },
  { name: "JSON Web Token", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
]);

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function prettyCanonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function hashCanonical(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

export function configurationFingerprint(environment, secretContract) {
  return hashCanonical({ environment, secretContract });
}

export function assertNoSecretValues(value, currentPath = "document") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoSecretValues(entry, `${currentPath}[${index}]`),
    );
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
      if (
        FORBIDDEN_VALUE_KEYS.has(normalizedKey) &&
        nested !== null &&
        nested !== false &&
        nested !== ""
      ) {
        throw new Error(`secret_value_field_forbidden:${currentPath}.${key}`);
      }
      assertNoSecretValues(nested, `${currentPath}.${key}`);
    }
    return;
  }

  if (typeof value === "string") {
    for (const candidate of CREDENTIAL_PATTERNS) {
      if (candidate.pattern.test(value)) {
        throw new Error(`secret_value_detected:${currentPath}:${candidate.name}`);
      }
    }
  }
}

export function buildSchemaRegistry(schemaDirectory = DEFAULT_SCHEMA_DIR) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const fileName of Object.values(SCHEMA_FILES)) {
    ajv.addSchema(readJson(path.join(schemaDirectory, fileName)));
  }
  return ajv;
}

function formatSchemaErrors(errors = []) {
  return errors.map(
    (error) =>
      `schema:${error.instancePath || "/"}:${error.message ?? error.keyword}`,
  );
}

export function validateAgainstSchema(
  value,
  kind,
  schemaDirectory = DEFAULT_SCHEMA_DIR,
) {
  const schemaId = SCHEMA_IDS[kind];
  if (!schemaId) return [`schema:unknown document kind ${kind}`];
  const validate = buildSchemaRegistry(schemaDirectory).getSchema(schemaId);
  if (!validate) return [`schema:validator unavailable for ${kind}`];
  return validate(value) ? [] : formatSchemaErrors(validate.errors);
}

export function jsonPointerGet(document, pointer) {
  if (pointer === "") return document;
  if (!pointer.startsWith("/")) return undefined;
  return pointer
    .slice(1)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce(
      (current, part) =>
        current && Object.prototype.hasOwnProperty.call(current, part)
          ? current[part]
          : undefined,
      document,
    );
}

export function isUnresolved(value) {
  return value === undefined || value === null || value === "unresolved";
}

export function validateSecretContract(secretContract, environmentName) {
  const errors = validateAgainstSchema(secretContract, "secret");
  try {
    assertNoSecretValues(secretContract, "secretContract");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "secret_value_detected");
  }

  if (secretContract?.environment !== environmentName) {
    errors.push("secret:environment does not match the environment contract");
  }

  const names = new Set();
  for (const variable of secretContract?.variables ?? []) {
    if (names.has(variable.name)) {
      errors.push(`secret:duplicate variable metadata:${variable.name}`);
    }
    names.add(variable.name);
    if (variable.environment !== environmentName) {
      errors.push(`secret:${variable.name}:environment mismatch`);
    }
    if (variable.clientExposed && variable.serverOnly) {
      errors.push(`secret:${variable.name}:cannot be both server-only and client-exposed`);
    }
  }

  if (environmentName === "production") {
    if (names.has("RESPONSEOS_DEV_SESSION")) {
      errors.push("production:RESPONSEOS_DEV_SESSION is forbidden");
    }
    for (const variable of secretContract?.variables ?? []) {
      if (
        [
          "DATABASE_URL",
          "DIRECT_URL",
          "CLERK_SECRET_KEY",
          "CLERK_WEBHOOK_SECRET",
          "TELNYX_API_KEY",
          "HUBSPOT_ACCESS_TOKEN",
          "RESPONSEOS_PROVIDER_KEY",
        ].includes(variable.name) &&
        !variable.independentProductionValueRequired
      ) {
        errors.push(
          `production:${variable.name}:must require an independent Production value`,
        );
      }
    }
  }

  return errors;
}

const REQUIRED_APPLICATION_VARIABLES = Object.freeze([
  "AJ_DIGITAL_CLERK_ORG_ID",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SECRET",
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "RESPONSEOS_DATABASE_IDENTITY",
  "RESPONSEOS_REQUIRE_AUTH",
]);

export function validateEnvironmentContract(environment, secretContract) {
  const errors = validateAgainstSchema(environment, "environment");
  try {
    assertNoSecretValues(environment, "environment");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "secret_value_detected");
  }

  if (!environment || typeof environment !== "object") return errors;

  const environmentName = environment.identity?.name;
  const environmentClass = environment.identity?.environmentClass;
  const isTemplate = environmentClass === "template";

  if (
    environment.vercel?.automaticGitDeployments !== false ||
    environment.vercel?.deploymentMode !== "manual" ||
    environment.vercel?.manualOnly !== true
  ) {
    errors.push("deployment:manual-only and automatic-Git-disabled posture required");
  }

  if (
    environment.database?.runtimeConnectionMode ===
      environment.database?.migrationConnectionMode ||
    environment.database?.pooledDirectSeparationRequired !== true
  ) {
    errors.push("database:pooled runtime and direct migration roles must remain separate");
  }

  if (environmentClass === "staging") {
    if (
      environment.authentication?.providerClass !== "development" ||
      environment.authentication?.credentialClass !== "test"
    ) {
      errors.push("staging:Clerk development/test posture required");
    }
    if (
      environment.providerPosture?.mode !== "mock-only" ||
      environment.providerPosture?.enabledProviders?.length > 0
    ) {
      errors.push("staging:live providers are forbidden in the certified mock baseline");
    }
  }

  if (environmentClass === "production") {
    for (const pointer of [
      "/vercel/projectId",
      "/vercel/customEnvironment/id",
      "/database/projectId",
      "/database/branchId",
      "/database/endpointId",
      "/deploymentControls/workflowControlSha",
      "/deploymentControls/intendedApplicationSha",
      "/deploymentControls/concurrency/group",
    ]) {
      if (isUnresolved(jsonPointerGet(environment, pointer))) {
        errors.push(`production:required field unresolved:${pointer}`);
      }
    }
    if (
      environment.authentication?.providerClass !== "production" ||
      environment.authentication?.credentialClass !== "live"
    ) {
      errors.push("production:development or test authentication posture is forbidden");
    }
    if (environment.identity?.lifecycle !== "governed") {
      errors.push("production:environment lifecycle must be governed");
    }
  }

  if (
    environment.providerPosture?.enabledProviders?.length > 0 &&
    (environment.providerPosture?.liveExecutionApprovalState !== "approved" ||
      environment.humanApprovals?.providerEnablement !== "approved" ||
      environment.humanApprovals?.liveProviderExecution !== "approved")
  ) {
    errors.push("provider:enabled provider lacks explicit live-execution approval");
  }

  if (secretContract) {
    errors.push(...validateSecretContract(secretContract, environmentName));
    const applicationVariables = new Set(
      (secretContract.variables ?? [])
        .filter((variable) => variable.scope === "application-runtime")
        .map((variable) => variable.name),
    );
    if (!isTemplate) {
      for (const name of REQUIRED_APPLICATION_VARIABLES) {
        if (!applicationVariables.has(name)) {
          errors.push(`secret:missing required application metadata:${name}`);
        }
      }
    }
    for (const name of environment.authentication?.requiredVariables ?? []) {
      if (!applicationVariables.has(name)) {
        errors.push(`authentication:missing secret-contract binding:${name}`);
      }
    }
  }

  return [...new Set(errors)];
}

function leafPointers(value, pointer = "") {
  if (Array.isArray(value) || value === null || typeof value !== "object") {
    return [pointer];
  }
  return Object.entries(value).flatMap(([key, nested]) =>
    leafPointers(nested, `${pointer}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`),
  );
}

export function validatePromotionPolicy(policy, sourceEnvironment) {
  const errors = validateAgainstSchema(policy, "policy");
  try {
    assertNoSecretValues(policy, "promotionPolicy");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "secret_value_detected");
  }

  const ids = new Set();
  const paths = new Set();
  for (const rule of policy?.rules ?? []) {
    if (ids.has(rule.id)) errors.push(`policy:duplicate rule id:${rule.id}`);
    if (paths.has(rule.path)) {
      errors.push(`policy:path has more than one classification:${rule.path}`);
    }
    ids.add(rule.id);
    paths.add(rule.path);
  }

  if (sourceEnvironment) {
    for (const pointer of leafPointers(sourceEnvironment)) {
      if (!paths.has(pointer)) {
        errors.push(`policy:unclassified environment field:${pointer}`);
      }
    }
  }

  return [...new Set(errors)];
}

export function validateCertificationRecord(
  record,
  environment,
  secretContract,
) {
  const errors = validateAgainstSchema(record, "certification");
  try {
    assertNoSecretValues(record, "certification");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "secret_value_detected");
  }

  if (record?.environmentContractHash !== hashCanonical(environment)) {
    errors.push("certification:environment contract hash mismatch");
  }
  if (
    record?.configurationHash !==
    configurationFingerprint(environment, secretContract)
  ) {
    errors.push("certification:configuration hash mismatch");
  }
  if (record?.certificationType !== "configuration") {
    errors.push("certification:deployment certification claims are forbidden");
  }
  if (record?.environment !== environment?.identity?.name) {
    errors.push("certification:environment does not match the environment contract");
  }
  if (record?.configurationContractVersion !== environment?.schemaVersion) {
    errors.push("certification:configuration contract version mismatch");
  }
  if (
    record?.workflowControlSha !==
    environment?.deploymentControls?.workflowControlSha
  ) {
    errors.push("certification:workflow control SHA mismatch");
  }
  if (
    record?.intendedApplicationSha !==
    environment?.deploymentControls?.intendedApplicationSha
  ) {
    errors.push("certification:intended application SHA mismatch");
  }
  return [...new Set(errors)];
}

export function normalizeEnvironmentReadback(input) {
  assertNoSecretValues(input, "readback");
  const normalized = {
    schemaVersion: ENVIRONMENT_SCHEMA_VERSION,
    contractVersion: "1.0.0",
    identity: structuredClone(input.identity),
    vercel: structuredClone(input.vercel),
    database: structuredClone(input.database),
    authentication: structuredClone(input.authentication),
    deploymentControls: structuredClone(input.deploymentControls),
    providerPosture: structuredClone(input.providerPosture),
    humanApprovals: structuredClone(input.humanApprovals),
  };
  const errors = validateEnvironmentContract(normalized);
  if (errors.length > 0) {
    throw new Error(["environment capture failed", ...errors].join("\n"));
  }
  return canonicalize(normalized);
}

export function validateRepositoryContracts(root = REPOSITORY_ROOT) {
  const environmentRoot = path.join(root, "infra", "environments");
  const stagingEnvironment = readJson(
    path.join(environmentRoot, "staging", "environment.json"),
  );
  const stagingSecrets = readJson(
    path.join(environmentRoot, "staging", "secret-contract.json"),
  );
  const productionTemplate = readJson(
    path.join(environmentRoot, "production", "environment.template.json"),
  );
  const productionSecrets = readJson(
    path.join(environmentRoot, "production", "secret-contract.json"),
  );
  const policy = readJson(
    path.join(environmentRoot, "promotion", "staging-to-production.rules.json"),
  );
  const certification = readJson(
    path.join(environmentRoot, "staging", "certification.json"),
  );

  return [
    ...validateEnvironmentContract(stagingEnvironment, stagingSecrets),
    ...validateEnvironmentContract(productionTemplate, productionSecrets),
    ...validatePromotionPolicy(policy, stagingEnvironment),
    ...validateCertificationRecord(
      certification,
      stagingEnvironment,
      stagingSecrets,
    ),
  ];
}
