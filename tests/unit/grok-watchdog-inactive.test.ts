import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

function run(mode: string | undefined, enabled = "true", loop = false) {
  const env = {
    NODE_ENV: "test" as const,
    PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
    RESPONSEOS_GROK_WATCHDOG_MODE: mode, RESPONSEOS_GROK_WATCHDOG_ENABLED: enabled,
    DATABASE_URL: "postgresql://synthetic@127.0.0.1:1/never",
  };
  return spawnSync(process.execPath, [
    "--import", "tsx", "--import", "./tests/fixtures/watchdog-zero-actions.mjs",
    "scripts/grok-watchdog.ts", ...(loop ? ["--loop"] : []),
  ], { env, encoding: "utf8", timeout: 10000 });
}

test.each([undefined, "inactive"])("inactive mode %s exits without business imports or network actions", mode => {
  for (const loop of [false, true]) {
    const result = run(mode, "true", loop);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("inactive; no monitoring or disconnection evidence");
    expect(result.stderr).toContain('ZERO_ACTIONS={"businessImports":0,"networkActions":0}');
  }
});

test.each(["", "ACTIVE", "unknown", "false"])("unknown mode %s fails closed before loading services", mode => {
  const result = run(mode);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('ZERO_ACTIONS={"businessImports":0,"networkActions":0}');
});

test.each(["false", "", "TRUE"])("active mode still needs exact enabled flag: %s", enabled => {
  const result = run("active", enabled);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('ZERO_ACTIONS={"businessImports":0,"networkActions":0}');
});

test("positive control proves the subprocess import tripwire catches active services", () => {
  const result = run("active");
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('ZERO_ACTIONS={"businessImports":1,"networkActions":0}');
});
