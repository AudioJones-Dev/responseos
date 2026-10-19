import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, expect, test, vi } from 'vitest';
import { prisma, resetAndSeedTestDb, disconnectTestDb, setDevSession } from './setup';
import { persistWithdrawalReceipt, drainWithdrawal, withdrawalProgress, withdrawalFailure, withdrawalReceiptDb, receiptTransaction } from '@/lib/callReview/withdrawalReceipt';
import { providerCallHasWithdrawal, recordWithdrawal } from '@/lib/callReview/withdrawal';
import { withCaptureLock, canRetainCallContent } from '@/lib/callReview/consent';
import { POST } from '@/app/api/admin/call-capture/[id]/consent/route';
import { runOperatorConsentEffect } from '@/lib/callControl/service';
vi.hoisted(() => vi.resetModules());
beforeEach(async () => { await resetAndSeedTestDb(); setDevSession('operator'); });
afterAll(async () => { await withdrawalReceiptDb?.$disconnect(); await disconnectTestDb(); vi.resetModules(); });
function barrier() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
const input = () => ({ eventKey: randomUUID(), disclosureRef: 'synthetic', evidenceRef: 'synthetic', jurisdictionBasis: 'synthetic' });
async function fixture() {
  const account = await prisma.account.findFirstOrThrow();
  return prisma.callCaptureSession.create({ data: { account_id: account.id, provider_call_id: randomUUID(), snapshot_id: 'synthetic', snapshot_json: {}, assignment_id: 'synthetic', control_state: 'CONSENT_PENDING_OPERATOR', dtmf_decision: 'affirmative' } });
}

test('actual capture FK permits receipt during NO KEY UPDATE; drain remains pending until writer commit', async () => {
  const capture = await fixture(), held = barrier(), release = barrier();
  const writer = withCaptureLock(capture.account_id, capture.provider_call_id, async tx => {
    await tx.$queryRaw`SELECT id FROM "CallCaptureSession" WHERE id=${capture.id} FOR NO KEY UPDATE`;
    held.resolve(); await release.promise;
    await tx.callCaptureSession.update({ where: { id: capture.id }, data: { conversation_id: 'synthetic preauthorized completion' } });
  });
  await held.promise;
  try {
    const receipt = await persistWithdrawalReceipt(capture, 'first-operator', input());
    expect(receipt.capture_id).toBe(capture.id);
    expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id } })).withdrawal_received_at).toBeNull();
    expect(await providerCallHasWithdrawal(capture.account_id, capture.provider_call_id)).toBe(true);
    await expect(drainWithdrawal(capture)).rejects.toThrow();
    expect(await withdrawalProgress(capture)).toMatchObject({ receipt: 'recorded', drain: 'pending', aiStop: 'not_requested' });
  } finally { release.resolve(); await writer; }
  await drainWithdrawal(capture);
  expect(await withdrawalProgress(capture)).toMatchObject({ receipt: 'recorded', drain: 'confirmed' });
  expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id } })).conversation_id).toBe('synthetic preauthorized completion');
});

test.each(['capture', 'account'] as const)('actual %s FK contention times out without a false receipt', async kind => {
  const capture = await fixture(), held = barrier(), release = barrier();
  const blocker = prisma.$transaction(async tx => {
    if (kind === 'capture') await tx.$queryRaw`SELECT id FROM "CallCaptureSession" WHERE id=${capture.id} FOR UPDATE`;
    else await tx.$queryRaw`SELECT id FROM "Account" WHERE id=${capture.account_id} FOR UPDATE`;
    held.resolve(); await release.promise;
  });
  await held.promise;
  try {
    let error: unknown;
    try { await persistWithdrawalReceipt(capture, 'operator', input()); } catch (e) { error = e; }
    expect(error).toBeDefined();
    expect(await withdrawalFailure(capture, error)).toMatchObject({ receipt: 'not_recorded', drain: 'pending' });
    expect(await prisma.callWithdrawalReceipt.count()).toBe(0);
  } finally { release.resolve(); await blocker; }
});

test('foreign keys, insert-only receipt, immutable capture identity and drain guards hold', async () => {
  const capture = await fixture(), request = input();
  const receipt = await persistWithdrawalReceipt(capture, 'operator', request);
  await expect(prisma.callWithdrawalReceipt.create({ data: { ...receipt, id: randomUUID(), account_id: 'wrong-account', provider_call_id: randomUUID() } })).rejects.toThrow();
  await expect(prisma.callWithdrawalReceipt.update({ where: { id: receipt.id }, data: { actor_user_id: 'other' } })).rejects.toThrow('withdrawal_receipt_is_insert_only');
  await expect(prisma.callWithdrawalReceipt.delete({ where: { id: receipt.id } })).rejects.toThrow('withdrawal_receipt_is_insert_only');
  await expect(prisma.callCaptureSession.update({ where: { id: capture.id }, data: { provider_call_id: 'wrong' } })).rejects.toThrow('capture_identity_is_immutable');
  await expect(prisma.callCaptureSession.update({ where: { id: capture.id }, data: { withdrawal_drained_at: new Date() } })).rejects.toThrow('withdrawal_drain_requires_receipt_and_closure');
  await drainWithdrawal(capture);
  await expect(prisma.callCaptureSession.update({ where: { id: capture.id }, data: { withdrawal_drained_at: null } })).rejects.toThrow('withdrawal_drain_is_permanent');
});

