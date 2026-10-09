import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { afterAll, beforeEach, expect, test } from "vitest";
import { prisma, resetAndSeedTestDb, disconnectTestDb } from "./setup";
import { authority, payload, submissionId } from "../routingFixtures";
import { persistHostedIntake, deliveryStatus } from "@/lib/routing/ledger";

beforeEach(resetAndSeedTestDb);
afterAll(disconnectTestDb);
test("isolated worker process becomes ready, stops and restarts with durable simulated receipt", async () => {
  const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
  const port = (reservation.address() as {port: number}).port;
  await new Promise<void>(resolve => reservation.close(() => resolve()));
  const receipt = await persistHostedIntake(prisma, authority, submissionId, payload());
  let child: ChildProcess | undefined; let logs = "";
  const stop = async () => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit"); child.kill("SIGTERM");
    const [code] = await exited;
    // Windows terminates forcibly; Linux CI verifies the graceful signal path.
    if (process.platform !== "win32") expect(code).toBe(0);
  };
  try {
    for (let cycle = 0; cycle < 2; cycle++) {
      child = spawn(process.execPath, ["--import", "tsx", "scripts/routing-worker.ts"], {env: {...process.env, RESPONSEOS_ROUTING_WORKER_ENABLED: "true", RESPONSEOS_ROUTING_ACCOUNT_ID: authority.accountId, RESPONSEOS_ROUTING_ENVIRONMENT: "test", RESPONSEOS_ROUTING_CONCURRENCY: "2", RESPONSEOS_WORKER_BIND_HOST: "127.0.0.1", PORT: String(port)}, stdio: ["ignore", "pipe", "pipe"]});
      child.stdout?.on("data", chunk => {logs += String(chunk);}); child.stderr?.on("data", chunk => {logs += String(chunk);});
      let ready = false;
      for (let attempt = 0; attempt < 100 && !ready; attempt++) {
        if (child.exitCode !== null) throw new Error("worker_exited_before_ready");
        try {ready = (await fetch(`http://127.0.0.1:${port}/ready`)).ok;} catch { /* bounded startup wait */ }
        if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
      }
      expect(ready).toBe(true);
      expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(200);
      expect((await fetch(`http://127.0.0.1:${port}/unknown`)).status).toBe(404);
      let confirmed = false;
      for (let attempt = 0; attempt < 50 && !confirmed; attempt++) {
        confirmed = (await deliveryStatus(prisma, authority.accountId, receipt.reference))?.status === "confirmed";
        if (!confirmed) await new Promise(resolve => setTimeout(resolve, 100));
      }
      expect(confirmed).toBe(true); await stop();
    }
    expect((await persistHostedIntake(prisma, authority, submissionId, payload())).reference).toBe(receipt.reference);
    expect(await prisma.$queryRaw`SELECT id FROM "HostedRoutingDelivery"`).toHaveLength(1);
    expect(logs).not.toContain("synthetic@example.invalid");
    expect(logs).not.toContain("Synthetic only");
  } finally {await stop();}
}, 30000);
