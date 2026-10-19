import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { prisma, resetAndSeedTestDb, disconnectTestDb, setDevSession } from './setup';
import { configureSupervisedTenant } from '@/lib/agentExecution/supervisedTenant';
import { startSupervisedQualification } from '@/lib/agentExecution/supervisedQualification';
import { recordWithdrawal } from '@/lib/callReview/withdrawal';
import { ingestCallControlEvent } from '@/lib/callControl/service';
import { parseCallControlEvent } from '@/lib/providers/telnyx/callControl';
import { assertWebhookIdentity, assertStoredWebhookIdentity } from '@/lib/data/webhookEvents';

const gates = vi.hoisted(() => { vi.resetModules(); return { beforeCapture: null as null | (() => Promise<void>), beforeBackfill: null as null | (() => Promise<void>), send: vi.fn() }; });
vi.mock('@/lib/providers/telnyx/callControl', async original => ({ ...await original<typeof import('@/lib/providers/telnyx/callControl')>(), sendTelnyxCallCommand: gates.send }));
vi.mock('@/lib/callReview/consent', async original => {
  const actual = await original<typeof import('@/lib/callReview/consent')>();
  return { ...actual, withCaptureLock: async (...args: Parameters<typeof actual.withCaptureLock>) => {
    const gate = gates.beforeCapture; gates.beforeCapture = null; if (gate) await gate();
    return actual.withCaptureLock(...args);
  } };
});
vi.mock('@/lib/data/webhookEvents', async original => {
  const actual = await original<typeof import('@/lib/data/webhookEvents')>();
  return { ...actual, backfillWebhookEvent: async (...args: Parameters<typeof actual.backfillWebhookEvent>) => {
    const gate = gates.beforeBackfill; gates.beforeBackfill = null; if (gate) await gate();
    return actual.backfillWebhookEvent(...args);
  } };
});
beforeEach(async () => { await resetAndSeedTestDb(); setDevSession('operator'); gates.beforeCapture = null; gates.beforeBackfill = null; gates.send.mockReset().mockImplementation(() => { throw Error('provider forbidden'); }); vi.stubGlobal('fetch', vi.fn(() => { throw Error('network forbidden'); })); });
afterEach(() => { expect(gates.send).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });
afterAll(async () => { await disconnectTestDb(); for (const name of ['@/lib/providers/telnyx/callControl', '@/lib/callReview/consent', '@/lib/data/webhookEvents']) vi.doUnmock(name); vi.resetModules(); });

const CONFIGURATION = [
  { key: "business.knowledge", value: { facts: [{ topic: "services", statement: "VPL evaluations are available.", sourceRef: "test-approval" }], fictionalScenarios: [] } },
  { key: "notification.completed_interaction.recipient", value: { channel: "email", recipient: "owner@example.test", event: "completed_interaction", enabled: true, temporary: true } },
  { key: "operating_hours.weekly", value: { type: "always_open" } },
  { key: "operating_hours.holidays", value: { type: "always_open" } },
  { key: "service_area.coverage", value: { regions: ["South Florida"], precision: "broad_region", countyInferenceAllowed: false, locationConfirmationRequired: true, collectFromCaller: ["city", "postal_code"] } },
  { key: "contact.escalation.primary", value: { name: "Operator", phone: "+15555550123" } },
  { key: "policy.consent", value: { aiDisclosure: "This call uses an AI receptionist and may be transcribed to help with your request.", transcription: { enabled: true }, recording: { enabled: false }, refusal: { acknowledgement: "No problem. I won't collect any more details.", stopRecordingWhenSupported: true, offer: "transfer_or_callback", minimizeCollection: true } } },
];

