import { spawn, spawnSync } from "node:child_process";
import { createServer, connect, type AddressInfo } from "node:net";
import { once } from "node:events";
import { expect, test } from "vitest";

const script = "scripts/grok-inactive-service.mjs";
const hook = "./tests/fixtures/watchdog-zero-actions.mjs";
const env = {
  PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test" as const,
  RESPONSEOS_GROK_WATCHDOG_MODE: "inactive", RESPONSEOS_GROK_WATCHDOG_ENABLED: "true",
  RESPONSEOS_QUALIFICATION_ACTIVATION: "ENABLED",
  DATABASE_URL: "postgresql://synthetic@127.0.0.1:1/never",
};

test.each([
  { mode: undefined, port: "3000" }, { mode: "active", port: "3000" },
  { mode: "unknown", port: "3000" }, { mode: "inactive", port: undefined },
  { mode: "inactive", port: "0" }, { mode: "inactive", port: "65536" },
  { mode: "inactive", port: "3000x" },
])("inactive lifecycle rejects invalid configuration %j without business actions", ({ mode, port }) => {
  const result = spawnSync(process.execPath, ["--import", hook, script], {
    env: { ...env, RESPONSEOS_GROK_WATCHDOG_MODE: mode, PORT: port }, encoding: "utf8", timeout: 5000,
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('ZERO_ACTIONS={"businessImports":0,"networkActions":0}');
});

test("inactive lifecycle stays healthy, drains SIGTERM/SIGINT and restarts without business actions", async () => {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
  const port = (reservation.address() as AddressInfo).port;
  await new Promise<void>(resolve => reservation.close(() => resolve()));
  for (const signal of ["SIGTERM", "SIGINT", "SIGTERM"] as const) {
    const child = spawn(process.execPath, ["--import", hook, script], {
      env: { ...env, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", data => { stdout += data; });
    child.stderr.on("data", data => { stderr += data; });
    const exited = once(child, "exit");
    let connection: ReturnType<typeof connect> | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(() => reject(Error("inactive service did not start")), 5000);
        child.stdout.on("data", () => { if (stdout.includes("Inactive service listening")) { clearTimeout(deadline); resolve(); } });
        child.once("error", reject);
      });
      for (let index = 0; index < 3; index++) {
        if (index > 0) await new Promise(resolve => setTimeout(resolve, 550));
        const health = await fetch(`http://127.0.0.1:${port}/healthz`);
        expect(health.status).toBe(200);
        expect(await health.json()).toEqual({ status: "inactive", monitoring: false, callsEnabled: false, disconnectionEvidence: false });
      }
      expect((await fetch(`http://127.0.0.1:${port}/readyz`)).status).toBe(404);
      expect((await fetch(`http://127.0.0.1:${port}/healthz`, { method: "POST" })).status).toBe(404);
      connection = connect(port, "127.0.0.1"); connection.on("error", () => {});
      await once(connection, "connect");
      connection.write("GET /healthz HTTP/1.1\r\nHost: local\r\n");
      child.kill(signal);
      const exit = await Promise.race([exited, new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(Error("inactive shutdown deadline exceeded")), 3000); timer.unref();
      })]);
      expect(exit).toEqual([0, null]);
      expect(stdout).toContain("Inactive service stopped; no monitoring was active.");
      expect(stderr).toContain('ZERO_ACTIONS={"businessImports":0,"networkActions":0}');
    } finally {
      connection?.destroy();
      if (child.exitCode === null) { child.kill("SIGKILL"); await exited; }
    }
  }
}, 15000);
