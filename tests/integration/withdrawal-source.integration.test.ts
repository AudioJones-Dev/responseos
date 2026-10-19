import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { prisma, resetAndSeedTestDb, disconnectTestDb, setDevSession } from "./setup";
import { POST } from "@/app/api/admin/call-capture/[id]/consent/route";
import { callHasWithdrawal } from "@/lib/callReview/withdrawal";
import { consentAllowsCapture } from "@/lib/callReview/consent";
import { db } from "@/lib/db/client";
import { runCrmSyncForCall } from "@/lib/crm/syncFinalizedCall";
import { dispatchCompletedInteractionNotification } from "@/lib/notifications/completedInteraction";
const effect = vi.hoisted(() => { vi.resetModules(); return vi.fn(); });
vi.mock("@/lib/callControl/service", async original => ({ ...await original<object>(), runOperatorConsentEffect: effect }));

beforeEach(async () => { await resetAndSeedTestDb(); setDevSession('operator'); effect.mockReset().mockResolvedValue(undefined); });
afterAll(async () => { await disconnectTestDb(); vi.doUnmock("@/lib/callControl/service"); vi.resetModules(); });

async function fixture() {
  const account = await prisma.account.findFirstOrThrow();
  const received = new Date();
  const start = new Date(received.getTime() - 600_000), source = new Date(received.getTime() - 300_000);
  const capture = await prisma.callCaptureSession.create({ data: { account_id: account.id, provider_call_id: randomUUID(), snapshot_id: 'synthetic', snapshot_json: {}, control_state: 'AI_ACTIVE', capture_started_at: start, created_at: start } });
  await prisma.callConsentEvent.create({ data: { account_id: account.id, provider_call_id: capture.provider_call_id, action: 'grant', artifact: 'transcript', event_key: randomUUID(), disclosure_ref: 'synthetic', evidence_ref: 'synthetic', jurisdiction_basis: 'synthetic', source_channel: 'call', actor_user_id: 'operator', occurred_at: start } });
  const call = await prisma.call.create({ data: { account_id: account.id, provider: 'telnyx', provider_call_id: capture.provider_call_id, direction: 'inbound', status: 'completed', from_number: '+15555550111', to_number: '+15555550112', started_at: start } });
  const input = { action: 'withdraw', disclosureRef: 'synthetic-disclosure', evidenceRef: 'operator-witness:synthetic', jurisdictionBasis: 'synthetic', eventKey: randomUUID(), withdrawalSourceTime: { occurredAt: source.toISOString(), attestation: 'operator_witness' } };
  const post = (data: unknown = input) => POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify(data) }), { params: Promise.resolve({ id: capture.id }) });
  return { account, capture, call, start, source, input, post };
}

test('preserves witnessed source, server receipt and actor; flags actual gap evidence without relabeling it', async () => {
  const f = await fixture();
  const during = new Date(f.source.getTime() + 60_000);
  const command = await prisma.telnyxCallCommand.create({ data: { account_id: f.account.id, capture_session_id: f.capture.id, assignment_id: 'synthetic', command_type: 'ai_assistant_start', generation: 1, command_id: randomUUID(), provider_resource: f.capture.provider_call_id, request_json: {}, status: 'succeeded', intended_at: f.start, provider_responded_at: during } });
  const transcript = await prisma.callTranscriptRevision.create({ data: { account_id: f.account.id, call_id: f.call.id, capture_session_id: f.capture.id, assignment_id: 'synthetic', snapshot_id: 'synthetic', conversation_id: 'synthetic', revision: 1, source_hash: 'synthetic', inline_text: 'Synthetic gap evidence', capture_started_at: f.start, created_at: during } });
  const response = await f.post();
  expect(response.status).toBe(200);
  const event = await prisma.callConsentEvent.findFirstOrThrow({ where: { action: 'withdraw' } });
  expect(event).toMatchObject({ occurred_at: f.source, source_occurred_at: f.source, source_time_status: 'verified', source_provenance: 'authenticated_operator_witness' });
  expect(event.recorded_at!.getTime()).toBeGreaterThan(f.source.getTime());
  expect(event.actor_user_id).not.toBe('customer');
  expect(JSON.stringify(event.review_activity_json)).toContain(command.id);
  expect(JSON.stringify(event.review_activity_json)).toContain(transcript.id);
  expect((await prisma.callTranscriptRevision.findUniqueOrThrow({ where: { id: transcript.id } })).capture_ended_at).toBeNull();
  expect(await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).toMatchObject({ content_admission_closed_at: f.source, control_state: 'STOP_PENDING' });
  expect(await callHasWithdrawal(f.account.id, f.call.id)).toBe(true);
  expect(await callHasWithdrawal('another-account', f.call.id)).toBe(false);
  expect((await runCrmSyncForCall({ accountId: f.account.id, callId: f.call.id })).ok).toBe(false);
  expect((await dispatchCompletedInteractionNotification({ accountId: f.account.id, callId: f.call.id })).ok).toBe(false);
  expect(await prisma.crmSyncOperation.count()).toBe(0);
  expect(await prisma.notification.count()).toBe(0);
});

