import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";

const workflow = fs.readFileSync(
  path.join(process.cwd(), ".github", "workflows", "deploy-staging.yml"),
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

describe("Deploy Staging workflow contract", () => {
  test("all Bash blocks pass syntax validation", () => {
    const result = spawnSync("bash", ["-n"], {
      input: runScripts(workflow).join("\n\n"),
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
  });

  test("requires separate control and application SHAs from current master", () => {
    expect(workflow).toContain("control_sha:");
    expect(workflow).toContain("application_sha:");
    expect(commands).toContain('"$DISPATCH_REF" != "refs/heads/master"');
    expect(commands).toContain('"$CONTROL_SHA" != "$DISPATCHED_WORKFLOW_SHA"');
    expect(commands).toContain("git ls-remote origin refs/heads/master");
    expect(commands).toContain("git rev-parse HEAD");
  });

  test("keeps all dispatch inputs out of Bash source", () => {
    expect(commands).not.toContain("${{ inputs.");
    expect(commands).toContain('[[ ! "$CONTROL_SHA" =~ ^[0-9a-f]{40}$ ]]');
    expect(commands).toContain('[[ ! "$APPLICATION_SHA" =~ ^[0-9a-f]{40}$ ]]');
  });

  test.each([
    "bad; touch __SENTINEL__",
    "bad && touch __SENTINEL__",
    "bad || touch __SENTINEL__",
    "$(touch __SENTINEL__)",
    "`touch __SENTINEL__`",
    'bad"; touch __SENTINEL__; echo "',
    "bad\ntouch __SENTINEL__",
  ])("treats application SHA payload as inert data: %s", (payloadTemplate) => {
    const sentinelName = `responseos-injection-${randomUUID()}`;
    const sentinel = path.join(os.tmpdir(), sentinelName);
    const payload = payloadTemplate.replace("__SENTINEL__", sentinelName);
    const controlSha = "a".repeat(40);
    const guardScript = runScripts(workflow)[0];
    const result = spawnSync("bash", ["-c", guardScript], {
      cwd: os.tmpdir(),
      encoding: "utf8",
      env: {
        ...process.env,
        DISPATCH_CONFIRM: "staging",
        DISPATCH_REF: "refs/heads/master",
        CONTROL_SHA: controlSha,
        DISPATCHED_WORKFLOW_SHA: controlSha,
        APPLICATION_SHA: payload,
      },
    });
    expect(result.status).not.toBe(0);
    const created = fs.existsSync(sentinel);
    if (created) fs.rmSync(sentinel, { force: true });
    expect(created).toBe(false);
  });

  test("removes Vercel linkage and generic Preview paths", () => {
    expect(commands).not.toContain("vercel link");
    expect(commands).not.toContain("vercel pull");
    expect(commands).not.toContain("--environment=preview");
    expect(commands).not.toContain("--target=preview");
    expect(commands).not.toContain("--scope");
  });

  test("binds the deployment to the exact custom environment", () => {
    expect(workflow).toContain(
      "EXPECTED_VERCEL_CUSTOM_ENV_ID: env_uX6Qp8F6w9aBgx2ikH3BiREB8aHH",
    );
    expect(workflow).toContain("EXPECTED_VERCEL_CUSTOM_ENV_SLUG: staging");
    expect(commands).toContain(
      "/custom-environments/$EXPECTED_VERCEL_CUSTOM_ENV_ID",
    );
    expect(commands).toContain('--target "$EXPECTED_VERCEL_CUSTOM_ENV_SLUG"');
    expect(commands).toContain('--project "$EXPECTED_VERCEL_PROJECT_ID"');
    expect(commands).not.toContain("--team");
    expect(commands).toContain("--skip-domain");
    expect(commands).toContain(
      '"$VERCEL_ORG_ID" != "$EXPECTED_VERCEL_ORG_ID"',
    );
  });

  test("injects and verifies the shell-safe application SHA", () => {
    expect(commands).toContain('--build-env "RESPONSEOS_BUILD_SHA=$APPLICATION_SHA"');
    expect(commands).toContain('--env "RESPONSEOS_BUILD_SHA=$APPLICATION_SHA"');
    expect(commands).toContain('"$actual_sha" != "$APPLICATION_SHA"');
  });

  test("certifies project, environment, providers, Neon, and v2 attestation before migration", () => {
    const migration = workflow.indexOf("Migrate canonical staging database");
    for (const evidence of [
      "validate-staging-vercel-project.mjs",
      "staging-vercel-custom-environment.mjs",
      "fetch-staging-vercel-readable-env.mjs final custom-environment",
      "validate-staging-vercel-posture.mjs custom-environment",
      "validate-staging-database-source.mjs",
      "validate-staging-env.mjs",
      "Refresh certification immediately before migration",
    ]) {
      expect(workflow.indexOf(evidence)).toBeGreaterThan(-1);
      expect(workflow.indexOf(evidence)).toBeLessThan(migration);
    }
  });

  test("orders migration, exact custom deployment, readiness, and smoke", () => {
    const migrate = workflow.indexOf("Migrate canonical staging database");
    const deploy = workflow.indexOf("Deploy exact source to governed custom environment");
    const ready = workflow.indexOf("Wait for exact governed deployment to become READY");
    const smoke = workflow.indexOf("Verify protected health and hosted smoke");
    expect(migrate).toBeGreaterThan(-1);
    expect(deploy).toBeGreaterThan(migrate);
    expect(ready).toBeGreaterThan(deploy);
    expect(smoke).toBeGreaterThan(ready);
  });

  test("permits only the expected pending-migration status before migrate deploy", () => {
    expect(commands).toContain("npx prisma migrate status");
    expect(commands).toContain('grep -q "have not yet been applied"');
    expect(commands).toContain('grep -qi "failed"');
    expect(commands).toContain("migrate deploy remains the only authorized mutation");
  });

  test("contains no Production, alias, promotion, seed, or rollback command", () => {
    const lower = commands.toLowerCase();
    for (const prohibited of [
      "--prod",
      "--target=production",
      "--target production",
      "vercel alias",
      "vercel promote",
      "prisma db seed",
      "prisma migrate reset",
      "prisma migrate rollback",
    ]) {
      expect(lower).not.toContain(prohibited);
    }
    expect(workflow).toContain("SAFE STOP after staging migration");
  });

  test("does not accept 404 as protected-route authentication evidence", () => {
    const smoke = commands.slice(commands.indexOf("for path in /admin"));
    expect(smoke).not.toContain("404)");
    expect(smoke).toContain("401|403");
  });
});
