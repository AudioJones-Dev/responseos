import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";
import { runWorkerBatch } from "@/lib/routing/worker";
import { SimulatedRoutingProvider } from "@/lib/routing/simulatedProvider";

async function main() {
  const accountId = process.env.RESPONSEOS_ROUTING_ACCOUNT_ID;
  const environment = process.env.RESPONSEOS_ROUTING_ENVIRONMENT;
  const concurrency = Number(process.env.RESPONSEOS_ROUTING_CONCURRENCY ?? 2);
  if (process.env.RESPONSEOS_ROUTING_WORKER_ENABLED !== "true" || !accountId || !/^[a-zA-Z0-9_-]{1,100}$/.test(accountId) || !["test", "preview"].includes(environment ?? "") || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4 || !process.env.DATABASE_URL) throw new Error("worker_configuration_invalid");
  const db = new PrismaClient();
  const provider = new SimulatedRoutingProvider();
  let stopping = false, ready = false, lastProgress = Date.now(), lastAttention = "";
  const server = createServer((request, response) => {
    if (!["/health", "/ready"].includes(request.url ?? "")) { response.writeHead(404); response.end(); return; }
    const healthy = !stopping && (request.url === "/health" || ready && Date.now() - lastProgress < 30000);
    response.writeHead(healthy ? 200 : 503, {"Content-Type": "application/json", "Cache-Control": "no-store"});
    response.end(JSON.stringify({status: healthy ? "ok" : "unavailable", mode: "simulated"}));
  });
  server.listen(Number(process.env.PORT ?? 8091), process.env.RESPONSEOS_WORKER_BIND_HOST ?? "127.0.0.1");
  for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => { stopping = true; ready = false; });
  try {
    while (!stopping) {
      try {
        await db.$queryRaw`SELECT id FROM "HostedRoutingDelivery" LIMIT 0`;
        const accounts = await db.$queryRaw<{id: string}[]>`SELECT id FROM "Account" WHERE id = ${accountId}`;
        if (accounts.length !== 1) throw new Error("worker_tenant_missing");
        ready = true;
        const states = await runWorkerBatch(db, accountId, environment as "test" | "preview", provider, concurrency);
        const counts = await db.$queryRaw<{status: string; count: bigint}[]>`SELECT status, COUNT(*) AS count FROM "HostedRoutingDelivery" WHERE account_id = ${accountId} AND status IN ('uncertain', 'rejected') GROUP BY status`;
        const attention = counts.filter(row => row.count > 0).map(row => `${row.status}:${row.count}`).sort().join(",");
        if (attention !== lastAttention) {
          for (const row of counts) if (row.count > 0) console.error(JSON.stringify({event: "routing_operator_attention", status: row.status, count: String(row.count)}));
          lastAttention = attention;
        }
        console.log(JSON.stringify({event: "routing_batch", mode: "simulated", states})); lastProgress = Date.now();
      } catch { ready = false; console.error(JSON.stringify({event: "routing_worker_unavailable"})); }
      if (!stopping) await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.$disconnect(); }
}
main().catch(() => { console.error(JSON.stringify({event: "routing_worker_start_refused"})); process.exitCode = 1; });
