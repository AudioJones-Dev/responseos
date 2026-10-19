import { expect, test, vi } from "vitest";
import type { CallCaptureSession, Prisma } from "@prisma/client";
import { disconnectionEvidence, endCallEligibility } from "@/lib/callControl/endCall";
const verify = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/webhookEvents", () => ({ assertStoredWebhookIdentity: verify }));
const capture={id:'capture',account_id:'account',provider_call_id:'call',call_session_id:'session',call_leg_id:'leg',generation:1} as CallCaptureSession;
const body=(call='call')=>JSON.stringify({data:{id:'event',event_type:'call.hangup',occurred_at:'2026-10-19T00:00:00Z',payload:{call_control_id:call,call_session_id:'session',call_leg_id:'leg',client_state:Buffer.from(JSON.stringify({captureId:'capture',generation:1})).toString('base64')}}});
const row={id:'row',account_id:'account',provider:'telnyx',provider_call_id:'call',provider_event_id:'event',event_type:'call.hangup',signature_valid:true,received_at:new Date(),raw_body:body()};
const client={$queryRaw:async()=>[{now:new Date()}],webhookEvent:{findMany:async()=>[row],findUnique:async()=>({...row,payload_expires_at:new Date(Date.now()+100000)})}} as unknown as Prisma.TransactionClient;
test('uses the verified locked original rather than a stale pre-lock projection', async () => {
  verify.mockResolvedValue({...row,raw_body:body('other')});
  expect((await disconnectionEvidence(capture,client)).confirmed).toBe(false);
  verify.mockResolvedValue({...row,account_id:'other'});
  expect((await disconnectionEvidence(capture,client)).confirmed).toBe(false);
  verify.mockResolvedValue(row);
  expect((await disconnectionEvidence(capture,client)).confirmed).toBe(true);
});
test('expired or erased original identity cannot be replaced by command acceptance', async () => {
  verify.mockRejectedValue(Error('webhook_fingerprint_expired'));
  expect((await disconnectionEvidence(capture,client)).confirmed).toBe(false);
});

test.each(['expired','erased'] as const)('classifies %s metadata without parsing or verifying forbidden content', async state => {
  verify.mockClear();
  const metadata={...row,payload_expires_at:new Date(0),payload_purged_at:state==='erased'?new Date():null};
  const tx={$queryRaw:async()=>[{now:new Date()}],webhookEvent:{findMany:async()=>[{id:'row'}],findUnique:async()=>metadata}} as unknown as Prisma.TransactionClient;
  expect(await disconnectionEvidence(capture,tx)).toEqual({state,confirmed:false,eventId:null,occurredAt:null,receivedAt:null});
  expect(verify).not.toHaveBeenCalled();
});

test('lifecycle end veto does not claim confirmed disconnection or consult normalized status', async () => {
  const proof={state:'absent' as const,confirmed:false,eventId:null,occurredAt:null,receivedAt:null};
  expect(await endCallEligibility({...capture,capture_ended_at:new Date()},client,proof)).toEqual({allowed:false,reason:'lifecycle_ended'});
  expect(proof.confirmed).toBe(false);
});
