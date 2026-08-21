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

  test("uses REST-only Preview configuration retrieval without Vercel CLI identity", () => {
    const commands = runScripts(workflow).join("\n").toLowerCase();

    expect(commands).not.toContain("vercel link");
    expect(commands).not.toContain("vercel env pull");
    expect(commands).not.toContain("npm install -g vercel");
    expect(commands).toContain(
      "https://api.vercel.com/v10/projects/$expected_vercel_project_name/env",
    );
    expect(commands).toContain("fetch-staging-vercel-readable-env.mjs");
  });

  test("validates readable project posture before database synchronization", () => {
    const posture = workflow.indexOf(
      "Validate readable Preview posture before database synchronization",
    );
    const synchronize = workflow.indexOf(
      "Synchronize verified database values to Vercel Preview",
    );

    expect(posture).toBeGreaterThan(-1);
    expect(synchronize).toBeGreaterThan(posture);
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
