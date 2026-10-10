import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "vitest";
import { createRecoveringClient, isConnectionLoss } from "../../lib/db/recoveringClient";
import { runtimePrincipalQuery } from "../../scripts/database-principal-query.mjs";

async function expectConnectionLoss(operation: PromiseLike<unknown>) {
  const error = await Promise.resolve(operation).then(() => null, (failure: unknown) => failure);
  expect(isConnectionLoss(error)).toBe(true);
}

test("application client recovers after backend loss without replaying the failed query", async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.endsWith("_test")) throw new Error("synthetic_local_test_database_required");
  url.searchParams.set("connection_limit", "1");
  const client = createRecoveringClient({ datasources: { db: { url: url.toString() } } });
  const controller = new PrismaClient();
  const id = `reconnect_${randomUUID()}`;
  try {
    await client.account.create({data:{id,slug:id,name:"Synthetic reconnect",industry:"test",timezone:"UTC"}});
    const [backend] = await client.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`;
    const [terminated] = await controller.$queryRaw<{terminated:boolean}[]>`SELECT pg_terminate_backend(${backend.pid}::integer) AS terminated`;
    expect(terminated.terminated).toBe(true);
    await expect(client.account.findUnique({where:{id}})).rejects.toThrow();
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


test("failed writes are not replayed and a later write succeeds once", async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.endsWith("_test")) throw new Error("synthetic_local_test_database_required");
  url.searchParams.set("connection_limit", "1");
  const client = createRecoveringClient({datasources:{db:{url:url.toString()}}});
  const controller = new PrismaClient();
  const id = `no_replay_${randomUUID()}`;
  const data = {id,slug:id,name:"Synthetic no replay",industry:"test",timezone:"UTC"};
  try {
    const [backend] = await client.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`;
    await controller.$queryRaw`SELECT pg_terminate_backend(${backend.pid}::integer)`;
    await expectConnectionLoss(client.account.create({data}));
    expect(await controller.account.count({where:{id}})).toBe(0);
    await client.account.create({data});
    await expect(client.account.create({data})).rejects.toMatchObject({code:"P2002"});
    expect(await client.account.count({where:{id}})).toBe(1);
  } finally {
    await controller.account.deleteMany({where:{id}});
    await client.$disconnect();
    await controller.$disconnect();
  }
});

test("connection loss aborts an interactive transaction before the pool recovers", async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.endsWith("_test")) throw new Error("synthetic_local_test_database_required");
  url.searchParams.set("connection_limit", "1");
  const client = createRecoveringClient({datasources:{db:{url:url.toString()}}});
  const controller = new PrismaClient();
  const id = `rollback_${randomUUID()}`;
  try {
    await expectConnectionLoss(client.$transaction(async tx => {
      await tx.account.create({data:{id,slug:id,name:"Synthetic rollback",industry:"test",timezone:"UTC"}});
      const [backend] = await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`;
      await controller.$queryRaw`SELECT pg_terminate_backend(${backend.pid}::integer)`;
      await tx.account.count();
    }));
    expect(await client.account.count({where:{id}})).toBe(0);
    expect(await client.$transaction([client.account.count({where:{id}})])).toEqual([0]);
    const [backend] = await client.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`;
    await controller.$queryRaw`SELECT pg_terminate_backend(${backend.pid}::integer)`;
    await expectConnectionLoss(client.$transaction([client.account.count(),client.account.count()]));
    expect(await client.account.count({where:{id}})).toBe(0);
  } finally {
    await controller.account.deleteMany({where:{id}});
    await client.$disconnect();
    await controller.$disconnect();
  }
});

test("concurrent failures drain before one recovered pool serves later queries", async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.endsWith("_test")) throw new Error("synthetic_local_test_database_required");
  url.searchParams.set("connection_limit", "1");
  const client = createRecoveringClient({datasources:{db:{url:url.toString()}}});
  const controller = new PrismaClient();
  try {
    const [backend] = await client.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`;
    await controller.$queryRaw`SELECT pg_terminate_backend(${backend.pid}::integer)`;
    const results = await Promise.allSettled([client.account.count(),client.account.count(),client.account.count()]);
    expect(results.every(r=>r.status === "rejected")).toBe(true);
    const counts = await Promise.all([client.account.count(),client.account.count()]);
    expect(counts[0]).toBe(counts[1]);
  } finally {
    await client.$disconnect();
    await controller.$disconnect();
  }
});


test("pool recovery waits for a concurrent healthy transaction to commit", async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.endsWith("_test")) throw new Error("synthetic_local_test_database_required");
  url.searchParams.set("connection_limit", "2");
  const client = createRecoveringClient({datasources:{db:{url:url.toString()}}});
  const controller = new PrismaClient();
  const id = `drain_${randomUUID()}`;
  let release!: () => void;
  let entered!: () => void;
  const hold = new Promise<void>(resolve=>{release=resolve;});
  const ready = new Promise<void>(resolve=>{entered=resolve;});
  const transaction = client.$transaction(async tx=>{
    await tx.account.create({data:{id,slug:id,name:"Synthetic drain",industry:"test",timezone:"UTC"}});
    entered();
    await hold;
  });
  try {
    await ready;
    const [backend] = await client.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`;
    await controller.$queryRaw`SELECT pg_terminate_backend(${backend.pid}::integer)`;
    const lost = await client.$queryRaw`SELECT 1`.then(()=>null,(error:unknown)=>error);
    expect(isConnectionLoss(lost)).toBe(true);
    const later = Promise.resolve(client.account.count({where:{id}}));
    release();
    await transaction;
    expect(await later).toBe(1);
    expect(await client.account.count({where:{id}})).toBe(1);
  } finally {
    release();
    await transaction.catch(()=>{});
    await controller.account.deleteMany({where:{id}});
    await client.$disconnect();
    await controller.$disconnect();
  }
});