test('concurrent receipt retries preserve first identity, actor and chronology', async () => {
  const capture = await fixture(), request = input();
  const rows = await Promise.all(Array.from({ length: 4 }, () => persistWithdrawalReceipt(capture, 'operator', request)));
  expect(new Set(rows.map(r => r.id)).size).toBe(1);
  expect(new Set(rows.map(r => r.received_at.toISOString())).size).toBe(1);
  const retry = await persistWithdrawalReceipt(capture, 'later-operator', input());
  expect(retry).toMatchObject({ actor_user_id: 'operator', event_key: request.eventKey, received_at: rows[0].received_at });
});

test('receipt denies grant, start and content before compatibility projection; stale isolation fails closed', async () => {
  const capture = await fixture();
  await persistWithdrawalReceipt(capture, 'operator', input());
  const response = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ action: 'grant', ...input() }) }), { params: Promise.resolve({ id: capture.id }) });
  expect(response.status).toBe(503);
  await expect(runOperatorConsentEffect({ captureId: capture.id, action: 'grant' })).rejects.toThrow('withdrawal_is_terminal');
  expect(await withCaptureLock(capture.account_id, capture.provider_call_id, tx => canRetainCallContent(capture.account_id, capture.provider_call_id, { data: { id: 'synthetic', event_type: 'call.hangup', occurred_at: new Date().toISOString(), payload: {} } }, tx))).toBe(false);
  await expect(prisma.$transaction(tx => providerCallHasWithdrawal(capture.account_id, capture.provider_call_id, tx), { isolationLevel: 'RepeatableRead' })).rejects.toThrow('receipt_requires_read_committed');
  expect(await prisma.telnyxCallCommand.count()).toBe(0);
});

test('receipt pool exhaustion is unknown, not successful withdrawal; reconciliation is idempotent', async () => {
  const capture = await fixture(), held = barrier();
  const busy = receiptTransaction(async tx => { held.resolve(); await tx.$queryRaw`SELECT 1 FROM pg_sleep(0.45)`; });
  await held.promise;
  let error: unknown;
  try { await persistWithdrawalReceipt(capture, 'operator', input()); } catch (e) { error = e; }
  expect(error).toBeDefined(); await busy;
  expect(await withdrawalFailure(capture, error)).toMatchObject({ receipt: 'unknown', drain: 'pending' });
  expect(await prisma.callWithdrawalReceipt.count()).toBe(0);
  const request = input(); await persistWithdrawalReceipt(capture, 'operator', request);
  expect(await withdrawalFailure(capture, Error('synthetic lost commit acknowledgement'))).toMatchObject({ receipt: 'recorded', drain: 'pending' });
  await persistWithdrawalReceipt(capture, 'operator', request); expect(await prisma.callWithdrawalReceipt.count()).toBe(1);
});

test('SQL-stalled writer rolls back; receipt survives and drain cannot falsely confirm', async () => {
  const capture = await fixture(), held = barrier();
  const writer = withCaptureLock(capture.account_id, capture.provider_call_id, async tx => {
    await tx.$executeRaw`UPDATE "CallCaptureSession" SET conversation_id='synthetic rollback' WHERE id=${capture.id}`;
    held.resolve(); await tx.$queryRaw`SELECT 1 FROM pg_sleep(30)`;
  }).catch(error => error);
  await held.promise; await persistWithdrawalReceipt(capture, 'operator', input());
  await expect(drainWithdrawal(capture)).rejects.toThrow();
  expect((await withdrawalProgress(capture)).drain).toBe('pending');
  expect(await writer).toBeInstanceOf(Error);
  expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id } })).conversation_id).toBeNull();
  await drainWithdrawal(capture); expect((await withdrawalProgress(capture)).drain).toBe('confirmed');
});

test('evidence insertion failure cannot undo independent receipt or confirmed drain', async () => {
  const capture = await fixture();
  await prisma.$executeRawUnsafe(`CREATE FUNCTION synthetic_receipt_evidence_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic evidence failure'; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER synthetic_receipt_evidence_failure BEFORE INSERT ON "CallConsentEvent" FOR EACH ROW EXECUTE FUNCTION synthetic_receipt_evidence_failure()`);
  try { await expect(recordWithdrawal(capture, 'operator', input())).rejects.toThrow('synthetic evidence failure'); }
  finally { await prisma.$executeRawUnsafe('DROP TRIGGER synthetic_receipt_evidence_failure ON "CallConsentEvent"'); await prisma.$executeRawUnsafe('DROP FUNCTION synthetic_receipt_evidence_failure()'); }
  expect(await withdrawalProgress(capture)).toMatchObject({ receipt: 'recorded', drain: 'confirmed', aiStop: 'not_requested' });
});
