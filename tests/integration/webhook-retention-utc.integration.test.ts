import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma, resetTestDb, disconnectTestDb } from "./setup";

type Tx = Prisma.TransactionClient;
const zones = ["Pacific/Kiritimati", "America/Los_Angeles"];
const inZone = <T>(zone: string, role: string, action: (tx: Tx) => Promise<T>) => prisma.$transaction(async tx => {
  await tx.$queryRaw`SELECT set_config('TimeZone', ${zone}, true)`;
  await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
  return action(tx);
});
async function insert(tx: Tx, id: string, minutes: number) {
  return tx.$executeRaw`INSERT INTO "WebhookEvent"
    (id, provider, provider_event_id, event_type, raw_body, signature_valid, dedupe_hash,
     content_fingerprint, fingerprint_version, fingerprint_key_id, payload_expires_at)
    VALUES (${id}, 'telnyx', ${id}, 'synthetic', 'synthetic', true, ${id},
     repeat('a',64), 1, 'synthetic-local-v1', (clock_timestamp() AT TIME ZONE 'UTC') + ${minutes} * interval '1 minute')`;
}
async function expired(id: string) {
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('ALTER TABLE "WebhookEvent" DISABLE TRIGGER USER');
    await insert(tx, id, -30);
    await tx.$executeRawUnsafe('ALTER TABLE "WebhookEvent" ENABLE TRIGGER USER');
  });
}

describe('retention UTC clock semantics', () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='frl_utc_runtime') THEN CREATE ROLE frl_utc_runtime NOLOGIN; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='frl_utc_maintenance') THEN CREATE ROLE frl_utc_maintenance NOLOGIN; END IF;
    END $$`);
    await prisma.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO frl_utc_runtime, frl_utc_maintenance');
    await prisma.$executeRawUnsafe('GRANT SELECT, INSERT, UPDATE, DELETE ON "WebhookEvent" TO frl_utc_runtime');
    await prisma.$executeRawUnsafe('GRANT EXECUTE ON FUNCTION erase_webhook_early(text,text,text,text), purge_expired_webhook_erasure_audits() TO frl_utc_maintenance');
  });
  beforeEach(resetTestDb);
  afterAll(disconnectTestDb);

  for (const zone of zones) {
    test(`${zone}: accepts future UTC insertion and rejects expired insertion`, async () => {
      await inZone(zone, 'frl_utc_runtime', tx => insert(tx, 'future', 30));
      await expect(inZone(zone, 'frl_utc_runtime', tx => insert(tx, 'past', -30))).rejects.toThrow('webhook_fingerprint_expired');
      expect(await prisma.webhookEvent.count()).toBe(1);
    });

    test(`${zone}: blocks unexpired deletion and permits elapsed deletion`, async () => {
      await insert(prisma, 'future', 30);
      await expired('past');
      await expect(inZone(zone, 'frl_utc_runtime', tx => tx.$executeRaw`DELETE FROM "WebhookEvent" WHERE id='future'`)).rejects.toThrow('webhook_fingerprint_premature_deletion');
      expect(await inZone(zone, 'frl_utc_runtime', tx => tx.$executeRaw`DELETE FROM "WebhookEvent" WHERE id='past'`)).toBe(1);
    });

    test(`${zone}: rejects future purge timestamps and allows elapsed UTC purge`, async () => {
      await expired('past');
      await expect(inZone(zone, 'frl_utc_runtime', tx => tx.$executeRaw`UPDATE "WebhookEvent" SET payload_purged_at=(clock_timestamp() AT TIME ZONE 'UTC') + interval '30 minutes' WHERE id='past'`)).rejects.toThrow('webhook_fingerprint_premature_erasure');
      await inZone(zone, 'frl_utc_runtime', tx => tx.$executeRaw`UPDATE "WebhookEvent" SET payload_purged_at=date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC') WHERE id='past'`);
      expect((await prisma.webhookEvent.findUniqueOrThrow({ where: { id: 'past' } })).content_fingerprint).toBeNull();
    });

    test(`${zone}: authorized erasure records UTC instants without shifting a legacy long deadline`, async () => {
      await insert(prisma, 'legacy', 72 * 60);
      const before = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: 'legacy' } });
      const [{ now: start }] = await prisma.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`;
      await inZone(zone, 'frl_utc_maintenance', tx => tx.$executeRaw`SELECT erase_webhook_early('legacy', NULL, 'synthetic-approval-utc', 'authorized_deletion')`);
      const [{ now: end }] = await prisma.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`;
      const row = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: 'legacy' } });
      const audit = await prisma.webhookErasureAudit.findUniqueOrThrow({ where: { webhook_event_id: 'legacy' } });
      expect(row.payload_expires_at).toEqual(before.payload_expires_at);
      expect(audit.expires_at).toEqual(before.payload_expires_at);
      expect(audit.erased_at).toEqual(row.payload_purged_at);
      expect(audit.erased_at.getTime()).toBeGreaterThanOrEqual(start.getTime() - 1);
      expect(audit.erased_at.getTime()).toBeLessThanOrEqual(end.getTime());
      expect(row.content_fingerprint).toBeNull();
    });

    test(`${zone}: audit maintenance removes only UTC-expired evidence`, async () => {
      for (const [id, minutes] of [['elapsed-audit', -30], ['future-audit', 30]] as const) {
        await prisma.$executeRaw`INSERT INTO "WebhookErasureAudit" VALUES
          (${id}, NULL, 'synthetic-approval-utc', 'authorized_deletion', 'synthetic',
           (clock_timestamp() AT TIME ZONE 'UTC') - interval '1 hour',
           (clock_timestamp() AT TIME ZONE 'UTC') + ${minutes} * interval '1 minute', txid_current())`;
      }
      expect(await inZone(zone, 'frl_utc_maintenance', tx => tx.$queryRaw`SELECT purge_expired_webhook_erasure_audits() AS count`)).toEqual([{ count: 1 }]);
      expect((await prisma.webhookErasureAudit.findMany()).map(row => row.webhook_event_id)).toEqual(['future-audit']);
    });
  }
});
