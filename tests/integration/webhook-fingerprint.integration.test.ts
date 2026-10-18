import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { prisma, resetAndSeedTestDb, disconnectTestDb } from "./setup";
import { fingerprint, identityMatches, ingestSynthetic, syntheticKey, syntheticKeyId } from "./webhook-fingerprint.scaffold";
import { purgeExpiredWebhookPayloads } from "@/lib/data/webhookEvents";

const keys = generateKeyPairSync("ed25519");
const body = Buffer.from('{ "synthetic": true }\n');
const keyring = new Map([[syntheticKeyId, syntheticKey]]);
const ingest = (id: string, bytes = body) => ingestSynthetic(id, bytes, sign(null, bytes, keys.privateKey), keys.publicKey);
const base = (id: string) => ({ id, provider: "synthetic", provider_event_id: id, dedupe_hash: id, event_type: "synthetic", raw_body: "legacy" });
const tuple = { content_fingerprint: fingerprint(body, syntheticKey), fingerprint_version: 1, fingerprint_key_id: syntheticKeyId };
async function elapsedDatabaseTime() {
  const rows = await prisma.$queryRaw<Array<{ timestamp: Date }>>`SELECT clock_timestamp() - interval '1 second' AS timestamp`;
  return rows[0].timestamp;
}

