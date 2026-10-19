import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { prisma, resetAndSeedTestDb, disconnectTestDb, setDevSession } from './setup';
import { configureSupervisedTenant } from '@/lib/agentExecution/supervisedTenant';
import { startSupervisedQualification } from '@/lib/agentExecution/supervisedQualification';
import { POST } from '@/app/api/admin/call-capture/[id]/withdrawal-transfer/route';
import { callHasWithdrawal } from '@/lib/callReview/withdrawal';


beforeEach(async () => { await resetAndSeedTestDb(); setDevSession('operator'); vi.stubGlobal('fetch', vi.fn(() => { throw Error('provider/network effect forbidden'); })); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });
afterAll(disconnectTestDb);
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
  const input = {expectedAccountId:account.id,expectedSnapshotId:snapshot.id,generation:1,destination:'+15555550123'};
  const post = (body:unknown=input) => POST(new Request('http://localhost',{method:'POST',body:JSON.stringify(body)}),{params:Promise.resolve({id:capture.id})});
  return {capture,call,input,post};
}
test('hard-disabled exact-target preflight is stable under duplicate/concurrent requests, even with successful stop command', async () => {
  const f=await fixture();
  await prisma.telnyxCallCommand.create({data:{account_id:f.capture.account_id,capture_session_id:f.capture.id,assignment_id:f.capture.assignment_id!,command_type:'ai_assistant_stop',generation:1,command_id:randomUUID(),provider_resource:f.capture.provider_call_id,request_json:{},status:'succeeded',provider_response_status:200,provider_responded_at:new Date()}});
  const before=await prisma.callCaptureSession.findUniqueOrThrow({where:{id:f.capture.id}});
  const responses=await Promise.all([f.post(),f.post()]);
  expect(responses.map(r=>r.status)).toEqual([423,423]);
  const results=await Promise.all(responses.map(r=>r.json()));
  expect(results[0]).toEqual(results[1]);
  expect(results[0]).toMatchObject({error:'qualified_stop_recording_evidence_adapter_unavailable',data:{enabled:false,attempted:false,connected:false,announcement:'omitted_no_approved_wording'}});
  expect(await prisma.callCaptureSession.findUniqueOrThrow({where:{id:f.capture.id}})).toEqual(before);
  expect(await prisma.telnyxCallCommand.count()).toBe(1);
  expect(await prisma.callConsentEvent.count({where:{account_id:f.capture.account_id}})).toBe(0);
  expect(await callHasWithdrawal(f.capture.account_id,f.call.id)).toBe(true);
  expect(await prisma.crmSyncOperation.count()).toBe(0); expect(await prisma.notification.count()).toBe(0);
});
test.each(['expectedAccountId','expectedSnapshotId','generation','destination'] as const)('rejects changed %s', async key => {
  const f=await fixture(); expect((await f.post({...f.input,[key]:key==='generation'?2:key==='destination'?'+15555550999':'wrong'})).status).toBe(409);
});
test('rejects client authorization and caller-provided synthetic proof or wording', async () => {
  const f=await fixture(); setDevSession('client_admin@org_mock_1'); expect((await f.post()).status).toBe(403); setDevSession('operator');
  expect((await f.post({...f.input,evidence:{kind:'synthetic_only',recording:'off'}})).status).toBe(422);
  expect((await f.post({...f.input,announcement:'arbitrary'})).status).toBe(422);
});
test('unknown recording policy remains blocked and generation changes invalidate the displayed target', async () => {
  const f=await fixture();
  await prisma.callCaptureSession.update({where:{id:f.capture.id},data:{snapshot_json:{},generation:2}});
  expect((await f.post()).status).toBe(409);
  expect((await f.post({...f.input,generation:2})).status).toBe(409);
});
test('preflight does not reopen grant or content admission', async () => {
  const f=await fixture(); await f.post();
  await expect(prisma.callCaptureSession.update({where:{id:f.capture.id},data:{control_state:'AI_ACTIVE'}})).rejects.toThrow();
  expect(await callHasWithdrawal(f.capture.account_id,f.call.id)).toBe(true);
  expect(await prisma.callTranscriptRevision.count()).toBe(0);
});
