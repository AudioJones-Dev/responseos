import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { prisma, resetAndSeedTestDb, disconnectTestDb, setDevSession } from './setup';
import { configureSupervisedTenant } from '@/lib/agentExecution/supervisedTenant';
import { startSupervisedQualification } from '@/lib/agentExecution/supervisedQualification';
import { POST } from '@/app/api/admin/call-capture/[id]/end-call/route';
import { loadCallReviewConsole } from '@/lib/callReview/service';
import { recordWebhookEvent } from '@/lib/data/webhookEvents';
import { callHasWithdrawal } from '@/lib/callReview/withdrawal';
import { ingestCallControlEvent } from '@/lib/callControl/service';
import { endCaptureCall } from '@/lib/callControl/endCall';
import { persistWithdrawalReceipt, drainWithdrawal, withdrawalProgress, withdrawalReceiptDb } from '@/lib/callReview/withdrawalReceipt';
import { parseCallControlEvent } from '@/lib/providers/telnyx/callControl';


const boundaries = vi.hoisted(() => ({ claimed: undefined as (() => Promise<void>) | undefined, authorized: undefined as (() => Promise<void>) | undefined }));
const send = vi.hoisted(() => { vi.resetModules(); return vi.fn(); });
vi.mock('@/lib/providers/telnyx/callControl', async original => ({ ...await original<typeof import('@/lib/providers/telnyx/callControl')>(), sendTelnyxCallCommand: send }));
vi.mock('@/lib/callReview/consent', async original => {
  const actual = await original<typeof import('@/lib/callReview/consent')>();
  return { ...actual, withCaptureLock: async (...args: Parameters<typeof actual.withCaptureLock>) => {
    const result = await actual.withCaptureLock(...args);
    if (result && typeof result === 'object' && 'dispatch' in result && result.dispatch) {
      const key = 'target' in result ? 'authorized' : 'command' in result ? 'claimed' : null;
      if (key && boundaries[key]) { const hook = boundaries[key]!; boundaries[key] = undefined; await hook(); }
    }
    return result;
  } };
});
beforeEach(async () => { boundaries.claimed = undefined; boundaries.authorized = undefined; await resetAndSeedTestDb(); send.mockReset().mockResolvedValue({ok:true,status:200,providerDate:null,errorCode:null}); setDevSession('operator'); vi.stubGlobal('fetch', vi.fn(() => { throw Error('provider/network effect forbidden'); })); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });
afterAll(async () => { await withdrawalReceiptDb?.$disconnect(); await disconnectTestDb(); vi.doUnmock("@/lib/providers/telnyx/callControl"); vi.doUnmock("@/lib/callReview/consent"); vi.resetModules(); });
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
  const configured = await configureSupervisedTenant({ accountSlug:'transfer-local', businessName:'Synthetic FRL', timezone:'America/New_York', agentName:'Sam', executionMode:'SUPERVISED_PILOT', approvalRecordRef:'synthetic', configuration:CONFIGURATION });
  if (!configured.ok) throw Error(configured.error.code);
  const started = await startSupervisedQualification({ accountSlug:'transfer-local', providerNumberId:'synthetic', e164:'+15555550188', providerAssistantId:'synthetic', approvalRecordRef:'synthetic' });
  if (!started.ok) throw Error(started.error.code);
  const account = await prisma.account.findUniqueOrThrow({ where:{slug:'transfer-local'} });
  const assignment = await prisma.telephonyNumberAssignment.findFirstOrThrow({ where:{account_id:account.id} });
  const snapshot = await prisma.businessMemorySnapshot.findFirstOrThrow({ where:{account_id:account.id,status:'approved'} });
  const capture = await prisma.callCaptureSession.create({ data:{account_id:account.id,provider_call_id:randomUUID(),snapshot_id:snapshot.id,snapshot_json:snapshot.memory_json!,assignment_id:assignment.id,call_session_id:'session',call_leg_id:'leg',conversation_id:'conversation',control_state:'STOPPED',withdrawal_received_at:new Date(),content_admission_closed_at:new Date()} });
  const call = await prisma.call.create({data:{account_id:account.id,provider:'telnyx',provider_call_id:capture.provider_call_id,direction:'inbound',status:'completed',from_number:'+15555550111',to_number:'+15555550188',started_at:new Date()}});
  const activeId=randomUUID();
  const activeBody=JSON.stringify({data:{id:activeId,event_type:'call.answered',occurred_at:new Date().toISOString(),payload:{call_control_id:capture.provider_call_id,call_session_id:'session',call_leg_id:'leg',client_state:Buffer.from(JSON.stringify({captureId:capture.id,generation:1})).toString('base64')}}});
  const active=await recordWebhookEvent({account_id:account.id,provider:'telnyx',provider_call_id:capture.provider_call_id,provider_event_id:activeId,event_type:'call.answered',raw_body:activeBody,verifiedBytes:Buffer.from(activeBody),signature_valid:true});
  if(!active.ok) throw Error(active.error.code);
  const input = {expectedAccountId:account.id,expectedProviderCallId:capture.provider_call_id,generation:1};
  const post = (body:unknown=input) => POST(new Request('http://localhost',{method:'POST',body:JSON.stringify(body)}),{params:Promise.resolve({id:capture.id})});
  return {capture,call,input,post};
}

