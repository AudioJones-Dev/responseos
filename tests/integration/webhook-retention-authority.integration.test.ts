import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { db } from "@/lib/db/client";
import { prisma, resetAndSeedTestDb, disconnectTestDb } from "./setup";
import { recordWebhookEvent, backfillWebhookEvent } from "@/lib/data/webhookEvents";
import { assertFingerprint } from "@/lib/providers/telnyx/fingerprint";
import { cleanupExpiredProspectBootstraps } from "@/lib/prospectBootstrap/service";

const bytes = Buffer.from('synthetic original');
async function original(accountId: string | null = null) {
  const result = await recordWebhookEvent({ provider: "telnyx", provider_event_id: "retention-original", event_type: "synthetic", raw_body: bytes.toString(), signature_valid: true, verifiedBytes: bytes, account_id: accountId ?? undefined });
  if (!result.ok) throw new Error(result.error.code);
  return prisma.webhookEvent.findUniqueOrThrow({ where: { id: result.data.id } });
}
const ordinary = (sql: string) => prisma.$transaction(async tx => {
  await tx.$executeRawUnsafe('SET LOCAL ROLE frl_test_runtime');
  return tx.$executeRawUnsafe(sql);
});
async function erase(id: string, account: string | null, rollback = false) {
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE frl_test_retention');
    await tx.$executeRaw`SELECT public.erase_webhook_early(${id}, ${account}, 'synthetic-approval-001', 'authorized_deletion')`;
    if (rollback) throw new Error('synthetic_rollback');
  });
}

