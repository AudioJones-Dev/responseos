import { expect, test, vi } from "vitest";
import type { CallCaptureSession, Prisma } from "@prisma/client";
import { disconnectionEvidence } from "@/lib/callControl/endCall";
const verify = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/webhookEvents", () => ({ assertStoredWebhookIdentity: verify }));
const capture={id:'capture',account_id:'account',provider_call_id:'call',call_session_id:'session',call_leg_id:'leg',generation:1} as CallCaptureSession;
const body=(call='call')=>JSON.stringify({data:{id:'event',event_type:'call.hangup',occurred_at:'2026-10-19T00:00:00Z',payload:{call_control_id:call,call_session_id:'session',call_leg_id:'leg',client_state:Buffer.from(JSON.stringify({captureId:'capture',generation:1})).toString('base64')}}});
const row={id:'row',account_id:'account',provider:'telnyx',provider_call_id:'call',provider_event_id:'event',event_type:'call.hangup',signature_valid:true,received_at:new Date(),raw_body:body()};
const client={webhookEvent:{findMany:async()=>[row]}} as unknown as Prisma.TransactionClient;
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