test('concurrent End call dispatches once, persists actor and leaves withdrawal terminal', async () => {
  const f = await fixture();
  const results = await Promise.all([f.post(), f.post(), f.post()]);
  expect(results.map(r => r.status)).toEqual([202,202,202]);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0]).toMatchObject({ action:'hangup', callControlId:f.capture.provider_call_id });
  expect(await prisma.telnyxCallCommand.count()).toBe(1);
  expect(await prisma.auditLog.count({where:{action:'call_end_requested',account_id:f.capture.account_id}})).toBe(1);
  expect(await callHasWithdrawal(f.capture.account_id,f.call.id)).toBe(true);
  expect(await prisma.callConsentEvent.count({where:{account_id:f.capture.account_id}})).toBe(0);
  expect(await prisma.callCaptureSession.findUniqueOrThrow({where:{id:f.capture.id}})).toMatchObject({control_state:'STOPPED',withdrawal_received_at:f.capture.withdrawal_received_at});
  expect((await loadCallReviewConsole()).captures.find(c=>c.id===f.capture.id)?.disconnection.confirmed).toBe(false);
});

test.each(['uncertain','failed','throw'])('never resends %s results', async outcome => {
  const f=await fixture();
  if(outcome==='throw') send.mockRejectedValue(Error('synthetic lost response'));
  else send.mockResolvedValue({ok:false,status:outcome==='failed'?400:0,providerDate:null,errorCode:outcome==='uncertain'?'telnyx_response_uncertain':'synthetic'});
  await f.post(); await f.post(); await f.post();
  expect(send).toHaveBeenCalledTimes(1);
  expect(await prisma.telnyxCallCommand.count()).toBe(1);
  expect((await loadCallReviewConsole()).captures.find(c=>c.id===f.capture.id)?.disconnection.confirmed).toBe(false);
});

test.each(['expectedAccountId','expectedProviderCallId','generation'] as const)('rejects stale or cross-target %s before dispatch', async key => {
  const f=await fixture(); expect((await f.post({...f.input,[key]:key==='generation'?2:'wrong'})).status).toBe(409); expect(send).not.toHaveBeenCalled();
});

test('clients and anonymous requests cannot end calls or read evidence', async () => {
  const f=await fixture();
  for(const role of ['client_admin@org_mock_1','client_viewer@org_mock_1']) {
    setDevSession(role); expect((await f.post()).status).toBe(403); await expect(loadCallReviewConsole()).rejects.toThrow('operator_required');
  }
  delete process.env.RESPONSEOS_DEV_SESSION; process.env.RESPONSEOS_REQUIRE_AUTH = 'true';
  try { expect((await f.post()).status).toBe(403); await expect(loadCallReviewConsole()).rejects.toThrow('operator_required'); } finally { delete process.env.RESPONSEOS_REQUIRE_AUTH; }
  expect(send).not.toHaveBeenCalled();
});

async function ingest(f: Awaited<ReturnType<typeof fixture>>, type: string, overrides: Record<string,unknown> = {}, occurredAt = new Date()) {
  const raw=JSON.stringify({data:{id:randomUUID(),event_type:type,occurred_at:occurredAt.toISOString(),payload:{call_control_id:f.capture.provider_call_id,call_session_id:'session',call_leg_id:'leg',client_state:Buffer.from(JSON.stringify({captureId:f.capture.id,generation:1})).toString('base64'),...overrides}}});
  return ingestCallControlEvent({event:parseCallControlEvent(raw)!,rawBody:raw,verifiedBytes:Buffer.from(raw),signature:'synthetic'});
}

