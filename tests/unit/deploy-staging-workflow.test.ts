import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";

import { validatePrismaMigrationStatus } from "@/scripts/validate-prisma-migration-status.mjs";

const workflow = fs.readFileSync(
  path.join(process.cwd(), ".github", "workflows", "deploy-staging.yml"),
  "utf8",
);
const customEnvironmentValidator = fs.readFileSync(
  path.join(process.cwd(), "scripts", "staging-vercel-custom-environment.mjs"),
  "utf8",
);
const deploymentResultValidator = fs.readFileSync(
  path.join(process.cwd(), "scripts", "validate-staging-deployment-result.mjs"),
  "utf8",
);
const managedAliasValidator = fs.readFileSync(
  path.join(process.cwd(), "scripts", "validate-staging-managed-alias.mjs"),
  "utf8",
);
const protectedRouteValidator = fs.readFileSync(
  path.join(
    process.cwd(),
    "scripts",
    "validate-staging-protected-route-smoke.mjs",
  ),
  "utf8",
);
const migrationStatusValidator = fs.readFileSync(
  path.join(process.cwd(), "scripts", "validate-prisma-migration-status.mjs"),
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
    expect(commands).not.toContain("--environment preview");
    expect(commands).not.toContain("--target=preview");
    expect(commands).not.toContain("--target preview");
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
    expect(commands).not.toContain("--skip-domain");
    expect(commands).toContain(
      '"$VERCEL_ORG_ID" != "$EXPECTED_VERCEL_ORG_ID"',
    );
  });

  test("injects and verifies the shell-safe application SHA", () => {
    expect(commands).toContain('--build-env "RESPONSEOS_BUILD_SHA=$APPLICATION_SHA"');
    expect(commands).toContain('--env "RESPONSEOS_BUILD_SHA=$APPLICATION_SHA"');
    expect(commands).toContain(
      '--meta "responseosApplicationSha=$APPLICATION_SHA"',
    );
    expect(commands).toContain('"$actual_sha" != "$APPLICATION_SHA"');
  });

  test("preserves zero-domain posture and independent managed-alias certification", () => {
    expect(commands).toContain("staging-vercel-custom-environment.mjs");
    expect(customEnvironmentValidator).toContain(
      "environment.domains.length !== 0",
    );
    expect(customEnvironmentValidator).toContain(
      "managedEnvironmentAlias",
    );
    expect(customEnvironmentValidator).toContain(
      "classifyStagingCustomEnvironmentAliasTelemetry",
    );
    expect(customEnvironmentValidator).not.toContain(
      "must contain the canonical managed environment alias after READY",
    );
    const aliasBinding = commands.indexOf(
      "validate-staging-managed-alias.mjs poll",
    );
    const postReadyEnvironmentReadback = commands.indexOf(
      "vercel-custom-environment-post-ready.json",
    );
    expect(postReadyEnvironmentReadback).toBeGreaterThan(aliasBinding);
    expect(commands).toContain(
      'staging-vercel-custom-environment.mjs "$RUNNER_TEMP/vercel-custom-environment-post-ready.json" post-ready',
    );
    expect(commands).toContain("validate-staging-deployment-result.mjs ready");
    for (const aliasEvidence of [
      "metadata?.alias",
      "metadata?.automaticAliases",
      "metadata?.userAliases",
      "metadata?.aliasAssigned === true",
    ]) {
      expect(deploymentResultValidator).toContain(aliasEvidence);
    }
  });

  test("binds the managed alias to the exact READY deployment before smoke", () => {
    const readyValidation = commands.indexOf(
      "validate-staging-deployment-result.mjs ready",
    );
    const aliasLookup = commands.indexOf(
      "/v4/aliases/$EXPECTED_VERCEL_MANAGED_ALIAS",
    );
    const aliasBinding = workflow.indexOf(
      "Bind managed alias to exact READY deployment",
    );
    const finalEnvironment = workflow.indexOf(
      "Reverify final custom-environment routing",
    );
    const smoke = workflow.indexOf("Verify protected health and hosted smoke");

    expect(workflow).toContain(
      "EXPECTED_VERCEL_MANAGED_ALIAS: responseos-staging-mock-env-staging-audiojones.vercel.app",
    );
    expect(aliasLookup).toBeGreaterThan(readyValidation);
    expect(commands).toContain(
      '/v4/aliases/$EXPECTED_VERCEL_MANAGED_ALIAS?teamId=$VERCEL_ORG_ID&projectId=$EXPECTED_VERCEL_PROJECT_ID',
    );
    expect(commands).toContain(
      'jq -er \'.id | select(type == "string" and test("^dpl_[A-Za-z0-9]+$"))\'',
    );
    expect(workflow).toContain(
      "DEPLOYMENT_ID: ${{ steps.ready.outputs.deployment_id }}",
    );
    expect(commands).toContain(
      'validate-staging-managed-alias.mjs poll "$RUNNER_TEMP/vercel-managed-alias.json" "$DEPLOYMENT_ID" "$DEPLOYMENT_HOST"',
    );
    expect(managedAliasValidator).toContain(
      "metadata.deploymentId !== expectedDeploymentId",
    );
    expect(deploymentResultValidator).toContain(
      'metadata?.target === "production"',
    );
    expect(finalEnvironment).toBeGreaterThan(aliasBinding);
    expect(smoke).toBeGreaterThan(finalEnvironment);
  });

  test("uses a bounded read-only alias propagation loop", () => {
    const aliasLookup = commands.indexOf(
      "/v4/aliases/$EXPECTED_VERCEL_MANAGED_ALIAS",
    );
    const aliasStep = commands.slice(
      commands.lastIndexOf("for attempt in $(seq 1 60)", aliasLookup),
      commands.indexOf("vercel-custom-environment-post-ready.json"),
    );
    expect(aliasStep).toContain("for attempt in $(seq 1 60)");
    expect(aliasStep).toContain('200)');
    expect(aliasStep).toContain('404)');
    expect(aliasStep).toContain('alias_status');
    expect(aliasStep).toContain('Timed out waiting for the canonical managed alias');
    expect(aliasStep).not.toContain("--request");
    expect(aliasStep).not.toContain("--data");
  });

  test("supplements REST routing identity with managed-alias health smoke", () => {
    const smoke = commands.slice(
      commands.indexOf("alias_health="),
      commands.indexOf("for path in /admin"),
    );
    expect(workflow).toContain(
      "MANAGED_ALIAS_URL: https://responseos-staging-mock-env-staging-audiojones.vercel.app",
    );
    expect(smoke).toContain('"$MANAGED_ALIAS_URL/api/health"');
    expect(smoke).toContain('"$alias_sha" != "$APPLICATION_SHA"');
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

  test("orders migration, readiness, routing identity, final posture, and smoke", () => {
    const migrate = workflow.indexOf("Migrate canonical staging database");
    const deploy = workflow.indexOf("Deploy exact source to governed custom environment");
    const ready = workflow.indexOf("Wait for exact governed deployment to become READY");
    const aliasBinding = workflow.indexOf("Bind managed alias to exact READY deployment");
    const finalEnvironment = workflow.indexOf("Reverify final custom-environment routing");
    const smoke = workflow.indexOf("Verify protected health and hosted smoke");
    expect(migrate).toBeGreaterThan(-1);
    expect(deploy).toBeGreaterThan(migrate);
    expect(ready).toBeGreaterThan(deploy);
    expect(aliasBinding).toBeGreaterThan(ready);
    expect(finalEnvironment).toBeGreaterThan(aliasBinding);
    expect(smoke).toBeGreaterThan(finalEnvironment);
  });

  test("permits only the expected pending-migration status before migrate deploy", () => {
    expect(commands).toContain("npx prisma migrate status");
    expect(commands).toContain("validate-prisma-migration-status.mjs");
    expect(migrationStatusValidator).toContain("have not yet been applied");
    expect(migrationStatusValidator).toContain("!/failed/i.test(output)");
    expect(migrationStatusValidator).toContain(
      "migrate deploy remains the only authorized mutation",
    );
  });

  test("accepts an already-current migration status for a no-op retry", () => {
    expect(
      validatePrismaMigrationStatus(0, "Database schema is up to date!"),
    ).toEqual({ status: "current", errors: [] });
  });

  test("fails closed on an unsafe migration status", () => {
    expect(
      validatePrismaMigrationStatus(1, "The following migration has failed"),
    ).toEqual({
      status: "unsafe",
      errors: [
        "Prisma migration status preflight failed or reported an unsafe state.",
      ],
    });
  });

  test("contains no Production, alias, promotion, seed, or rollback command", () => {
    const lower = commands.toLowerCase();
    for (const prohibited of [
      "--prod",
      "--target=production",
      "--target production",
      '--target="production"',
      "--target='production'",
      "vercel alias",
      "vercel promote",
      "vercel domains",
      "vercel remove",
      "vercel rm",
      "vercel project remove",
      "--method delete",
      "prisma db seed",
      "prisma migrate reset",
      "prisma migrate rollback",
    ]) {
      expect(lower).not.toContain(prohibited);
    }
    expect(workflow).toContain("SAFE STOP after staging migration");
  });

  test("uses the shared browser-document auth smoke without accepting 404", () => {
    const smoke = commands.slice(
      commands.indexOf("validate-staging-protected-route-smoke.mjs"),
    );
    expect(smoke).toContain(
      'validate-staging-protected-route-smoke.mjs "$DEPLOYMENT_URL" "$RUNNER_TEMP/vercel-custom-readable.json"',
    );
    expect(protectedRouteValidator).toContain('"sec-fetch-dest": "document"');
    expect(protectedRouteValidator).toContain('redirect: "manual"');
    expect(protectedRouteValidator).toContain('"/admin"');
    expect(protectedRouteValidator).toContain('"/client/dashboard"');
    expect(protectedRouteValidator).toContain("EXPECTED_REDIRECT_STATUS = 307");
    expect(protectedRouteValidator).not.toContain("EXPECTED_REDIRECT_STATUS = 404");
  });
});