test.each([
  ['missing', undefined, 'missing_source_time'],
  ['unverified', { occurredAt: 'REPLACE', attestation: 'provider_text' }, 'unverified_source'],
  ['future', { occurredAt: '2099-01-01T00:00:00.000Z', attestation: 'operator_witness' }, 'future_source_time'],
  ['impossible', { occurredAt: '2026-02-30T00:00:00.000Z', attestation: 'operator_witness' }, 'invalid_utc_timestamp'],
  ['precision', { occurredAt: '2026-01-01T00:00:00.0001Z', attestation: 'operator_witness' }, 'invalid_utc_timestamp'],
  ['before grant', { occurredAt: '2000-01-01T00:00:00.000Z', attestation: 'operator_witness' }, 'before_supported_consent'],
] as const)('%s time still fences immediately and goes to review', async (_label, claim, reason) => {
  const f = await fixture();
  const source = claim?.occurredAt === 'REPLACE' ? { ...claim, occurredAt: f.source.toISOString() } : claim;
  expect((await f.post({ ...f.input, withdrawalSourceTime: source })).status).toBe(200);
  const event = await prisma.callConsentEvent.findFirstOrThrow({ where: { action: 'withdraw' } });
  expect(event).toMatchObject({ source_time_status: 'review_required', source_time_reason: reason });
  expect(event.occurred_at).toEqual(event.recorded_at);
  expect(await callHasWithdrawal(f.account.id, f.call.id)).toBe(true);
  expect(effect).toHaveBeenCalledWith({ captureId: f.capture.id, action: 'withdraw' });
});

test('missing reference fields still fence and do not become trusted source evidence', async () => {
  const f = await fixture();
  expect((await f.post({ action: 'withdraw', eventKey: f.input.eventKey, withdrawalSourceTime: f.input.withdrawalSourceTime })).status).toBe(200);
  expect(await prisma.callConsentEvent.findFirstOrThrow({ where: { action: 'withdraw' } })).toMatchObject({ source_time_reason: 'missing_consent_references' });
});

test('identical retry is stable, conflicting timestamp is audited and cannot reopen consent', async () => {
  const f = await fixture();
  await f.post(); const first = await prisma.callConsentEvent.findFirstOrThrow({ where: { action: 'withdraw' } });
  await f.post();
  expect(await prisma.callConsentEvent.count({ where: { action: 'withdraw' } })).toBe(1);
  expect((await f.post({ ...f.input, withdrawalSourceTime: { ...f.input.withdrawalSourceTime, occurredAt: new Date(f.source.getTime() + 1000).toISOString() } })).status).toBe(409);
  expect(await prisma.callConsentEvent.findUniqueOrThrow({ where: { id: first.id } })).toEqual(first);
  expect(await prisma.callConsentEvent.findFirstOrThrow({ where: { source_time_reason: 'idempotency_conflict' } })).toBeTruthy();
  const grant = { action: "grant", disclosureRef: f.input.disclosureRef, evidenceRef: f.input.evidenceRef, jurisdictionBasis: f.input.jurisdictionBasis };
  expect((await f.post({ ...grant, action: 'grant', eventKey: randomUUID() })).status).toBe(503);
  expect(consentAllowsCapture([{ action: 'withdraw', occurred_at: f.source }, { action: 'grant', occurred_at: new Date() }], f.source, new Date())).toBe(false);
  await expect(prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { withdrawal_received_at: null, control_state: 'AI_ACTIVE' } })).rejects.toThrow('withdrawal_is_terminal');
});