describe("local-only immutable webhook fingerprint migration", () => {
  beforeEach(resetAndSeedTestDb);
  afterAll(disconnectTestDb);

  test("additive SQL preserves pre-migration legacy rows and both existing uniqueness constraints", async () => {
    const migration = readFileSync(path.join(process.cwd(), "prisma/migrations/0018_webhook_content_fingerprint/migration.sql"), "utf8");
    await expect(prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('CREATE SCHEMA fingerprint_upgrade_test');
      await tx.$executeRawUnsafe('SET LOCAL search_path TO fingerprint_upgrade_test');
      await tx.$executeRawUnsafe('CREATE TABLE "WebhookEvent" (id text PRIMARY KEY, provider text NOT NULL, provider_event_id text NOT NULL, dedupe_hash text NOT NULL UNIQUE, raw_body text NOT NULL, signature_valid boolean NOT NULL DEFAULT false, payload_expires_at timestamp(3), payload_purged_at timestamp(3), UNIQUE(provider,provider_event_id))');
      await tx.$executeRawUnsafe("INSERT INTO \"WebhookEvent\" (id,provider,provider_event_id,dedupe_hash,raw_body) VALUES ('legacy','synthetic','legacy','old-dedupe','original legacy')");
      for (const statement of migration.split(/(?=^ALTER TABLE|^CREATE FUNCTION|^CREATE TRIGGER)/m).filter(part => /^(ALTER TABLE|CREATE FUNCTION|CREATE TRIGGER)/.test(part))) {
        await tx.$executeRawUnsafe(statement);
      }
      expect(await tx.$queryRawUnsafe('SELECT raw_body,content_fingerprint,fingerprint_version,fingerprint_key_id FROM "WebhookEvent"')).toEqual([{ raw_body: "original legacy", content_fingerprint: null, fingerprint_version: null, fingerprint_key_id: null }]);
      const constraints = await tx.$queryRawUnsafe<Array<{ count: bigint }>>("SELECT count(*) FROM pg_constraint WHERE conrelid = '\"WebhookEvent\"'::regclass AND contype = 'u'");
      expect(Number(constraints[0].count)).toBe(2);
      throw new Error("rollback_synthetic_upgrade");
    })).rejects.toThrow("rollback_synthetic_upgrade");
  });

  test("verifies original bytes before binding; redacted stored body is not identity evidence", async () => {
    await expect(ingestSynthetic("bad", body, sign(null, Buffer.from("changed"), keys.privateKey), keys.publicKey)).rejects.toThrow("signature_invalid");
    expect(await prisma.webhookEvent.count({ where: { provider: "synthetic" } })).toBe(0);
    const row = await ingest("verified");
    expect(row.content_fingerprint).toBe(fingerprint(body, syntheticKey));
    expect(identityMatches(row, body, keyring)).toBe(true);
    expect(identityMatches(row, Buffer.from(row.raw_body), keyring)).toBe(false);
    expect(identityMatches(row, Buffer.from('{"synthetic":true}'), keyring)).toBe(false);
  });

  test("atomic identical and conflicting concurrent duplicates preserve first binding", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => ingest("same")));
    expect(new Set(results.map(row => row.id)).size).toBe(1);
    const variants = [body, Buffer.from("different")];
    const contested = await Promise.allSettled(Array.from({ length: 8 }, (_, index) => ingest("contest", variants[index % 2])));
    expect(contested.filter(r => r.status === "fulfilled")).toHaveLength(4);
    expect(contested.filter(r => r.status === "rejected")).toHaveLength(4);
    expect(await prisma.webhookEvent.count({ where: { provider_event_id: "contest" } })).toBe(1);
  });

  test("all-null legacy writers remain compatible and cannot backfill mutable bodies", async () => {
    const row = await prisma.webhookEvent.create({ data: base("legacy") });
    expect(row.content_fingerprint).toBeNull();
    await prisma.webhookEvent.update({ where: { id: row.id }, data: { raw_body: "redacted/restored", process_status: "error" } });
    await expect(prisma.webhookEvent.update({ where: { id: row.id }, data: { ...tuple, signature_valid: true, payload_expires_at: new Date(Date.now() + 60_000) } })).rejects.toThrow();
    expect(identityMatches(row, body, keyring)).toBe(false);
  });

  test("SQL rejects every partial tuple, unsupported version, malformed digest/key and missing finite expiry", async () => {
    const invalid = [
      { ...tuple, content_fingerprint: null }, { ...tuple, fingerprint_version: null }, { ...tuple, fingerprint_key_id: null },
      { content_fingerprint: tuple.content_fingerprint }, { fingerprint_version: 1 }, { fingerprint_key_id: syntheticKeyId },
      { ...tuple, content_fingerprint: "A".repeat(64) }, { ...tuple, content_fingerprint: "a".repeat(63) },
      { ...tuple, fingerprint_version: 2 }, { ...tuple, fingerprint_key_id: "" }, { ...tuple, fingerprint_key_id: "space id" },
      { ...tuple, signature_valid: false }, { ...tuple, payload_expires_at: null }, { ...tuple, payload_expires_at: new Date(0) },
      { ...tuple, payload_purged_at: new Date() },
    ];
    for (const [index, fields] of invalid.entries()) {
      await expect(prisma.webhookEvent.create({ data: { ...base(`invalid-${index}`), signature_valid: true, payload_expires_at: new Date(Date.now() + 60_000), ...fields } })).rejects.toThrow();
    }
    await expect(prisma.$executeRaw`INSERT INTO "WebhookEvent" (id,provider,provider_event_id,dedupe_hash,event_type,raw_body,signature_valid,content_fingerprint,fingerprint_version,fingerprint_key_id,payload_expires_at) VALUES ('inf','synthetic','inf','inf','synthetic','x',true,${tuple.content_fingerprint},1,${syntheticKeyId},'infinity')`).rejects.toThrow();
    expect(await prisma.webhookEvent.count({ where: { provider: "synthetic" } })).toBe(0);
  });

  test("SQL blocks replacement, partial/full clearing, dedupe changes and expiry extension", async () => {
    const row = await ingest("immutable");
    const updates = [
      { content_fingerprint: "0".repeat(64) }, { fingerprint_version: 2 }, { fingerprint_key_id: "another" },
      { content_fingerprint: null }, { fingerprint_version: null }, { fingerprint_key_id: null },
      { content_fingerprint: null, fingerprint_version: null, fingerprint_key_id: null },
      { provider_event_id: "another" }, { provider: "other" }, { dedupe_hash: "other" },
      { signature_valid: false },
      { payload_expires_at: null }, { payload_expires_at: new Date(Date.now() + 120_000) },
    ];
    for (const data of updates) await expect(prisma.webhookEvent.update({ where: { id: row.id }, data })).rejects.toThrow();
    await expect(prisma.$executeRaw`UPDATE "WebhookEvent" SET payload_expires_at = 'infinity' WHERE id = ${row.id}`).rejects.toThrow();
    await expect(prisma.$executeRaw`UPDATE "WebhookEvent" SET payload_expires_at = '-infinity' WHERE id = ${row.id}`).rejects.toThrow();
    await prisma.webhookEvent.update({ where: { id: row.id }, data: { ...tuple, raw_body: "redacted", process_status: "processed" } });
    expect((await prisma.webhookEvent.findUniqueOrThrow({ where: { id: row.id } })).content_fingerprint).toBe(row.content_fingerprint);
  });

  test("same-statement early erasure, future and backdated purge evidence fail", async () => {
    const row = await ingest("expiry");
    await expect(prisma.webhookEvent.update({ where: { id: row.id }, data: { payload_expires_at: new Date(0), payload_purged_at: new Date() } })).rejects.toThrow();
    await prisma.webhookEvent.update({ where: { id: row.id }, data: { payload_expires_at: new Date(1000) } });
    await expect(prisma.webhookEvent.update({ where: { id: row.id }, data: { provider_event_id: "other-during-purge", payload_purged_at: new Date() } })).rejects.toThrow();
    for (const payload_purged_at of [new Date(0), new Date(Date.now() + 60_000)]) {
      await expect(prisma.webhookEvent.update({ where: { id: row.id }, data: { payload_purged_at } })).rejects.toThrow();
    }
    const expired = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: row.id } });
    expect(identityMatches(expired, body, keyring)).toBe(false);
  });

  test("existing retention erases the tuple atomically; replay or legacy-style updates cannot resurrect it", async () => {
    const row = await ingest("purge");
    await prisma.webhookEvent.update({ where: { id: row.id }, data: { payload_expires_at: new Date(0) } });
    expect(await purgeExpiredWebhookPayloads(await elapsedDatabaseTime())).toMatchObject({ ok: true, data: { purged: 1 } });
    const purged = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: row.id } });
    expect(purged).toMatchObject({ content_fingerprint: null, fingerprint_version: null, fingerprint_key_id: null, raw_body: "<PURGED_WEBHOOK_PAYLOAD>" });
    expect(purged.payload_purged_at).not.toBeNull();
    expect(identityMatches(purged, body, keyring)).toBe(false);
    await expect(ingest("purge")).rejects.toThrow("identity_unverifiable");
    await expect(prisma.webhookEvent.update({ where: { id: row.id }, data: { ...tuple, payload_purged_at: null, payload_expires_at: new Date(Date.now() + 60_000) } })).rejects.toThrow();
    await prisma.webhookEvent.update({ where: { id: row.id }, data: { payload_purged_at: null, raw_body: "restored legacy body" } });
    await expect(prisma.webhookEvent.update({ where: { id: row.id }, data: tuple })).rejects.toThrow();
  });

  test("recovery fails closed for unknown versions, absent/retired/wrong keys and purged or legacy evidence", async () => {
    const row = await ingest("recovery");
    expect(identityMatches(row, body, new Map())).toBe(false);
    expect(identityMatches(row, body, new Map([[syntheticKeyId, Buffer.alloc(32, 1)]]))).toBe(false);
    for (const override of [{ fingerprint_version: 2 }, { fingerprint_version: null }, { fingerprint_key_id: "retired" }, { content_fingerprint: null }, { payload_expires_at: null }, { payload_purged_at: new Date() }, { signature_valid: false }]) {
      expect(identityMatches({ ...row, ...override }, body, keyring)).toBe(false);
    }
  });

  test("rollback posture retains schema and old writer compatibility without manufacturing proof", async () => {
    const row = await ingest("rollback");
    await prisma.$executeRaw`UPDATE "WebhookEvent" SET process_status = 'error', raw_body = 'old application writer' WHERE id = ${row.id}`;
    expect(identityMatches(await prisma.webhookEvent.findUniqueOrThrow({ where: { id: row.id } }), body, keyring)).toBe(true);
    await prisma.$executeRaw`INSERT INTO "WebhookEvent" (id,provider,provider_event_id,dedupe_hash,event_type,raw_body) VALUES ('old-insert','synthetic','old-insert','old-insert','synthetic','old body')`;
    expect(identityMatches(await prisma.webhookEvent.findUniqueOrThrow({ where: { id: "old-insert" } }), body, keyring)).toBe(false);
    const purgeTimestamp = await elapsedDatabaseTime();
    await prisma.$transaction(async tx => {
      await tx.webhookEvent.update({ where: { id: row.id }, data: { payload_expires_at: new Date(0) } });
      await tx.webhookEvent.update({ where: { id: row.id }, data: { payload_purged_at: purgeTimestamp, raw_body: "<PURGED_WEBHOOK_PAYLOAD>" } });
    });
    expect((await prisma.webhookEvent.findUniqueOrThrow({ where: { id: row.id } })).content_fingerprint).toBeNull();
  });
});
