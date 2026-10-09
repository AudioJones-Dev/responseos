import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";
import { runWorkerBatch } from "@/lib/routing/worker";
import { SimulatedRoutingProvider } from "@/lib/routing/simulatedProvider";
import { routingRuntimeConfig } from "@/lib/routing/runtimeConfig";
import { queueStalledRoutingNotices } from "@/lib/routing/ledger";

async function main() {
  const {accountId, environment, concurrency, pollMs, companyBindings} = routingRuntimeConfig(process.env);
  const db = new PrismaClient();
  const provider = new SimulatedRoutingProvider();
  let stopping = false, ready = false, lastProgress = Date.now(), lastAttention = "", lastHeartbeat = 0;
  const server = createServer((request, response) => {
    if (!["/health", "/ready"].includes(request.url ?? "")) { response.writeHead(404); response.end(); return; }
    const healthy = !stopping && (request.url === "/health" || ready && Date.now() - lastProgress < pollMs + 30000);
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
        const states = await runWorkerBatch(db, accountId, environment, provider, concurrency, companyBindings);
        await queueStalledRoutingNotices(db, accountId, environment);
        const counts = await db.$queryRaw<{status: string; count: bigint}[]>`SELECT CASE WHEN d.status = 'queued' THEN 'stalled' ELSE d.status END AS status, COUNT(*) AS count FROM "HostedRoutingDelivery" d JOIN "FrlWebIntake" i ON i.id = d.intake_id AND i.account_id = d.account_id WHERE d.account_id = ${accountId} AND i.environment = ${environment} AND (d.status IN ('uncertain', 'rejected') OR (d.status = 'queued' AND d.created_at < NOW() - INTERVAL '5 minutes' AND d.next_attempt_at <= NOW())) GROUP BY 1 ORDER BY 1`;
        const attention = JSON.stringify(counts.map(row => ({status: row.status, count: String(row.count)})));
        if (attention !== lastAttention) { console.error(JSON.stringify({event: "routing_operator_attention", counts: JSON.parse(attention)})); lastAttention = attention; }
        if (states.some(state => state !== "idle")) console.log(JSON.stringify({event: "routing_batch", mode: "simulated", states})); lastProgress = Date.now();
        if (Date.now() - lastHeartbeat >= 30000) {console.log(JSON.stringify({event: "routing_worker_heartbeat", ready, mode: "simulated"})); lastHeartbeat = Date.now();}
      } catch { ready = false; console.error(JSON.stringify({event: "routing_worker_unavailable"})); }
      if (!stopping) await new Promise(resolve => setTimeout(resolve, pollMs));
    }
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.$disconnect(); }
}
main().catch(() => { console.error(JSON.stringify({event: "routing_worker_start_refused"})); process.exitCode = 1; });
