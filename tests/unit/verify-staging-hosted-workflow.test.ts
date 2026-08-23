import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const workflow = fs.readFileSync(
  path.join(process.cwd(), ".github", "workflows", "verify-staging-hosted.yml"),
  "utf8",
);

function runScripts(yaml: string) {
  const lines = yaml.split(/\r?\n/);
  const scripts: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)(?:-\s+)?run:\s*(?:\|\s*)?$/);
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

const commands = runScripts(workflow).join("\n");

describe("Verify Hosted Staging workflow contract", () => {
  test("all Bash blocks pass syntax validation", () => {
    const result = spawnSync("bash", ["-n"], {
      input: runScripts(workflow).join("\n\n"),
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
  });

  test("is current-master-bound with exact application and deployment identities", () => {
    expect(workflow).toContain("confirm:");
    expect(workflow).toContain("control_sha:");
    expect(workflow).toContain("application_sha:");
    expect(workflow).toContain("deployment_id:");
    expect(commands).toContain('"$DISPATCH_REF" != "refs/heads/master"');
    expect(commands).toContain('"$CONTROL_SHA" != "$DISPATCHED_WORKFLOW_SHA"');
    expect(commands).toContain('[[ ! "$APPLICATION_SHA" =~ ^[0-9a-f]{40}$ ]]');
    expect(commands).toContain('[[ ! "$DEPLOYMENT_ID" =~ ^dpl_[A-Za-z0-9]+$ ]]');
    expect(commands).toContain("git ls-remote origin refs/heads/master");
    expect(commands).not.toContain("${{ inputs.");
  });

  test("uses read-only GitHub permissions and only the two hosted-check secrets", () => {
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).not.toContain("deployments: write");
    expect(workflow).toContain("VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}");
    expect(workflow).toContain(
      "VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}",
    );
    expect(workflow).not.toContain("NEON_API_KEY");
    expect(workflow).not.toContain("STAGING_DATABASE_URL");
    expect(workflow).not.toContain("STAGING_DIRECT_URL");
  });

  test("contains no deployment, database, routing, or domain mutation command", () => {
    const lower = commands.toLowerCase();
    for (const prohibited of [
      /\bvercel\s+deploy\b/,
      /\bprisma\s+migrate\b/,
      /\bprisma\s+db\s+seed\b/,
      /\bvercel\s+alias\b/,
      /\bvercel\s+promote\b/,
      /\bvercel\s+domains\b/,
      /\bvercel\s+remove\b/,
      /\bvercel\s+rm\b/,
      /--request\s+post\b/,
      /--request\s+patch\b/,
      /--request\s+put\b/,
      /--request\s+delete\b/,
    ]) {
      expect(lower).not.toMatch(prohibited);
    }
  });

  test("recertifies exact deployment, alias routing, and Custom Environment before smoke", () => {
    const deployment = workflow.indexOf("Certify exact existing deployment identity");
    const alias = workflow.indexOf("Reverify authoritative managed-alias routing");
    const customEnvironment = workflow.indexOf(
      "Reverify final custom-environment posture",
    );
    const smoke = workflow.indexOf(
      "Verify public runtime and anonymous browser auth boundary",
    );

    expect(commands).toContain(
      "/v13/deployments/$DEPLOYMENT_ID?teamId=$VERCEL_ORG_ID&withGitRepoInfo=true",
    );
    expect(commands).toContain(
      'validate-staging-deployment-result.mjs existing "$RUNNER_TEMP/vercel-deployment.json" "$DEPLOYMENT_ID" "$APPLICATION_SHA"',
    );
    expect(commands).toContain(
      'validate-staging-managed-alias.mjs poll "$RUNNER_TEMP/vercel-managed-alias.json" "$DEPLOYMENT_ID" "$DEPLOYMENT_HOST"',
    );
    expect(commands).toContain(
      'staging-vercel-custom-environment.mjs "$RUNNER_TEMP/vercel-custom-environment-final.json" post-ready',
    );
    expect(deployment).toBeGreaterThan(-1);
    expect(alias).toBeGreaterThan(deployment);
    expect(customEnvironment).toBeGreaterThan(alias);
    expect(smoke).toBeGreaterThan(customEnvironment);
  });

  test("rechecks immutable and managed-alias health plus both protected pages", () => {
    expect(commands).toContain('"$deployment_url/api/health"');
    expect(commands).toContain('"$MANAGED_ALIAS_URL/api/health"');
    expect(commands).toContain('"$actual_sha" != "$APPLICATION_SHA"');
    expect(commands).toContain('"$alias_sha" != "$APPLICATION_SHA"');
    expect(commands).toContain('"$deployment_url/demo"');
    expect(commands).toContain(
      'validate-staging-protected-route-smoke.mjs "$deployment_url" "$RUNNER_TEMP/vercel-custom-readable.json"',
    );
  });

  test("shares the exclusive staging lock without cancellation", () => {
    expect(workflow).toContain("group: responseos-staging-exclusive");
    expect(workflow).toContain("cancel-in-progress: false");
  });
});