async function hangup(f: Awaited<ReturnType<typeof fixture>>, overrides: Record<string,unknown> = {}, signed = true) {
  const id=randomUUID();
  const value={data:{id,event_type:'call.hangup',occurred_at:new Date().toISOString(),payload:{call_control_id:f.capture.provider_call_id,call_session_id:'session',call_leg_id:'leg',client_state:Buffer.from(JSON.stringify({captureId:f.capture.id,generation:1})).toString('base64'),...overrides}}};
  const raw=JSON.stringify(value);
  if (!signed) return (await prisma.webhookEvent.create({data:{account_id:f.capture.account_id,provider:'telnyx',provider_call_id:f.capture.provider_call_id,provider_event_id:id,event_type:'call.hangup',raw_body:raw,dedupe_hash:id,signature_valid:false}})).id;
  const row=await recordWebhookEvent({account_id:f.capture.account_id,provider:'telnyx',provider_call_id:f.capture.provider_call_id,provider_event_id:id,event_type:'call.hangup',raw_body:raw,verifiedBytes:signed?Buffer.from(raw):undefined,signature_valid:signed});
  if(!row.ok) throw Error(row.error.code);
  return row.data.id;
}

test.each(['STOPPED','STOP_PENDING'] as const)('authenticated exact hangup is visible for withdrawn %s without reopening consent', async state => {
  const f=await fixture(); await prisma.callCaptureSession.update({where:{id:f.capture.id},data:{control_state:state}});
  await hangup(f);
  const capture=(await loadCallReviewConsole()).captures.find(c=>c.id===f.capture.id)!;
  expect(capture.disconnection.confirmed).toBe(true); expect(capture.consentAction).toBe('withdraw');
  expect((await f.post()).status).toBe(200); expect(send).not.toHaveBeenCalled();
  expect(await prisma.callConsentEvent.count({where:{account_id:f.capture.account_id}})).toBe(0);
});

test('wrong call, leg, session, generation and unsigned hangups cannot confirm disconnection', async () => {
  const f=await fixture();
  for(const p of [{call_control_id:'other'},{call_session_id:'other'},{call_leg_id:'other'},{client_state:Buffer.from(JSON.stringify({captureId:f.capture.id,generation:2})).toString('base64')},{client_state:''}]) await hangup(f,p);
  await hangup(f,{},false);
  expect((await loadCallReviewConsole()).captures.find(c=>c.id===f.capture.id)?.disconnection.confirmed).toBe(false);
});

test('mutated signed body cannot confirm disconnection', async () => {
  const f=await fixture(); const id=await hangup(f);
  await prisma.webhookEvent.update({where:{id},data:{raw_body:'{}'}});
  expect((await loadCallReviewConsole()).captures.find(c=>c.id===f.capture.id)?.disconnection.confirmed).toBe(false);
});

