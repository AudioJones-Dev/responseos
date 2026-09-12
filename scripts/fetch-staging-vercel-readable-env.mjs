import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { CANONICAL_STAGING_VERCEL } from "./staging-vercel-custom-environment.mjs";

const CANONICAL_PROJECT = Object.freeze({
  teamId: "team_BHxIkAGPW6qEKKQBAt9c0NGz",
  projectId: "prj_pbzqdkzp322jcHWIsi19GhsnWXRm",
  projectName: "responseos-staging-mock",
});

export const READABLE_STAGING_NAMES = Object.freeze({
  posture: Object.freeze([
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "AJ_DIGITAL_CLERK_ORG_ID",
    "NEXT_PUBLIC_APP_URL",
    "RESPONSEOS_REQUIRE_AUTH",
  ]),
  final: Object.freeze([
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "AJ_DIGITAL_CLERK_ORG_ID",
    "NEXT_PUBLIC_APP_URL",
    "RESPONSEOS_REQUIRE_AUTH",
    "RESPONSEOS_DATABASE_IDENTITY",
  ]),
});

function matchesScope(entry, scope) {
  if (scope === "source-preview") {
    return (
      Array.isArray(entry?.target) &&
      entry.target.includes("preview") &&
      !entry.gitBranch &&
      (!Array.isArray(entry.customEnvironmentIds) ||
        entry.customEnvironmentIds.length === 0)
    );
  }

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

export async function fetchReadableStagingEnvironment({
  metadata,
  mode,
  scope,
  token,
  teamId,
  projectId,
  projectName,
  fetchImpl = fetch,
}) {
  const names = READABLE_STAGING_NAMES[mode];
  if (!names) {
    throw new Error("Readable staging mode must be posture or final");
  }
  if (scope !== "source-preview" && scope !== "custom-environment") {
    throw new Error("Readable staging scope must be source-preview or custom-environment");
  }
  if (
    teamId !== CANONICAL_PROJECT.teamId ||
    projectId !== CANONICAL_PROJECT.projectId ||
    projectName !== CANONICAL_PROJECT.projectName
  ) {
    throw new Error("Vercel readable target is not canonical staging");
  }
  if (!token) {
    throw new Error("VERCEL_TOKEN is required for readable staging retrieval");
  }

  const entries = Array.isArray(metadata) ? metadata : metadata?.envs;
  if (!Array.isArray(entries)) {
    throw new Error("Vercel environment metadata must contain an envs array");
  }

  const values = {};
  for (const name of names) {
    const matches = entries.filter(
      (entry) => entry?.key === name && matchesScope(entry, scope),
    );
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one ${scope} variable named ${name}`,
      );
    }

    const entry = matches[0];
    if (entry.type !== "encrypted" || typeof entry.id !== "string") {
      throw new Error(`Readable staging variable is not encrypted metadata: ${name}`);
    }

    const url = new URL(
      `https://api.vercel.com/v1/projects/${encodeURIComponent(projectName)}/env/${encodeURIComponent(entry.id)}`,
    );
    url.searchParams.set("teamId", teamId);
    url.searchParams.set("decrypt", "true");
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(
        `Vercel readable staging variable request failed for ${name} (${response.status})`,
      );
    }

    const result = await response.json();
    if (typeof result?.value !== "string" || result.value.length === 0) {
      throw new Error(`Vercel returned no readable value for ${name}`);
    }
    values[name] = result.value;
  }

  return values;
}

function assertRunnerTempPath(outputPath, runnerTemp) {
  if (!outputPath || !runnerTemp) {
    throw new Error("Output path and RUNNER_TEMP are required");
  }
  const resolvedOutput = path.resolve(outputPath);
  const resolvedRunnerTemp = path.resolve(runnerTemp);
  if (
    resolvedOutput !== resolvedRunnerTemp &&
    !resolvedOutput.startsWith(`${resolvedRunnerTemp}${path.sep}`)
  ) {
    throw new Error("Readable staging output must remain under RUNNER_TEMP");
  }
  return resolvedOutput;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  const [mode, scope, metadataPath, outputPath] = process.argv.slice(2);

  try {
    const resolvedOutput = assertRunnerTempPath(
      outputPath,
      process.env.RUNNER_TEMP,
    );
    const values = await fetchReadableStagingEnvironment({
      metadata: JSON.parse(fs.readFileSync(metadataPath, "utf8")),
      mode,
      scope,
      token: process.env.VERCEL_TOKEN,
      teamId: process.env.VERCEL_ORG_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
      projectName: process.env.EXPECTED_VERCEL_PROJECT_NAME,
    });
    fs.writeFileSync(resolvedOutput, JSON.stringify(values), {
      encoding: "utf8",
      mode: 0o600,
    });
    console.log(
      `Retrieved ${Object.keys(values).length} allowlisted readable staging variables through Vercel REST.`,
    );
  } catch (error) {
    console.error(
      `Readable staging retrieval failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    process.exit(1);
  }
}
