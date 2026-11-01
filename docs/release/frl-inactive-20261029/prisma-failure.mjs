import { cpSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

if (process.version !== "v24.18.0") throw new Error("Pinned Node required");
const url = "postgresql://synthetic@127.0.0.1:5432/synthetic_prisma_failure";
const db = new PrismaClient({ datasources: { db: { url } } });
const scratch = mkdtempSync(join(tmpdir(), "frl-prisma-"));
mkdirSync(join(scratch, "migrations"));
cpSync("prisma/schema.prisma", join(scratch, "schema.prisma"));
cpSync("prisma/migrations/migration_lock.toml", join(scratch, "migrations/migration_lock.toml"));
const dirs = readdirSync("prisma/migrations").filter((name) => /^\d/.test(name)).sort();
function deploy(success) {
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", join(scratch, "schema.prisma")], {
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, encoding: "utf8",
  });
  console.log(result.stdout, result.stderr);
  if ((result.status === 0) !== success) throw new Error("Unexpected deploy result");
  return result.stdout + result.stderr;
}
try {
  for (const name of dirs.slice(0, 10)) cpSync(join("prisma/migrations", name), join(scratch, "migrations", name), { recursive: true });
  deploy(true);
  await db.$executeRawUnsafe(`INSERT INTO "WebhookEvent" (id,provider,provider_event_id,event_type,raw_body,signature_valid,dedupe_hash) VALUES ('synthetic-a','manual','same','synthetic','fictional-a',false,'a'),('synthetic-b','manual','same','synthetic','fictional-b',false,'b')`);
  for (const name of dirs.slice(10)) cpSync(join("prisma/migrations", name), join(scratch, "migrations", name), { recursive: true });
  if (!deploy(false).includes("P3018")) throw new Error("Expected migration failure");
  if (!deploy(false).includes("P3009")) throw new Error("Failed history must block retry");
  const evidence = await db.$queryRawUnsafe(`SELECT migration_name,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY started_at`);
  console.log(JSON.stringify(evidence));
  console.log(JSON.stringify(await db.$queryRawUnsafe(`SELECT indexname FROM pg_indexes WHERE indexname IN ('Call_account_id_provider_provider_call_id_key','WebhookEvent_provider_provider_event_id_key')`)));
  if (await db.webhookEvent.count() !== 2) throw new Error("Duplicate evidence lost");
  console.log("PASS: real pinned Prisma deploy fails on duplicate webhook identity, retry blocked, both synthetic events preserved. No resolve or evidence deletion attempted.");
} finally { await db.$disconnect(); }