test('provider acceptance followed by database failure leaves durable uncertainty and cannot resend', async () => {
  const f=await fixture();
  await prisma.$executeRawUnsafe(`CREATE FUNCTION synthetic_reject_end_result() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic result persistence failure'; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER synthetic_reject_end_result BEFORE UPDATE ON "TelnyxCallCommand" FOR EACH ROW WHEN (NEW.reconciliation_state = 'awaiting_authenticated_disconnection') EXECUTE FUNCTION synthetic_reject_end_result()`);
  try {
    expect((await f.post()).status).toBe(503);
    expect(send).toHaveBeenCalledTimes(1);
    expect(await prisma.telnyxCallCommand.findFirstOrThrow({where:{capture_session_id:f.capture.id}})).toMatchObject({status:'uncertain',reconciliation_state:'operator_end_call_authorized'});
    expect((await f.post()).status).toBe(202); expect(send).toHaveBeenCalledTimes(1);
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER synthetic_reject_end_result ON "TelnyxCallCommand"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION synthetic_reject_end_result()`);
  }
});

test('expired hangup cannot enable a dispatch and does not return historical proof details', async () => {
  const f=await fixture();
  const prior=process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS;
  process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS='1';
  try { await hangup(f); } finally { process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS=prior; }
  await prisma.$executeRaw`SELECT pg_sleep(1.1)`;
  const row=(await loadCallReviewConsole()).captures.find(c=>c.id===f.capture.id)!;
  expect(row.disconnection).toMatchObject({state:'expired',confirmed:false,eventId:null,occurredAt:null});
  expect(row.endCall.allowed).toBe(false);
  expect((await f.post()).status).toBe(409); expect(send).not.toHaveBeenCalled();
});

test('erased unidentifiable hangup blocks account calls without restoring erased correlation', async () => {
  const f=await fixture(); const id=await hangup(f);
  await prisma.$executeRaw`SELECT erase_webhook_early(${id}, ${f.capture.account_id}, 'synthetic-approval', 'authorized_deletion')`;
  const erased=await prisma.webhookEvent.findUniqueOrThrow({where:{id}});
  expect(erased.provider_call_id).toBeNull();
  const row=(await loadCallReviewConsole()).captures.find(c=>c.id===f.capture.id)!;
  expect(row.disconnection).toMatchObject({state:'erased',confirmed:false,eventId:null});
  expect(row.endCall.allowed).toBe(false);
  expect((await f.post()).status).toBe(409); expect(send).not.toHaveBeenCalled();
});

test.each(['STOP_PENDING','FINALIZING'] as const)('stored capture end with %s alone does not block End call', async state => {
  const f=await fixture();
  await prisma.callCaptureSession.update({where:{id:f.capture.id},data:{capture_ended_at:new Date(),control_state:state}});
  const row=(await loadCallReviewConsole()).captures.find(c=>c.id===f.capture.id)!;
  expect(row.call_disconnected_at).toBeNull();
  expect(row.endCall).toEqual({allowed:true,reason:'fresh_exact_active_evidence'});
  expect((await f.post()).status).toBe(202); expect(send).toHaveBeenCalledTimes(1);
  expect(await prisma.callCaptureSession.findUniqueOrThrow({where:{id:f.capture.id}})).toMatchObject({control_state:state});
});

test('missing fresh active identity fails closed; normalized completed is not disconnection proof', async () => {
  const f=await fixture();
  expect((await loadCallReviewConsole()).captures.find(c=>c.id===f.capture.id)?.disconnection.confirmed).toBe(false);
  await prisma.webhookEvent.updateMany({where:{event_type:'call.answered'},data:{raw_body:'{}'}});
  expect((await f.post()).status).toBe(409); expect(send).not.toHaveBeenCalled();
});

test('a prior generation hangup claim cannot be resent after generation changes', async () => {
  const f=await fixture(); await f.post();
  await prisma.callCaptureSession.update({where:{id:f.capture.id},data:{generation:2}});
  expect((await f.post({...f.input,generation:2})).status).toBe(409);
  expect(send).toHaveBeenCalledTimes(1); expect(await prisma.telnyxCallCommand.count()).toBe(1);
});

test('verified exact hangup records disconnection for an already withdrawn STOPPED call', async () => {
  const f=await fixture();
  const occurredAt=new Date();
  await ingest(f,'call.hangup',{},occurredAt);
  const ended=await prisma.callCaptureSession.findUniqueOrThrow({where:{id:f.capture.id}});
  expect(ended.capture_ended_at).not.toBeNull();
  expect(ended.call_disconnected_at).toEqual(occurredAt);
  expect(ended.control_state).toBe('STOPPED');
  expect(ended.withdrawal_received_at).toEqual(f.capture.withdrawal_received_at);
  expect((await loadCallReviewConsole()).captures.find(c=>c.id===f.capture.id)?.endCall).toEqual({allowed:false,reason:'call_disconnected'});
  expect(send).not.toHaveBeenCalled();
});

test('proof expiry after a claim never releases the claim for retry', async () => {
  const f=await fixture(); await f.post();
  const prior=process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS;
  process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS='1';
  try { await hangup(f); } finally { process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS=prior; }
  await prisma.$executeRaw`SELECT pg_sleep(1.1)`;
  expect((await f.post()).status).toBe(202);
  expect(send).toHaveBeenCalledTimes(1);
  expect(await prisma.telnyxCallCommand.count()).toBe(1);
});

test.each([true,false])('withdrawal then conversation.ended keeps End call available and dispatches exactly once (withdraw event recorded: %s)', async recorded => {
  const f=await fixture();
  await prisma.callCaptureSession.update({where:{id:f.capture.id},data:{control_state:'STOP_PENDING'}});
  if(recorded) await prisma.callConsentEvent.create({data:{account_id:f.capture.account_id,provider_call_id:f.capture.provider_call_id,event_key:randomUUID(),action:'withdraw',artifact:'transcript',disclosure_ref:'synthetic',evidence_ref:'synthetic',jurisdiction_basis:'synthetic',source_channel:'operator',actor_user_id:'synthetic',occurred_at:f.capture.withdrawal_received_at!}});
  await ingest(f,'call.conversation.ended');
  const ended=await prisma.callCaptureSession.findUniqueOrThrow({where:{id:f.capture.id}});
  expect(ended).toMatchObject({control_state:'STOP_PENDING',call_disconnected_at:null,withdrawal_received_at:f.capture.withdrawal_received_at});
  expect(ended.capture_ended_at).not.toBeNull();
  const row=(await loadCallReviewConsole()).captures.find(c=>c.id===f.capture.id)!;
  expect(row.disconnection.state).toBe('absent');
  expect(row.endCall).toEqual({allowed:true,reason:'fresh_exact_active_evidence'});
  const results=await Promise.all([f.post(),f.post(),f.post()]);
  expect(results.map(r=>r.status)).toEqual([202,202,202]);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0]).toMatchObject({action:'hangup',callControlId:f.capture.provider_call_id});
  expect(await prisma.telnyxCallCommand.count()).toBe(1);
  expect(await prisma.callCaptureSession.findUniqueOrThrow({where:{id:f.capture.id}})).toMatchObject({control_state:ended.control_state,withdrawal_received_at:f.capture.withdrawal_received_at});
  await ingest(f,'call.hangup');
  expect((await prisma.callCaptureSession.findUniqueOrThrow({where:{id:f.capture.id}})).call_disconnected_at).not.toBeNull();
  await f.post();
  expect(send).toHaveBeenCalledTimes(1);
  expect(await prisma.callConsentEvent.count({where:{account_id:f.capture.account_id}})).toBe(recorded?1:0);
});

test('mismatched hangups never record disconnection and keep the ambiguity veto', async () => {
  const f=await fixture();
  for(const p of [{call_control_id:'other-leg-same-session'},{call_session_id:'other'},{call_leg_id:'other'},{client_state:Buffer.from(JSON.stringify({captureId:f.capture.id,generation:2})).toString('base64')},{client_state:Buffer.from(JSON.stringify({captureId:'other',generation:1})).toString('base64')},{client_state:''}]) await ingest(f,'call.hangup',p);
  expect((await prisma.callCaptureSession.findUniqueOrThrow({where:{id:f.capture.id}})).call_disconnected_at).toBeNull();
  const row=(await loadCallReviewConsole()).captures.find(c=>c.id===f.capture.id)!;
  expect(row.disconnection.confirmed).toBe(false);
  expect(row.endCall).toEqual({allowed:false,reason:'disconnection_evidence_unavailable'});
  expect((await f.post()).status).toBe(409); expect(send).not.toHaveBeenCalled();
});

test('raw proof expiry after verified disconnection keeps the recorded fact and never re-enables End call', async () => {
  const f=await fixture();
  const prior=process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS;
  process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS='2';
  try { await ingest(f,'call.hangup'); } finally { process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS=prior; }
  const recorded=(await prisma.callCaptureSession.findUniqueOrThrow({where:{id:f.capture.id}})).call_disconnected_at;
  expect(recorded).not.toBeNull();
  await prisma.$executeRaw`SELECT pg_sleep(2.1)`;
  const row=(await loadCallReviewConsole()).captures.find(c=>c.id===f.capture.id)!;
  expect(row.disconnection).toMatchObject({state:'expired',confirmed:false,eventId:null,occurredAt:null});
  expect(row.call_disconnected_at).toEqual(recorded);
  expect(row.endCall).toEqual({allowed:false,reason:'call_disconnected'});
  expect((await f.post()).status).toBe(409); expect(send).not.toHaveBeenCalled();
});

test('recorded disconnection cannot be cleared, changed or overwritten by a later hangup', async () => {
  const f=await fixture();
  const first=new Date(Date.now()-5_000);
  await ingest(f,'call.hangup',{},first);
  await ingest(f,'call.hangup',{},new Date());
  expect((await prisma.callCaptureSession.findUniqueOrThrow({where:{id:f.capture.id}})).call_disconnected_at).toEqual(first);
  await expect(prisma.callCaptureSession.update({where:{id:f.capture.id},data:{call_disconnected_at:null}})).rejects.toThrow(/call_disconnection_is_permanent/);
  await expect(prisma.callCaptureSession.update({where:{id:f.capture.id},data:{call_disconnected_at:new Date()}})).rejects.toThrow(/call_disconnection_is_permanent/);
  expect((await prisma.callCaptureSession.findUniqueOrThrow({where:{id:f.capture.id}})).call_disconnected_at).toEqual(first);
});

function barrier() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }

test('operator authorization commits before send and pins destination across later mutation', async () => {
  const f = await fixture();
  boundaries.authorized = async () => {
    const command = await prisma.telnyxCallCommand.findFirstOrThrow({ where: { capture_session_id: f.capture.id } });
    expect(command).toMatchObject({ status: 'uncertain', reconciliation_state: 'operator_end_call_authorized' });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'call_end_authorized', target_id: f.capture.id } });
    expect(audit.metadata_json).toMatchObject({ accountId: f.capture.account_id, captureId: f.capture.id, callControlId: f.capture.provider_call_id, callSessionId: 'session', callLegId: 'leg', generation: 1, commandId: command.command_id, authority: 'one_shot_after_commit' });
    await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { generation: 2, call_session_id: 'later-session', call_leg_id: 'later-leg', assignment_id: 'later-assignment' } });
    await prisma.telephonyNumberAssignment.update({ where: { id: f.capture.assignment_id! }, data: { status: 'active' } });
  };
  expect((await f.post()).status).toBe(202);
  expect(send).toHaveBeenCalledTimes(1);
  const sent = send.mock.calls[0][0];
  expect(sent.callControlId).toBe(f.capture.provider_call_id);
  expect(JSON.parse(Buffer.from(sent.body.client_state, 'base64').toString())).toEqual({ captureId: f.capture.id, generation: 1 });
  expect(await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).toMatchObject({ generation: 2, control_state: 'STOPPED', withdrawal_received_at: f.capture.withdrawal_received_at });
  await f.post({ ...f.input, generation: 2 });
  expect(send).toHaveBeenCalledTimes(1);
});

test.each(['generation', 'session', 'leg', 'assignment', 'qualification', 'hangup', 'active-proof', 'command'] as const)('final validation vetoes changed %s after reservation and never resends', async field => {
  const f = await fixture();
  boundaries.claimed = async () => {
    if (field === 'generation') await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { generation: 2 } });
    if (field === 'session') await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { call_session_id: 'other' } });
    if (field === 'leg') await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { call_leg_id: 'other' } });
    if (field === 'assignment') await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { assignment_id: 'other' } });
    if (field === 'qualification') await prisma.telephonyNumberAssignment.update({ where: { id: f.capture.assignment_id! }, data: { status: 'active' } });
    if (field === 'hangup') await ingest(f, 'call.hangup');
    if (field === 'active-proof') await prisma.webhookEvent.updateMany({ where: { event_type: 'call.answered' }, data: { raw_body: '{}' } });
    if (field === 'command') await prisma.telnyxCallCommand.updateMany({ where: { capture_session_id: f.capture.id }, data: { provider_resource: 'other' } });
  };
  await f.post(); await f.post();
  expect(send).not.toHaveBeenCalled();
  expect(await prisma.telnyxCallCommand.count()).toBe(1);
  expect(await prisma.auditLog.count({ where: { action: 'call_end_authorized' } })).toBe(0);
});

test.each(['claimed', 'authorized'] as const)('lost %s commit acknowledgement leaves a permanent claim with no replay', async boundary => {
  const f = await fixture();
  boundaries[boundary] = async () => { throw Error('synthetic lost commit acknowledgement'); };
  expect((await f.post()).status).toBe(503);
  expect((await f.post()).status).toBe(202);
  expect(send).not.toHaveBeenCalled();
  expect(await prisma.telnyxCallCommand.findFirstOrThrow()).toMatchObject({ status: 'uncertain', reconciliation_state: boundary === 'authorized' ? 'operator_end_call_authorized' : 'end_call_dispatch_claimed' });
  expect(await prisma.auditLog.count({ where: { action: 'call_end_authorized' } })).toBe(boundary === 'authorized' ? 1 : 0);
});

test('historical qualification remains eligible after assignment end', async () => {
  const f = await fixture();
  boundaries.claimed = async () => { await prisma.telephonyNumberAssignment.update({ where: { id: f.capture.assignment_id! }, data: { unassigned_at: new Date(), number_exclusivity_key: null } }); };
  expect((await f.post()).status).toBe(202);
  expect(send).toHaveBeenCalledTimes(1);
});

test('stalled operator send holds no transaction or locks; duplicates, exact hangup and receipt/drain proceed', async () => {
  const f = await fixture(), entered = barrier(), release = barrier();
  send.mockImplementationOnce(async () => { entered.resolve(); await release.promise; return { ok: true, status: 200, providerDate: null, errorCode: null }; });
  const pending = f.post();
  await entered.promise;
  try {
    expect((await f.post()).status).toBe(202);
    const transactions = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND xact_start IS NOT NULL`;
    expect(Number(transactions[0].count)).toBe(0);
    const locks = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.datname=current_database() AND a.pid<>pg_backend_pid() AND l.locktype IN ('advisory','tuple','relation')`;
    expect(Number(locks[0].count)).toBe(0);
    await persistWithdrawalReceipt(f.capture, 'operator', { eventKey: randomUUID(), disclosureRef: 'synthetic', evidenceRef: 'synthetic', jurisdictionBasis: 'synthetic' });
    await drainWithdrawal(f.capture);
    expect(await withdrawalProgress(f.capture)).toMatchObject({ receipt: 'recorded', drain: 'confirmed' });
    await ingest(f, 'call.hangup');
    const disconnected = await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } });
    expect(disconnected.call_disconnected_at).not.toBeNull();
    expect(disconnected.withdrawal_drained_at).not.toBeNull();
    expect((await f.post()).status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
  } finally { release.resolve(); }
  expect((await pending).status).toBe(202);
  const final = await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } });
  expect(final).toMatchObject({ control_state: 'STOPPED', withdrawal_received_at: f.capture.withdrawal_received_at });
  expect(final.call_disconnected_at).not.toBeNull();
  expect(final.withdrawal_drained_at).not.toBeNull();
  await expect(prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { call_disconnected_at: null } })).rejects.toThrow('call_disconnection_is_permanent');
  await expect(prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { withdrawal_drained_at: null } })).rejects.toThrow('withdrawal_drain_is_permanent');
});

test('result persistence fails closed if the command identity changes during send', async () => {
  const f = await fixture();
  send.mockImplementationOnce(async () => {
    await prisma.telnyxCallCommand.updateMany({ where: { capture_session_id: f.capture.id }, data: { provider_resource: 'tampered' } });
    return { ok: true, status: 200, providerDate: null, errorCode: null };
  });
  expect((await f.post()).status).toBe(503);
  expect(await prisma.telnyxCallCommand.findFirstOrThrow()).toMatchObject({ status: 'uncertain', reconciliation_state: 'operator_end_call_authorized' });
  await f.post(); expect(send).toHaveBeenCalledTimes(1);
});

test('actorless automatic End call retains its existing locked dispatch without operator authority', async () => {
  const f = await fixture(), entered = barrier(), release = barrier();
  send.mockImplementationOnce(async () => { entered.resolve(); await release.promise; return { ok: true, status: 200, providerDate: null, errorCode: null }; });
  const pending = endCaptureCall({ captureId: f.capture.id, ...f.input });
  await entered.promise;
  try {
    expect(await prisma.auditLog.count({ where: { action: 'call_end_authorized' } })).toBe(0);
    expect(await prisma.telnyxCallCommand.findFirstOrThrow()).toMatchObject({ reconciliation_state: 'end_call_dispatch_claimed' });
    await persistWithdrawalReceipt(f.capture, 'operator', { eventKey: randomUUID(), disclosureRef: 'synthetic', evidenceRef: 'synthetic', jurisdictionBasis: 'synthetic' });
    await expect(drainWithdrawal(f.capture)).rejects.toThrow();
    expect((await withdrawalProgress(f.capture)).drain).toBe('pending');
  } finally { release.resolve(); }
  await pending; await drainWithdrawal(f.capture);
  expect(send).toHaveBeenCalledTimes(1);
  expect((await withdrawalProgress(f.capture)).drain).toBe('confirmed');
});