async function fixture() {
  const configured = await configureSupervisedTenant({ accountSlug: 'race-local', businessName: 'Synthetic FRL', timezone: 'America/New_York', agentName: 'Sam', executionMode: 'SUPERVISED_PILOT', approvalRecordRef: 'synthetic', configuration: CONFIGURATION });
  if (!configured.ok) throw Error(configured.error.code);
  const started = await startSupervisedQualification({ accountSlug: 'race-local', providerNumberId: 'synthetic', e164: '+15555550188', providerAssistantId: 'synthetic', approvalRecordRef: 'synthetic' });
  if (!started.ok) throw Error(started.error.code);
  const account = await prisma.account.findUniqueOrThrow({ where: { slug: 'race-local' } });
  const assignment = await prisma.telephonyNumberAssignment.findFirstOrThrow({ where: { account_id: account.id } });
  const snapshot = await prisma.businessMemorySnapshot.findFirstOrThrow({ where: { account_id: account.id, status: 'approved' } });
  const base = Date.now() - 10000;
  const capture = await prisma.callCaptureSession.create({ data: { account_id: account.id, provider_call_id: randomUUID(), snapshot_id: snapshot.id, snapshot_json: snapshot.memory_json!, assignment_id: assignment.id, call_session_id: 'session', call_leg_id: 'leg', conversation_id: 'conversation', control_state: 'AI_ACTIVE', capture_started_at: new Date(base + 2000) } });
  await prisma.call.create({ data: { account_id: account.id, provider: 'telnyx', provider_call_id: capture.provider_call_id, direction: 'inbound', status: 'completed', from_number: '+15555550111', to_number: '+15555550188', started_at: new Date(base) } });
  await prisma.callConsentEvent.create({ data: { account_id: account.id, provider_call_id: capture.provider_call_id, action: 'grant', artifact: 'transcript', event_key: randomUUID(), disclosure_ref: 'synthetic', evidence_ref: 'synthetic', jurisdiction_basis: 'synthetic', source_channel: 'call', actor_user_id: 'operator', occurred_at: new Date(base + 1000) } });
  await prisma.telnyxCallCommand.create({ data: { account_id: account.id, capture_session_id: capture.id, assignment_id: assignment.id, command_type: 'ai_assistant_start', generation: 1, command_id: randomUUID(), provider_resource: capture.provider_call_id, request_json: {}, status: 'succeeded', provider_date_at: new Date(base + 2000), conversation_id: 'conversation' } });
  const event = (type: string, text?: string) => {
    const raw = JSON.stringify({ data: { id: randomUUID(), event_type: type, occurred_at: new Date(base + (text ? 5000 : 7000)).toISOString(), payload: { to: '+15555550188', call_control_id: capture.provider_call_id, call_session_id: 'session', call_leg_id: 'leg', conversation_id: 'conversation', client_state: Buffer.from(JSON.stringify({ captureId: capture.id, generation: 1 })).toString('base64'), ...(text ? { message_history: [{ role: 'user', content: text }] } : {}) } } });
    const parsed = parseCallControlEvent(raw)!;
    return { id: parsed.data.id, raw, ingest: () => ingestCallControlEvent({ event: parsed, rawBody: raw, verifiedBytes: Buffer.from(raw), signature: 'synthetic' }) };
  };
  return { capture, event, withdraw: () => recordWithdrawal(capture, 'operator', { eventKey: randomUUID(), disclosureRef: 'synthetic', evidenceRef: 'synthetic', jurisdictionBasis: 'synthetic' }) };
}

function barrier() {
  let entered!: () => void, release!: () => void;
  const reached = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  return { reached, release, wait: async () => { entered(); await gate; } };
}

async function assertNoContent(f: Awaited<ReturnType<typeof fixture>>, event: ReturnType<Awaited<ReturnType<typeof fixture>>['event']>, sentinel: string) {
  const row = await prisma.webhookEvent.findUniqueOrThrow({ where: { provider_provider_event_id: { provider: 'telnyx', provider_event_id: event.id } } });
  expect(await prisma.callTranscriptRevision.count({ where: { capture_session_id: f.capture.id } })).toBe(0);
  expect(await prisma.callReview.count({ where: { account_id: f.capture.account_id } })).toBe(0);
  expect(row.raw_body).not.toContain(sentinel);
  expect(JSON.parse(row.raw_body).data.payload).not.toHaveProperty('message_history');
  expect(row.process_status).toBe('rejected');
  expect(await prisma.callTranscriptRevision.count({ where: { capture_session_id: f.capture.id } })).toBe(0);
  expect(await prisma.callReview.count({ where: { account_id: f.capture.account_id } })).toBe(0);
  await prisma.$transaction(tx => assertWebhookIdentity(row.id, Buffer.from(event.raw), tx));
  await expect(prisma.$transaction(tx => assertStoredWebhookIdentity(row.id, tx))).rejects.toThrow('webhook_fingerprint_conflict');
}

