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

describe("configuration-only staging workflow", () => {
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

  test("separates workflow-control SHA from the future application SHA", () => {
    expect(workflow).toContain(
      "INTENDED_APPLICATION_SHA: 4a5b29b83cb3f18137b0151ae6242b2ac484ef08",
    );
    expect(workflow).toContain(
      "description: \"Exact 40-character master workflow-control SHA\"",
    );
  });
});
