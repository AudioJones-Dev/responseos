import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LIVE_DEMO_TARGET } from "./live-demo-commissioning-contract.mjs";

const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const namesEqual = (actual, expected) => Array.isArray(actual) && actual.length === expected.length && new Set(actual).size === actual.length && expected.every(name => actual.includes(name));
export function validateDopplerPlan(plan) {
  const errors = [];
  if (!exactKeys(plan, ["version", "executionEnabled", "syncEnabled", "localDevelopment", "historicalDemo", "qualificationRuntime", "qualificationRelease", "productionIncluded", "approvalReference"])) return ["Unexpected plan shape; values withheld"];
  if (plan.version !== 1 || plan.executionEnabled !== false || plan.syncEnabled !== false || plan.productionIncluded !== false || plan.approvalReference !== null) errors.push("Execution, sync, production and approval must remain disabled/unset");
  if (!exactKeys(plan.localDevelopment, ["project", "config", "configExistenceVerified"]) || plan.localDevelopment.project !== "response-os" || plan.localDevelopment.config !== "dev" || plan.localDevelopment.configExistenceVerified !== true) errors.push("Development mapping differs from repository evidence");
  if (!exactKeys(plan.historicalDemo, ["project", "config", "configExistenceVerified", "reuseForQualification"]) || plan.historicalDemo.project !== "response-os" || plan.historicalDemo.config !== "stg_staging_demo" || plan.historicalDemo.configExistenceVerified !== true || plan.historicalDemo.reuseForQualification !== false) errors.push("Historical demo must not become qualification authority");
  const runtime = plan.qualificationRuntime, release = plan.qualificationRelease;
  if (!exactKeys(runtime, ["source", "destination", "secretNames", "configurationNames", "syncMetadataVerified", "customEnvironmentSupportDocumented"]) || runtime.source !== null || runtime.syncMetadataVerified !== false || runtime.customEnvironmentSupportDocumented !== true) errors.push("Qualification source must remain unset; documented capability and unverified sync must be explicit");
  if (!exactKeys(release, ["source", "destination", "secretNames", "nonsecretEnvironmentSecretNames", "syncMetadataVerified"]) || release.source !== null || release.syncMetadataVerified !== false) errors.push("Qualification release source must remain unverified and unset");
  const target = runtime?.destination;
  if (!exactKeys(target, ["provider", "orgId", "projectId", "projectName", "environmentId", "environmentSlug"]) || target.provider !== "vercel" || ["orgId", "projectId", "projectName", "environmentId", "environmentSlug"].some(key => target[key] !== LIVE_DEMO_TARGET[key])) errors.push("Qualification destination must match the pinned custom environment");
  const github = release?.destination;
  if (!exactKeys(github, ["provider", "repository", "environment", "scope"]) || github.provider !== "github" || github.repository !== "AudioJones-Dev/responseos" || github.environment !== "live-demo-staging" || github.scope !== "environment-only") errors.push("Release destination must be the exact GitHub Environment");
  if (!namesEqual(runtime?.secretNames, ["DATABASE_URL", "DIRECT_URL", "CLERK_SECRET_KEY", "CLERK_WEBHOOK_SECRET"]) || !namesEqual(runtime?.configurationNames, ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "AJ_DIGITAL_CLERK_ORG_ID", "RESPONSEOS_DEPLOYMENT_LANE", "RESPONSEOS_REQUIRE_AUTH", "RESPONSEOS_LIVE_HUBSPOT_ENABLED", "RESPONSEOS_LIVE_EMAIL_ENABLED", "RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED"])) errors.push("Runtime name allowlist mismatch; provider/release credentials prohibited");
  if (!namesEqual(release?.secretNames, ["VERCEL_TOKEN", "VERCEL_AUTOMATION_BYPASS_SECRET", "LIVE_DEMO_DATABASE_URL", "LIVE_DEMO_DIRECT_URL"]) || !namesEqual(release?.nonsecretEnvironmentSecretNames, ["VERCEL_ORG_ID", "VERCEL_PROJECT_ID"])) errors.push("Release name allowlist mismatch");
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 3) throw new Error("arguments");
    const plan = JSON.parse(fs.readFileSync(process.argv[2] ?? new URL("../infra/doppler-plan.json", import.meta.url), "utf8"));
    const errors = validateDopplerPlan(plan);
    if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
    else console.log("Local non-secret Doppler plan valid; execution and synchronization remain disabled.");
  } catch { console.error("Doppler plan unreadable or invalid; values withheld."); process.exitCode = 1; }
}
