// TEMPORARY repro harness — removed before merge.
// Repeats the interactive-transaction and batch-transaction termination
// scenarios and tallies every error form the client surfaces.
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createRecoveringClient, isConnectionLoss } from "../../lib/db/recoveringClient";

function describeError(error: unknown) {
  if (error === null) return "RESOLVED (no error)";
  if (!(error instanceof Error)) return `non-error rejection: ${JSON.stringify(error)}`;
  const { code, meta } = error as { code?: unknown; meta?: unknown };
  return `${error.constructor.name} code=${String(code)} meta=${JSON.stringify(meta)} message=${JSON.stringify(error.message)}`;
}

const iterations = Number(process.argv[2] ?? 200);
const url = new URL(process.env.DATABASE_URL ?? "");
url.searchParams.set("connection_limit", "1");
const tally = new Map<string, number>();
const record = (scenario: string, error: unknown) => {
  const key = `[${scenario}] isConnectionLoss=${error !== null && isConnectionLoss(error)} :: ${describeError(error)}`;
  tally.set(key, (tally.get(key) ?? 0) + 1);
};

const controller = new PrismaClient();
for (let i = 0; i < iterations; i++) {
  const client = createRecoveringClient({ datasources: { db: { url: url.toString() } } });
  const id = `repro_${randomUUID()}`;
  try {
    const interactive = await Promise.resolve(client.$transaction(async tx => {
      await tx.account.create({ data: { id, slug: id, name: "Synthetic repro", industry: "test", timezone: "UTC" } });
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      await controller.$queryRaw`SELECT pg_terminate_backend(${backend.pid}::integer)`;
      await tx.account.count();
    })).then(() => null, (e: unknown) => e);
    record("interactive", interactive);
    if ((await controller.account.count({ where: { id } })) !== 0) record("interactive", new Error("ROLLBACK VIOLATED"));
    const [backend] = await client.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
    await controller.$queryRaw`SELECT pg_terminate_backend(${backend.pid}::integer)`;
    const batch = await Promise.resolve(client.$transaction([client.account.count(), client.account.count()])).then(() => null, (e: unknown) => e);
    record("batch", batch);
  } finally {
    await controller.account.deleteMany({ where: { id } });
    await client.$disconnect();
  }
}
await controller.$disconnect();

const server = await new PrismaClient().$queryRaw<{ v: string }[]>`SHOW server_version`;
console.log(`server_version=${server[0].v} iterations=${iterations}`);
for (const [key, count] of [...tally].sort((a, b) => b[1] - a[1])) console.log(`${String(count).padStart(5)}  ${key}`);