describe('restricted retention authority', () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='frl_test_runtime') THEN CREATE ROLE frl_test_runtime NOLOGIN; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='frl_test_retention') THEN CREATE ROLE frl_test_retention NOLOGIN; END IF;
    END $$`);
    await prisma.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO frl_test_runtime, frl_test_retention');
    await prisma.$executeRawUnsafe('GRANT SELECT, INSERT, UPDATE, DELETE ON public."WebhookEvent" TO frl_test_runtime');
    await prisma.$executeRawUnsafe('GRANT EXECUTE ON FUNCTION public.erase_webhook_early(text,text,text,text) TO frl_test_retention');
    await prisma.$executeRawUnsafe('GRANT EXECUTE ON FUNCTION public.purge_expired_webhook_erasure_audits() TO frl_test_retention');
  });
  beforeEach(resetAndSeedTestDb);
  afterAll(disconnectTestDb);

  test('ordinary role cannot shorten, extend, null, purge, delete or forge authorization', async () => {
    const row = await original();
    for (const change of ["payload_expires_at=clock_timestamp()-interval '1 second'", "payload_expires_at=payload_expires_at+interval '1 second'", 'payload_expires_at=NULL', 'payload_purged_at=clock_timestamp()']) {
      await expect(ordinary(`UPDATE "WebhookEvent" SET ${change} WHERE id='${row.id}'`)).rejects.toThrow();
    }
    await expect(ordinary(`DELETE FROM "WebhookEvent" WHERE id='${row.id}'`)).rejects.toThrow();
    await expect(ordinary(`SELECT public.erase_webhook_early('${row.id}',NULL,'synthetic-approval','authorized_deletion')`)).rejects.toThrow();
    await expect(ordinary('DELETE FROM "WebhookErasureAudit"')).rejects.toThrow();
    await expect(ordinary(`UPDATE "WebhookErasureAudit" SET reason='key_compromise'`)).rejects.toThrow();
    await expect(ordinary('INSERT INTO "WebhookErasureAudit" SELECT * FROM "WebhookErasureAudit"')).rejects.toThrow();
    await expect(ordinary('ALTER TABLE "WebhookEvent" DISABLE TRIGGER ALL')).rejects.toThrow();
    await expect(ordinary('TRUNCATE "WebhookEvent"')).rejects.toThrow();
    expect((await prisma.webhookEvent.findUniqueOrThrow({ where: { id: row.id } })).content_fingerprint).toBe(row.content_fingerprint);
  });

  test('authorized erasure requires exact account and atomically audits, scrubs and invalidates', async () => {
    const account = await prisma.account.findFirstOrThrow();
    const row = await original(account.id);
    await expect(erase(row.id, null)).rejects.toThrow('webhook_erasure_target_mismatch');
    await expect(erase(row.id, 'another-account')).rejects.toThrow('webhook_erasure_target_mismatch');
    await expect(erase(row.id, account.id, true)).rejects.toThrow('synthetic_rollback');
    expect(await prisma.webhookErasureAudit.count()).toBe(0);
    expect((await prisma.webhookEvent.findUniqueOrThrow({ where: { id: row.id } })).raw_body).toBe(bytes.toString());
    await erase(row.id, account.id);
    const erased = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: row.id } });
    expect(erased).toMatchObject({ content_fingerprint: null, signature_header: null, provider_call_id: null, provider_call_ids: [], agent_target: null, payload_expires_at: row.payload_expires_at });
    expect(erased.raw_body).toBe('<AUTHORIZED_ERASURE>');
    expect(() => assertFingerprint(erased, bytes, new Date())).toThrow();
    expect(await prisma.webhookErasureAudit.findUniqueOrThrow({ where: { webhook_event_id: row.id } })).toMatchObject({ account_id: account.id, authorization_reference: 'synthetic-approval-001', reason: 'authorized_deletion', expires_at: row.payload_expires_at });
    await expect(ordinary(`UPDATE "WebhookEvent" SET content_fingerprint='${row.content_fingerprint}',fingerprint_version=1,fingerprint_key_id='synthetic-local-v1',payload_purged_at=NULL WHERE id='${row.id}'`)).rejects.toThrow();
  });

  test('earlier backfill commits scrubbed content and blocks proof without extending or shortening expiry', async () => {
    const account = await prisma.account.findFirstOrThrow();
    const row = await original();
    const earlier = new Date(Date.now() - 1000);
    const accepted = await prisma.$transaction(tx => backfillWebhookEvent({ client: tx, id: row.id, account_id: account.id, verifiedBytes: bytes, raw_body: 'must not retain', payload_expires_at: earlier, provider_call_id: 'must not retain' }));
    expect(accepted).toBe(false);
    const blocked = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: row.id } });
    expect(blocked).toMatchObject({ account_id: account.id, raw_body: '<ERASURE_REQUIRED>', provider_call_id: null, payload_erasure_required_at: earlier, payload_expires_at: row.payload_expires_at });
    expect(() => assertFingerprint(blocked, bytes, new Date())).toThrow('webhook_erasure_required');
    await expect(ordinary(`UPDATE "WebhookEvent" SET payload_erasure_required_at=NULL WHERE id='${row.id}'`)).rejects.toThrow();
    await erase(row.id, account.id);
    expect((await prisma.webhookEvent.findUniqueOrThrow({ where: { id: row.id } })).content_fingerprint).toBeNull();
  });

  test('restricted audit maintenance removes only elapsed evidence', async () => {
    const row = await original();
    await erase(row.id, null);
    const purge = () => prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE frl_test_retention');
      return tx.$queryRaw<{ count: number }[]>`SELECT public.purge_expired_webhook_erasure_audits() AS count`;
    });
    await expect(ordinary('SELECT public.purge_expired_webhook_erasure_audits()')).rejects.toThrow();
    expect(await purge()).toEqual([{ count: 0 }]);
    await prisma.webhookErasureAudit.update({ where: { webhook_event_id: row.id }, data: { expires_at: new Date(0) } });
    expect(await purge()).toEqual([{ count: 1 }]);
    expect(() => assertFingerprint({ ...row, content_fingerprint: null }, bytes, new Date())).toThrow();
  });

  test('unexpected cleanup failure reports committed progress without claiming success', async () => {
    if (!db) throw new Error('fixture database required');
    const database = db;
    const transaction = database.$transaction.bind(database);
    let calls = 0;
    const spy = vi.spyOn(database, '$transaction');
    spy.mockImplementation((...args: Parameters<typeof database.$transaction>) => {
      if (++calls === 2) return Promise.reject(new Error('synthetic_second_account_failure'));
      return transaction(...args);
    });
    try {
      for (const slug of ['first-cleanup', 'second-cleanup']) {
        const account = await prisma.account.create({ data: { name: slug, slug, industry: 'synthetic', timezone: 'UTC' } });
        await prisma.prospectBootstrap.create({ data: { account_id: account.id, canonical_website: 'https://example.test', status: 'expired', expires_at: new Date(0), content_expires_at: new Date(0) } });
      }
      expect(await cleanupExpiredProspectBootstraps()).toMatchObject({ ok: false, error: { message: 'synthetic_second_account_failure', details: { cleaned: 1, blocked: [] } } });
    } finally { spy.mockRestore(); }
  });

  test('cleanup reports a blocked account and still cleans another eligible account', async () => {
    const old = new Date('2026-01-01');
    const blocked = await prisma.account.create({ data: { industry: 'synthetic', timezone: 'UTC', name: 'Synthetic blocked', slug: 'synthetic-blocked' } });
    const eligible = await prisma.account.create({ data: { industry: 'synthetic', timezone: 'UTC', name: 'Synthetic eligible', slug: 'synthetic-eligible' } });
    for (const account of [blocked, eligible]) await prisma.prospectBootstrap.create({ data: { account_id: account.id, canonical_website: 'https://example.test', status: 'expired', content_expires_at: old, expires_at: old } });
    const row = await original(blocked.id);
    const result = await cleanupExpiredProspectBootstraps();
    expect(result).toMatchObject({ ok: true, data: { cleaned: 1, blocked: [{ accountId: blocked.id, eligibleAt: row.payload_expires_at!.toISOString() }] } });
    expect((await prisma.account.findUniqueOrThrow({ where: { id: eligible.id } })).status).toBe('cancelled');
    expect((await prisma.account.findUniqueOrThrow({ where: { id: blocked.id } })).status).not.toBe('cancelled');
    expect(await cleanupExpiredProspectBootstraps()).toMatchObject({ ok: true, data: { cleaned: 0 } });
  });
});
