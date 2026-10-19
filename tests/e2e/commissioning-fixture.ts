import { writeFileSync } from "node:fs";
import { configureSupervisedTenant } from "@/lib/agentExecution/supervisedTenant";
import { startSupervisedQualification } from "@/lib/agentExecution/supervisedQualification";
import { recordWebhookEvent } from "@/lib/data/webhookEvents";
import { db } from "@/lib/db/client";
const CONFIGURATION = [
  { key: "business.knowledge", value: { facts: [{ topic: "services", statement: "VPL evaluations are available.", sourceRef: "test-approval" }], fictionalScenarios: [] } },
  { key: "notification.completed_interaction.recipient", value: { channel: "email", recipient: "owner@example.test", event: "completed_interaction", enabled: true, temporary: true } },
  { key: "operating_hours.weekly", value: { type: "always_open" } },
  { key: "operating_hours.holidays", value: { type: "always_open" } },
  { key: "service_area.coverage", value: { regions: ["South Florida"], precision: "broad_region", countyInferenceAllowed: false, locationConfirmationRequired: true, collectFromCaller: ["city", "postal_code"] } },
  { key: "contact.escalation.primary", value: { name: "Operator", phone: "+15555550123" } },
  { key: "policy.consent", value: { aiDisclosure: "This call uses an AI receptionist and may be transcribed to help with your request.", transcription: { enabled: true }, recording: { enabled: false }, refusal: { acknowledgement: "No problem. I won't collect any more details.", stopRecordingWhenSupported: true, offer: "transfer_or_callback", minimizeCollection: true } } },
];
async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  if (!db || process.env.COMMISSIONING_SYNTHETIC_FIXTURE !== "disposable" || process.env.NODE_ENV === "production" || url.hostname !== "127.0.0.1" || url.pathname !== "/responseos_test" || process.env.RESPONSEOS_DEV_SESSION !== "operator") throw Error("disposable_fixture_required");
  const identity = await db.$queryRawUnsafe<Array<{database:string;role:string}>>("SELECT current_database() AS database,current_user AS role");
  if(identity[0].database!=="responseos_test"||identity[0].role!=="responseos") throw Error("wrong_fixture_database");
  const action=process.argv[2];
  if(action==='seed') {
    if(await db.account.findUnique({where:{slug:'browser-synthetic'}})) throw Error('fresh_fixture_required');
    const configured=await configureSupervisedTenant({accountSlug:'browser-synthetic',businessName:'Synthetic browser QA',timezone:'America/New_York',agentName:'Sam',executionMode:'SUPERVISED_PILOT',approvalRecordRef:'synthetic',configuration:CONFIGURATION});
    if(!configured.ok) throw Error(configured.error.code);
    const started=await startSupervisedQualification({accountSlug:'browser-synthetic',providerNumberId:'synthetic-browser',e164:'+15555550188',providerAssistantId:'synthetic',approvalRecordRef:'synthetic'});
    if(!started.ok) throw Error(started.error.code);
    const account=await db.account.findUniqueOrThrow({where:{slug:'browser-synthetic'}});
    const assignment=await db.telephonyNumberAssignment.findFirstOrThrow({where:{account_id:account.id}});
    const snapshot=await db.businessMemorySnapshot.findFirstOrThrow({where:{account_id:account.id,status:'approved'}});
    for(const name of ['repeat','stale','stopped','expired','ended']) {
      const capture=await db.callCaptureSession.create({data:{account_id:account.id,provider_call_id:'synthetic-browser-'+name,snapshot_id:snapshot.id,snapshot_json:snapshot.memory_json!,assignment_id:assignment.id,call_session_id:'session',call_leg_id:'leg',conversation_id:'conversation',capture_ended_at:name==='ended'?new Date():null,control_state:name==='repeat'?'STOP_PENDING':'STOPPED',withdrawal_received_at:new Date(),content_admission_closed_at:new Date()}});
      await db.call.create({data:{account_id:account.id,provider:'telnyx',provider_call_id:capture.provider_call_id,direction:'inbound',status:'completed',from_number:'+15555550111',to_number:'+15555550188',started_at:new Date()}});
      const activeId='synthetic-browser-active-'+name;
      const activeRaw=JSON.stringify({data:{id:activeId,event_type:'call.answered',occurred_at:new Date().toISOString(),payload:{call_control_id:capture.provider_call_id,call_session_id:'session',call_leg_id:'leg',client_state:Buffer.from(JSON.stringify({captureId:capture.id,generation:1})).toString('base64')}}});
      const active=await recordWebhookEvent({account_id:account.id,provider:'telnyx',provider_call_id:capture.provider_call_id,provider_event_id:activeId,event_type:'call.answered',raw_body:activeRaw,verifiedBytes:Buffer.from(activeRaw),signature_valid:true});
      if(!active.ok) throw Error(active.error.code);
      if(name==='stopped'||name==='expired') {
        const id='synthetic-browser-hangup-'+name;
        const retention=process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS;
        if(name==='expired') process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS='1';
        const raw=JSON.stringify({data:{id,event_type:'call.hangup',occurred_at:new Date().toISOString(),payload:{call_control_id:capture.provider_call_id,call_session_id:'session',call_leg_id:'leg',client_state:Buffer.from(JSON.stringify({captureId:capture.id,generation:1})).toString('base64')}}});
        const stored=await recordWebhookEvent({account_id:account.id,provider:'telnyx',provider_call_id:capture.provider_call_id,provider_event_id:id,event_type:'call.hangup',raw_body:raw,verifiedBytes:Buffer.from(raw),signature_valid:true});
        process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS=retention;
        if(!stored.ok) throw Error(stored.error.code);
      }
    }
  } else if(action==='erase') {
    const row=await db.webhookEvent.findFirstOrThrow({where:{provider_event_id:'synthetic-browser-hangup-stopped'}});
    await db.$executeRaw`SELECT erase_webhook_early(${row.id}, ${row.account_id}, 'synthetic-approval', 'authorized_deletion')`;
  } else if(action==='bump') {
    await db.callCaptureSession.updateMany({where:{provider_call_id:'synthetic-browser-stale'},data:{generation:2}});
  } else if(action==='inspect') {
    const account=await db.account.findUniqueOrThrow({where:{slug:'browser-synthetic'}});
    const stale=await db.callCaptureSession.findFirstOrThrow({where:{account_id:account.id,provider_call_id:'synthetic-browser-stale'}});
    const result={commands:await db.telnyxCallCommand.count({where:{account_id:account.id}}),staleCommands:await db.telnyxCallCommand.count({where:{capture_session_id:stale.id}}),consentEvents:await db.callConsentEvent.count({where:{account_id:account.id}}),withdrawn:await db.callCaptureSession.count({where:{account_id:account.id,withdrawal_received_at:{not:null},content_admission_closed_at:{not:null}}}),commandsByType:await db.telnyxCallCommand.findMany({where:{account_id:account.id},select:{command_type:true,status:true}})};
    writeFileSync(process.argv[3],JSON.stringify(result,null,2));
  } else throw Error('unknown_fixture_action');
}
main().finally(()=>db?.$disconnect()).catch(error=>{console.error(error);process.exitCode=1;});