test('receipt survives evidence failure; ended and duplicate/delayed history cannot retain raw content', async () => {
  const f = await fixture();
  await prisma.$executeRawUnsafe(`CREATE FUNCTION synthetic_reject_withdrawal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic withdrawal evidence failure'; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER synthetic_reject_withdrawal BEFORE INSERT ON "CallConsentEvent" FOR EACH ROW EXECUTE FUNCTION synthetic_reject_withdrawal()`);
  try { await expect(f.withdraw()).rejects.toThrow('synthetic withdrawal evidence failure'); }
  finally { await prisma.$executeRawUnsafe(`DROP TRIGGER synthetic_reject_withdrawal ON "CallConsentEvent"`); await prisma.$executeRawUnsafe(`DROP FUNCTION synthetic_reject_withdrawal()`); }
  const received = (await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).withdrawal_received_at;
  expect(received).not.toBeNull();
  expect(await prisma.callConsentEvent.count({ where: { action: 'withdraw' } })).toBe(0);
  await f.event('call.conversation.ended').ingest();
  const sentinel = 'SYNTHETIC_RECEIPT_ONLY_MUST_NOT_BE_STORED';
  const history = f.event('call.ai_gather.message_history_updated', sentinel);
  await history.ingest();
  await assertNoContent(f, history, sentinel);
  await history.ingest();
  await assertNoContent(f, history, sentinel);
  const delayed = f.event('call.ai_gather.message_history_updated', sentinel);
  await delayed.ingest(); await assertNoContent(f, delayed, sentinel);
  expect(await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).toMatchObject({ control_state: 'STOP_PENDING', withdrawal_received_at: received, content_admission_closed_at: received, call_disconnected_at: null });
});

test('durable receipt blocks concurrent ended/history while withdrawal waits for evidence phase', async () => {
  const f = await fixture(), gate = barrier();
  gates.beforeCapture = gate.wait;
  const withdrawal = f.withdraw();
  await gate.reached;
  try {
    expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).withdrawal_received_at).not.toBeNull();
    const sentinel = 'SYNTHETIC_PENDING_WITHDRAWAL';
    const history = f.event('call.ai_gather.message_history_updated', sentinel);
    await Promise.all([f.event('call.conversation.ended').ingest(), history.ingest()]);
    await assertNoContent(f, history, sentinel);
  } finally { gate.release(); await withdrawal; }
  expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).control_state).toBe('STOP_PENDING');
});

test('nonwithdrawn FINALIZING still admits history inside its capture interval', async () => {
  const f = await fixture();
  await f.event('call.conversation.ended').ingest();
  const history = f.event('call.ai_gather.message_history_updated', 'Synthetic authorized final history');
  await history.ingest();
  expect((await prisma.webhookEvent.findUniqueOrThrow({ where: { provider_provider_event_id: { provider: 'telnyx', provider_event_id: history.id } } })).raw_body).toBe(history.raw);
  expect(await prisma.callTranscriptRevision.count({ where: { capture_session_id: f.capture.id } })).toBe(1);
  expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).control_state).toBe('FINALIZING');
});

test('history admission holds a row lock until raw persistence commits; receipt then fences later history', async () => {
  const f = await fixture(), gate = barrier();
  gates.beforeBackfill = gate.wait;
  const history = f.event('call.ai_gather.message_history_updated', 'Synthetic history before receipt');
  const processing = history.ingest();
  await gate.reached;
  const withdrawal = f.withdraw();
  try {
    let receiptCommitted = false, receiptWaiting = false;
    for (let attempt = 0; attempt < 100 && !receiptCommitted && !receiptWaiting; attempt++) {
      receiptCommitted = (await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).withdrawal_received_at !== null;
      const waiting = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE 'UPDATE%CallCaptureSession%'`;
      receiptWaiting = Number(waiting[0].count) > 0;
      if (!receiptCommitted && !receiptWaiting) await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(receiptCommitted).toBe(false);
    expect(receiptWaiting).toBe(true);
  } finally { gate.release(); await Promise.all([processing, withdrawal]); }
  expect(await prisma.callTranscriptRevision.count({ where: { capture_session_id: f.capture.id } })).toBe(1);
  expect((await prisma.webhookEvent.findUniqueOrThrow({ where: { provider_provider_event_id: { provider: 'telnyx', provider_event_id: history.id } } })).raw_body).toBe(history.raw);
  const delayed = f.event('call.ai_gather.message_history_updated', 'SYNTHETIC_AFTER_RECEIPT');
  await delayed.ingest();
  expect((await prisma.webhookEvent.findUniqueOrThrow({ where: { provider_provider_event_id: { provider: 'telnyx', provider_event_id: delayed.id } } })).raw_body).not.toContain('SYNTHETIC_AFTER_RECEIPT');
  expect(await prisma.callTranscriptRevision.count({ where: { capture_session_id: f.capture.id } })).toBe(1);
});
