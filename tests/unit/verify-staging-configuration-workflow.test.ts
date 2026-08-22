import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const workflowPath = path.join(
  process.cwd(),
  ".github",
  "workflows",
  "verify-staging-configuration.yml",
);
const workflow = fs.readFileSync(workflowPath, "utf8");
const deployWorkflow = fs.readFileSync(
  path.join(process.cwd(), ".github", "workflows", "deploy-staging.yml"),
  "utf8",
);

function runScripts(yaml: string) {
  const lines = yaml.split(/\r?\n/);
  const scripts: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)run:\s*\|\s*$/);
    if (!match) continue;

    const indent = match[1].length;
    const block: string[] = [];
    for (index += 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim() && line.search(/\S/) <= indent) {
        index -= 1;
        break;
      }
      block.push(line);
    }
    scripts.push(block.join("\n"));
  }

  return scripts;
}

function concurrencyContract(yaml: string) {
  const match = yaml.match(
    /^concurrency:\r?\n  group: ([a-z0-9-]+)\r?\n  cancel-in-progress: (true|false)$/m,
  );
  return match
    ? { group: match[1], cancelInProgress: match[2] === "true" }
    : undefined;
}

describe("configuration-only staging workflow", () => {
  test("all workflow Bash blocks pass syntax validation", () => {
    for (const script of runScripts(workflow)) {
      const result = spawnSync("bash", ["-n"], { input: script, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
    }
  });

  test("shares one non-cancelling exclusive lock with staging deployment", () => {
    const preflightConcurrency = concurrencyContract(workflow);
    const deployConcurrency = concurrencyContract(deployWorkflow);

    expect(preflightConcurrency).toEqual({
      group: "responseos-staging-exclusive",
      cancelInProgress: false,
    });
    expect(deployConcurrency).toEqual(preflightConcurrency);
  });

  test("keeps dispatch inputs out of Bash source", () => {
    expect(runScripts(workflow).join("\n")).not.toContain("${{ inputs.");
  });

  test("cannot invoke migrations, seed, builds, deployments, aliases, or hosted smoke", () => {
    const commands = runScripts(workflow).join("\n").toLowerCase();
    for (const prohibited of [
      "prisma migrate",
      "prisma db seed",
      "npm run build",
      "vercel build",
      "vercel deploy",
      "vercel promote",
      "vercel alias",
      "/api/health",
      "x-vercel-protection-bypass:",
    ]) {
      expect(commands).not.toContain(prohibited);
    }
  });

  test("uses REST-only custom-environment configuration without Vercel CLI identity", () => {
    const commands = runScripts(workflow).join("\n").toLowerCase();

    expect(commands).not.toContain("vercel link");
    expect(commands).not.toContain("vercel env pull");
    expect(commands).not.toContain("npm install -g vercel");
    expect(commands).toContain(
      "https://api.vercel.com/v10/projects/$expected_vercel_project_id/env",
    );
    expect(commands).toContain("fetch-staging-vercel-readable-env.mjs");
    expect(commands).toContain("customenvironmentid=$expected_vercel_custom_env_id");
  });

  test("validates the full source plan and readable posture before any scope PATCH", () => {
    const compatibility = workflow.indexOf(
      "Verify deployment workflow custom-environment compatibility",
    );
    const plan = workflow.indexOf("Validate complete source migration plan");
    const posture = workflow.indexOf(
      "Validate readable source posture before scope mutation",
    );
    const synchronize = workflow.indexOf(
      "Re-scope existing variables without values",
    );

    expect(compatibility).toBeGreaterThan(-1);
    expect(plan).toBeGreaterThan(compatibility);
    expect(posture).toBeGreaterThan(plan);
    expect(posture).toBeGreaterThan(-1);
    expect(synchronize).toBeGreaterThan(posture);
  });

  test("checks deployment compatibility before any migration planning or scope PATCH", () => {
    const compatibility = workflow.indexOf(
      "validate-staging-deploy-environment-contract.mjs",
    );
    const plan = workflow.indexOf(
      "staging-custom-environment-migration.mjs plan",
    );
    const patch = workflow.indexOf("--request PATCH");

    expect(compatibility).toBeGreaterThan(-1);
    expect(plan).toBeGreaterThan(compatibility);
    expect(patch).toBeGreaterThan(plan);
  });

  test("binds exact canonical custom environment identity", () => {
    expect(workflow).toContain("EXPECTED_VERCEL_CUSTOM_ENV_ID: env_uX6Qp8F6w9aBgx2ikH3BiREB8aHH");
    expect(workflow).toContain("EXPECTED_VERCEL_CUSTOM_ENV_SLUG: staging");
    expect(workflow).toContain("staging-vercel-custom-environment.mjs");
  });

  test("scope mutations omit values and final identity is the only value update", () => {
    const commands = runScripts(workflow).join("\n");
    expect(commands).toContain("'{target:[], customEnvironmentIds:[$custom_env]}'");
    expect(commands).toContain("database-identity-v2.json");
    expect(commands.match(/--rawfile value/g)).toHaveLength(1);
    expect(commands).not.toContain('value:"$DATABASE_URL"');
    expect(commands).not.toContain('value:"$DIRECT_URL"');
  });

  test("records partial mutation and never rolls back or deletes", () => {
    expect(workflow).toContain("Report partial scope mutation without rollback");
    expect(workflow).toContain("SAFE STOP after partial scope mutation");
    const commands = runScripts(workflow).join("\n").toLowerCase();
    expect(commands).not.toContain("--request delete");
    expect(commands).not.toContain("prisma migrate reset");
  });

  test("separates workflow-control SHA from the future application SHA", () => {
    expect(workflow).toContain(
      "INTENDED_APPLICATION_SHA: 4a5b29b83cb3f18137b0151ae6242b2ac484ef08",
    );
    expect(workflow).toContain(
      "description: \"Exact 40-character master workflow-control SHA\"",
    );
  });
});
