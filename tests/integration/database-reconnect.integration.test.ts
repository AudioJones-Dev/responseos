import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "vitest";

test("Prisma reconnects after backend loss without losing a committed tenant", async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.endsWith("_test")) throw new Error("synthetic_local_test_database_required");
  url.searchParams.set("connection_limit", "1");
  const client = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const controller = new PrismaClient();
  const id = `reconnect_${randomUUID()}`;
  try {
    await client.account.create({data:{id,slug:id,name:"Synthetic reconnect",industry:"test",timezone:"UTC"}});
    const [backend] = await client.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`;
    const [terminated] = await controller.$queryRaw<{terminated:boolean}[]>`SELECT pg_terminate_backend(${backend.pid}::integer) AS terminated`;
    expect(terminated.terminated).toBe(true);
    let restored = false;
    for (let attempt=0;attempt<3;attempt++) {
      try {
        restored = (await client.account.findUnique({where:{id}}))?.id === id;
        if (restored) break;
      } catch {
        await client.$disconnect();
      }
    }
    expect(restored).toBe(true);
    expect(await controller.account.count({where:{id}})).toBe(1);
  } finally {
    await controller.account.deleteMany({where:{id}});
    await client.$disconnect();
    await controller.$disconnect();
  }
});
