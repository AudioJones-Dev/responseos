import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const CANONICAL_STAGING_VERCEL = Object.freeze({
  teamId: "team_BHxIkAGPW6qEKKQBAt9c0NGz",
  projectId: "prj_pbzqdkzp322jcHWIsi19GhsnWXRm",
  projectName: "responseos-staging-mock",
  customEnvironmentId: "env_uX6Qp8F6w9aBgx2ikH3BiREB8aHH",
  customEnvironmentSlug: "staging",
  managedEnvironmentAlias:
    "responseos-staging-mock-env-staging-audiojones.vercel.app",
});

export function classifyStagingCustomEnvironmentAliasTelemetry(value) {
  if (value == null) return "missing";
  if (!Array.isArray(value)) return "unsafe";
  if (value.length === 0) return "empty";
  if (
    value.length === 1 &&
    value[0] === CANONICAL_STAGING_VERCEL.managedEnvironmentAlias
  ) {
    return "canonical";
  }
  return "unsafe";
}

export function validateStagingCustomEnvironment(
  environment,
  mode = "pre-deploy",
) {
  const errors = [];

  if (!new Set(["pre-deploy", "post-ready"]).has(mode)) {
    return ["Vercel custom environment validation mode is unsupported"];
  }

  if (environment?.id !== CANONICAL_STAGING_VERCEL.customEnvironmentId) {
    errors.push("Vercel custom environment id is not canonical staging");
  }
  if (environment?.slug !== CANONICAL_STAGING_VERCEL.customEnvironmentSlug) {
    errors.push("Vercel custom environment slug is not staging");
  }
  if (environment?.type !== "preview") {
    errors.push("Vercel custom environment type must be preview");
  }
  if (environment?.branchMatcher != null) {
    errors.push("Vercel staging custom environment must not track a branch");
  }
  if (!Array.isArray(environment?.domains) || environment.domains.length !== 0) {
    errors.push("Vercel staging custom environment must not have domains");
  }
  if (
    classifyStagingCustomEnvironmentAliasTelemetry(
      environment?.currentDeploymentAliases,
    ) === "unsafe"
  ) {
    errors.push("Vercel staging custom environment has unsafe optional alias telemetry");
  }

  return errors;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  const environmentPath = process.argv[2];
  const mode = process.argv[3] ?? "pre-deploy";
  if (!environmentPath) {
    console.error("Usage: node scripts/staging-vercel-custom-environment.mjs <custom-environment.json> [pre-deploy|post-ready]");
    process.exit(1);
  }

  const environment = JSON.parse(fs.readFileSync(environmentPath, "utf8"));
  const errors = validateStagingCustomEnvironment(environment, mode);
  if (errors.length > 0) {
    console.error(["Staging custom environment verification failed:", ...errors].join("\n"));
    process.exit(1);
  }

  const aliasTelemetry = classifyStagingCustomEnvironmentAliasTelemetry(
    environment.currentDeploymentAliases,
  );
  console.log(`Custom Environment alias telemetry: ${aliasTelemetry}`);
  console.log(
    mode === "post-ready"
      ? "Canonical governed Vercel custom environment posture verified after READY; managed-alias routing is certified separately."
      : "Canonical governed Vercel custom environment verified before deployment.",
  );
}
