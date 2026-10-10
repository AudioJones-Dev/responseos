import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "vitest";
import { runtimePrincipalQuery } from "../../scripts/database-principal-query.mjs";

test("explicit Prisma reset recovers a committed tenant after backend loss", async () => {
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
    await expect(client.account.findUnique({where:{id}})).rejects.toThrow();
    await client.$disconnect();
    expect((await client.account.findUnique({where:{id}}))?.id).toBe(id);
    expect(await controller.account.count({where:{id}})).toBe(1);
  } finally {
    await controller.account.deleteMany({where:{id}});
    await client.$disconnect();
    await controller.$disconnect();
  }
});


test("readiness detects inherited owner and privileged group membership", async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.endsWith("_test")) throw new Error("synthetic_local_test_database_required");
  const client = new PrismaClient();
  const suffix = randomUUID().replaceAll("-", "");
  const owner = `synthetic_owner_${suffix}`;
  const member = `synthetic_member_${suffix}`;
  const table = `synthetic_owned_${suffix}`;
  try {
    await client.$executeRawUnsafe(`CREATE ROLE ${owner} NOLOGIN`);
    await client.$executeRawUnsafe(`CREATE ROLE ${member} NOLOGIN`);
    await client.$executeRawUnsafe(`GRANT ${owner} TO ${member}`);
    await client.$executeRawUnsafe(`CREATE TABLE public.${table} (id integer)`);
    await client.$executeRawUnsafe(`ALTER TABLE public.${table} OWNER TO ${owner}`);
    await client.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${member}`);
      const [row] = await tx.$queryRawUnsafe<{owns_tables:boolean,elevated:boolean}[]>(runtimePrincipalQuery);
      expect(row.owns_tables).toBe(true);
      expect(row.elevated).toBe(false);
    });
    await client.$executeRawUnsafe(`ALTER ROLE ${owner} CREATEDB`);
    await client.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${member}`);
      const [row] = await tx.$queryRawUnsafe<{elevated:boolean}[]>(runtimePrincipalQuery);
      expect(row.elevated).toBe(true);
    });
  } finally {
    await client.$executeRawUnsafe(`DROP TABLE IF EXISTS public.${table}`);
    await client.$executeRawUnsafe(`DROP ROLE IF EXISTS ${member}`);
    await client.$executeRawUnsafe(`DROP ROLE IF EXISTS ${owner}`);
    await client.$disconnect();
  }
});
