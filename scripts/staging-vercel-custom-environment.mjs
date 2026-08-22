import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const CANONICAL_STAGING_VERCEL = Object.freeze({
  teamId: "team_BHxIkAGPW6qEKKQBAt9c0NGz",
  projectId: "prj_pbzqdkzp322jcHWIsi19GhsnWXRm",
  projectName: "responseos-staging-mock",
  customEnvironmentId: "env_uX6Qp8F6w9aBgx2ikH3BiREB8aHH",
  customEnvironmentSlug: "staging",
});

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

export function validateStagingCustomEnvironment(environment) {
  const errors = [];

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
  if (arrayOrEmpty(environment?.domains).length !== 0) {
    errors.push("Vercel staging custom environment must not have domains");
  }
  if (arrayOrEmpty(environment?.currentDeploymentAliases).length !== 0) {
    errors.push("Vercel staging custom environment must not have deployment aliases");
  }

  return errors;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  const environmentPath = process.argv[2];
  if (!environmentPath) {
    console.error("Usage: node scripts/staging-vercel-custom-environment.mjs <custom-environment.json>");
    process.exit(1);
  }

  const errors = validateStagingCustomEnvironment(
    JSON.parse(fs.readFileSync(environmentPath, "utf8")),
  );
  if (errors.length > 0) {
    console.error(["Staging custom environment verification failed:", ...errors].join("\n"));
    process.exit(1);
  }

  console.log("Canonical governed Vercel custom environment verified.");
}