test('late withdrawal and concurrent contradictory observations remain terminal without historical rewrites', async () => {
  const f = await fixture();
  const ended = new Date(f.source.getTime() + 60_000);
  await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { control_state: 'EVIDENCE_FROZEN', capture_ended_at: ended } });
  const responses = await Promise.all([f.post(), f.post({ ...f.input, eventKey: randomUUID(), withdrawalSourceTime: { ...f.input.withdrawalSourceTime, occurredAt: new Date(f.source.getTime() + 1000).toISOString() } })]);
  expect(responses.map(r => r.status)).toEqual([200, 200]);
  expect(await prisma.callConsentEvent.count({ where: { source_time_status: 'verified' } })).toBe(1);
  expect(await prisma.callConsentEvent.count({ where: { source_time_reason: 'conflicting_withdrawal' } })).toBe(1);
  expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).capture_ended_at).toEqual(ended);
});

test('untrusted tenant roles cannot create withdrawal fences', async () => {
  const f = await fixture(); setDevSession('client_admin@org_mock_1');
  expect((await f.post()).status).toBe(403);
  expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).withdrawal_received_at).toBeNull();
});

test('receipt fence survives a capture-lock wait and persistence failure', async () => {
  const f = await fixture();
  let pending: Promise<Response> | undefined;
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"capture:" + f.account.id + ":" + f.capture.provider_call_id}))`;
    pending = f.post();
    await vi.waitFor(async () => expect(await prisma.callWithdrawalReceipt.count({ where: { capture_id: f.capture.id } })).toBe(1));
    expect(await prisma.callConsentEvent.count({ where: { action: 'withdraw' } })).toBe(0);
    expect(await callHasWithdrawal(f.account.id, f.call.id)).toBe(true);
  });
  expect((await pending!).status).toBe(200);
  const second = await fixture();
  if (!db) throw Error('test database required');
  const failed = vi.spyOn(db, '$transaction').mockRejectedValueOnce(new Error('synthetic_event_write_failure'));
  try { const response = await second.post(); expect(response.status).toBe(202); expect(await response.json()).toMatchObject({ error: 'withdrawal_recording_incomplete', withdrawal: { receipt: 'recorded', drain: 'pending' } }); } finally { failed.mockRestore(); }
  expect(await prisma.callWithdrawalReceipt.count({ where: { capture_id: second.capture.id } })).toBe(1);
  expect(await callHasWithdrawal(second.account.id, second.call.id)).toBe(true);
});

test('reused grant key cannot prevent withdrawal fencing or overwrite the grant', async () => {
  const f = await fixture();
  const grant = await prisma.callConsentEvent.findFirstOrThrow({ where: { action: 'grant' } });
  await prisma.callConsentEvent.update({ where: { id: grant.id }, data: { event_key: `${f.capture.id}:${f.input.eventKey}` } });
  expect((await f.post()).status).toBe(409);
  expect((await prisma.callConsentEvent.findUniqueOrThrow({ where: { id: grant.id } })).action).toBe('grant');
  expect(await callHasWithdrawal(f.account.id, f.call.id)).toBe(true);
});

test('a fence-only retry cannot verify a source later than the first withdrawal receipt', async () => {
  const f = await fixture();
  const firstReceipt = new Date(f.source.getTime() - 1000);
  await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { withdrawal_received_at: firstReceipt } });
  expect((await f.post()).status).toBe(200);
  expect(await prisma.callConsentEvent.findFirstOrThrow({ where: { action: 'withdraw' } })).toMatchObject({ source_time_status: 'review_required', source_time_reason: 'after_first_receipt' });
  expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).withdrawal_received_at).toEqual(firstReceipt);
});
