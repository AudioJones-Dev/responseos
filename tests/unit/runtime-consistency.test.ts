import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, expect, test } from "vitest";

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { force: true, recursive: true });
  }
});

function createAlignedFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "responseos-runtime-"));
  fixtures.push(root);
  mkdirSync(path.join(root, ".github", "workflows"), { recursive: true });
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      packageManager: "npm@11.16.0",
      engines: { node: "24.18.0", npm: "11.16.0" },
      volta: { node: "24.18.0", npm: "11.16.0" },
    })
  );
  writeFileSync(path.join(root, ".nvmrc"), "24.18.0\n");
  writeFileSync(
    path.join(root, ".github", "workflows", "ci.yml"),
    "node-version: 24.18.0\nnode-version: 24.18.0\n"
  );
  writeFileSync(
    path.join(root, ".github", "workflows", "deploy-staging.yml"),
    "node-version: 24.18.0\n"
  );
  writeFileSync(
    path.join(root, ".github", "workflows", "dashboard.yml"),
    "node-version: 20\n"
  );
  return root;
}

test("accepts aligned repository and application-workflow runtime pins", () => {
  const root = createAlignedFixture();
  const result = spawnSync(
    process.execPath,
    [path.resolve("scripts/check-runtime.mjs"), "--root", root],
    { encoding: "utf8" }
  );

  expect(result.status).toBe(0);
  expect(result.stdout).toContain(
    "Runtime consistency check passed: Node 24.18.0 / npm 11.16.0"
  );
});

test("rejects a stale .nvmrc mirror", () => {
  const root = createAlignedFixture();
  writeFileSync(path.join(root, ".nvmrc"), "24.17.0\n");
  const result = spawnSync(
    process.execPath,
    [path.resolve("scripts/check-runtime.mjs"), "--root", root],
    { encoding: "utf8" }
  );

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(".nvmrc: expected 24.18.0, found 24.17.0");
});

test("rejects a required application workflow with no Node pin", () => {
  const root = createAlignedFixture();
  writeFileSync(
    path.join(root, ".github", "workflows", "deploy-staging.yml"),
    "name: Deploy Staging\n"
  );
  const result = spawnSync(
    process.execPath,
    [path.resolve("scripts/check-runtime.mjs"), "--root", root],
    { encoding: "utf8" }
  );

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    ".github/workflows/deploy-staging.yml: expected at least one node-version declaration"
  );
});

test("rejects a missing required application workflow", () => {
  const root = createAlignedFixture();
  rmSync(path.join(root, ".github", "workflows", "deploy-staging.yml"));
  const result = spawnSync(
    process.execPath,
    [path.resolve("scripts/check-runtime.mjs"), "--root", root],
    { encoding: "utf8" }
  );

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    ".github/workflows/deploy-staging.yml: required application workflow is missing"
  );
});
