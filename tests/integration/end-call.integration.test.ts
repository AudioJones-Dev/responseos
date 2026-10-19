import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { prisma, resetAndSeedTestDb, disconnectTestDb, setDevSession } from './setup';
import { configureSupervisedTenant } from '@/lib/agentExecution/supervisedTenant';
import { startSupervisedQualification } from '@/lib/agentExecution/supervisedQualification';
import { POST } from '@/app/api/admin/call-capture/[id]/end-call/route';
import { loadCallReviewConsole } from '@/lib/callReview/service';
import { recordWebhookEvent } from '@/lib/data/webhookEvents';
import { callHasWithdrawal } from '@/lib/callReview/withdrawal';


const send = vi.hoisted(() => { vi.resetModules(); return vi.fn(); });
vi.mock('@/lib/providers/telnyx/callControl', async original => ({ ...await original<typeof import('@/lib/providers/telnyx/callControl')>(), sendTelnyxCallCommand: send }));
beforeEach(async () => { await resetAndSeedTestDb(); send.mockReset().mockResolvedValue({ok:true,status:200,providerDate:null,errorCode:null}); setDevSession('operator'); vi.stubGlobal('fetch', vi.fn(() => { throw Error('provider/network effect forbidden'); })); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });
afterAll(async () => { await disconnectTestDb(); vi.doUnmock("@/lib/providers/telnyx/callControl"); vi.resetModules(); });
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
  await prisma.$executeRawUnsafe(`CREATE TRIGGER synthetic_reject_end_result BEFORE UPDATE ON "TelnyxCallCommand" FOR EACH ROW EXECUTE FUNCTION synthetic_reject_end_result()`);
  try {
    expect((await f.post()).status).toBe(503);
    expect(send).toHaveBeenCalledTimes(1);
    expect(await prisma.telnyxCallCommand.findFirstOrThrow({where:{capture_session_id:f.capture.id}})).toMatchObject({status:'uncertain',reconciliation_state:'end_call_dispatch_claimed'});
    expect((await f.post()).status).toBe(202); expect(send).toHaveBeenCalledTimes(1);
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER synthetic_reject_end_result ON "TelnyxCallCommand"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION synthetic_reject_end_result()`);
  }
});
