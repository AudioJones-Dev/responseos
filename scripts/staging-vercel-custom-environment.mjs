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

function isExactManagedAliasSet(value, mode) {
  const hasCanonicalAlias =
    Array.isArray(value) &&
    value.length === 1 &&
    value[0] === CANONICAL_STAGING_VERCEL.managedEnvironmentAlias;

  if (mode === "post-ready") return hasCanonicalAlias;

  return (
    Array.isArray(value) &&
    (value.length === 0 || hasCanonicalAlias)
  );
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
  if (!isExactManagedAliasSet(environment?.currentDeploymentAliases, mode)) {
    errors.push(
      mode === "post-ready"
        ? "Vercel staging custom environment must contain the canonical managed environment alias after READY"
        : "Vercel staging custom environment may contain only the canonical managed environment alias",
    );
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

  const errors = validateStagingCustomEnvironment(
    JSON.parse(fs.readFileSync(environmentPath, "utf8")),
    mode,
  );
  if (errors.length > 0) {
    console.error(["Staging custom environment verification failed:", ...errors].join("\n"));
    process.exit(1);
  }

  console.log(
    mode === "post-ready"
      ? "Canonical governed Vercel custom environment routing verified after READY."
      : "Canonical governed Vercel custom environment verified before deployment.",
  );
}
