import "@/lib/serverOnlyGuard";
import { createHash, randomUUID } from "node:crypto";
import type { CallCaptureSession, Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { withCaptureLock, orderConsentEvents } from "@/lib/callReview/consent";
import { providerCallHasWithdrawal } from "@/lib/callReview/withdrawal";
import { requireReviewOperator } from "@/lib/callReview/service";
import { assertStoredWebhookIdentity } from "@/lib/data/webhookEvents";
import { parseCallControlEvent, sendTelnyxCallCommand } from "@/lib/providers/telnyx/callControl";

export type AiStartTarget = Pick<CallCaptureSession, "id" | "account_id" | "provider_call_id" | "assignment_id" | "generation" | "call_session_id" | "call_leg_id">;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sameTarget = (current: AiStartTarget, target: AiStartTarget) => current.id === target.id && current.account_id === target.account_id && current.provider_call_id === target.provider_call_id && current.assignment_id === target.assignment_id && current.generation === target.generation && current.call_session_id === target.call_session_id && current.call_leg_id === target.call_leg_id;

async function eligible(target: AiStartTarget, client: Prisma.TransactionClient) {
  const capture = await client.callCaptureSession.findUnique({ where: { id: target.id, account_id: target.account_id } });
  if (!capture || !sameTarget(capture, target)) throw Error("ai_start_target_mismatch");
  if (await providerCallHasWithdrawal(capture.account_id, capture.provider_call_id, client)) throw Error("withdrawal_is_terminal");
  if (capture.content_admission_closed_at || capture.capture_ended_at || capture.call_disconnected_at) throw Error("capture_closed");
  if (await client.webhookEvent.findFirst({ where: { account_id: capture.account_id, provider: "telnyx", provider_call_id: capture.provider_call_id, event_type: { in: ["call.hangup", "call.conversation.ended"] } }, select: { id: true } })) throw Error("capture_closed");
  if (!capture.assignment_id || !capture.call_session_id || !capture.call_leg_id || capture.control_state !== "START_PENDING" || capture.dtmf_decision !== "affirmative" || !capture.dtmf_event_id) throw Error("affirmative_dtmf_required");
  const grants = await client.callConsentEvent.findMany({ where: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, artifact: "transcript" } });
  const grant = orderConsentEvents(grants).at(-1);
  if (!grant || grant.action !== "grant") throw Error("ai_start_consent_required");
  const proof = await client.webhookEvent.findUnique({ where: { provider_provider_event_id: { provider: "telnyx", provider_event_id: capture.dtmf_event_id } } });
  if (!proof || proof.account_id !== capture.account_id || proof.provider_call_id !== capture.provider_call_id || proof.event_type !== "call.gather.ended" || !proof.signature_valid) throw Error("webhook_fingerprint_unavailable");
  const verified = await assertStoredWebhookIdentity(proof.id, client);
  if (verified.account_id !== capture.account_id || verified.provider !== "telnyx" || verified.provider_call_id !== capture.provider_call_id || verified.provider_event_id !== capture.dtmf_event_id || verified.event_type !== "call.gather.ended" || !verified.signature_valid) throw Error("ai_start_dtmf_identity_mismatch");
  const event = parseCallControlEvent(verified.raw_body);
  const payload = event?.data.payload;
  if (event?.data.id !== capture.dtmf_event_id || event.data.event_type !== "call.gather.ended" || payload?.call_control_id !== capture.provider_call_id || payload.call_session_id !== capture.call_session_id || payload.call_leg_id !== capture.call_leg_id || payload.status !== "valid" || payload.digits !== "1") throw Error("ai_start_dtmf_identity_mismatch");
  let state: { captureId?: unknown; generation?: unknown };
  try { state = JSON.parse(Buffer.from(payload.client_state ?? "", "base64").toString("utf8")); } catch { throw Error("ai_start_dtmf_identity_mismatch"); }
  if (!state || state.captureId !== capture.id || state.generation !== capture.generation) throw Error("ai_start_dtmf_identity_mismatch");
  const assignment = await client.telephonyNumberAssignment.findFirst({ where: { id: capture.assignment_id, account_id: capture.account_id, status: "qualification", unassigned_at: null } });
  if (!assignment?.provider_assistant_id) throw Error("qualification_assignment_mismatch");
  const now = (await client.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0].now;
  if (assignment.assigned_at > now) throw Error("qualification_assignment_mismatch");
  return { capture, assistantId: assignment.provider_assistant_id, grantId: grant.id, grantHash: digest(grant), proofId: proof.id, proofHash: verified.content_fingerprint, snapshotHash: digest([capture.snapshot_id, capture.snapshot_json]) };
}

export async function startCaptureAi(target: AiStartTarget) {
  const operator = await requireReviewOperator();
  if (!db) throw Error("database_unavailable");
  const claimed = await withCaptureLock(target.account_id, target.provider_call_id, async client => {
    await client.$queryRaw`SELECT id FROM "CallCaptureSession" WHERE id = ${target.id} AND account_id = ${target.account_id} FOR NO KEY UPDATE`;
    const current = await client.callCaptureSession.findUnique({ where: { id: target.id, account_id: target.account_id } });
    if (!current || !sameTarget(current, target)) throw Error("ai_start_target_mismatch");
    if (await providerCallHasWithdrawal(target.account_id, target.provider_call_id, client)) throw Error("withdrawal_is_terminal");
    const existing = await client.telnyxCallCommand.findFirst({ where: { capture_session_id: target.id, command_type: "ai_assistant_start" }, orderBy: { intended_at: "asc" } });
    if (existing) {
      if (existing.account_id === target.account_id && existing.provider_resource === target.provider_call_id && existing.assignment_id === target.assignment_id && existing.generation === target.generation && existing.status === "succeeded" && existing.conversation_id && existing.provider_date_at) return { phase: "readback" as const };
      throw Error("ai_start_attempt_consumed");
    }
    const authority = await eligible(target, client);
    const frozen = Object.freeze({ id: current.id, account_id: current.account_id, provider_call_id: current.provider_call_id, assignment_id: current.assignment_id!, generation: current.generation, call_session_id: current.call_session_id!, call_leg_id: current.call_leg_id! });
    const request = Object.freeze({ assistant: Object.freeze({ id: authority.assistantId }), send_message_history_updates: true, client_state: Buffer.from(JSON.stringify({ captureId: frozen.id, generation: frozen.generation })).toString("base64") });
    const command = await client.telnyxCallCommand.create({ data: { account_id: frozen.account_id, capture_session_id: frozen.id, assignment_id: frozen.assignment_id, generation: frozen.generation, command_type: "ai_assistant_start", command_id: randomUUID(), provider_resource: frozen.provider_call_id, request_json: request, status: "uncertain", reconciliation_state: "ai_start_attempt_consumed" } });
    await client.auditLog.create({ data: { account_id: frozen.account_id, actor_type: "user", actor_user_id: operator.user.id, actor_role: operator.user.role, action: "ai_start_attempt_consumed", category: "workflow", target_type: "CallCaptureSession", target_id: frozen.id, metadata_json: { commandRowId: command.id, commandId: command.command_id, ...frozen, consentId: authority.grantId, dtmfProofId: authority.proofId, authority: "conditional_one_shot_presend_veto" } } });
    return { phase: "claimed" as const, target: frozen, request, command, authority };
  });
  if (claimed.phase === "readback") return;
  const identity = { id: claimed.command.id, account_id: claimed.target.account_id, capture_session_id: claimed.target.id, assignment_id: claimed.target.assignment_id, generation: claimed.target.generation, command_type: "ai_assistant_start" as const, command_id: claimed.command.command_id, provider_resource: claimed.target.provider_call_id, request_json: { equals: claimed.command.request_json as Prisma.InputJsonValue } };
  try {
    // These fresh autocommit reads hold no transaction across provider I/O. A later withdrawal remains a remote race.
    const currentOperator = await requireReviewOperator();
    if (currentOperator.user.id !== operator.user.id || currentOperator.user.role !== operator.user.role) throw Error("operator_required");
    const fresh = await eligible(claimed.target, db as unknown as Prisma.TransactionClient);
    if (fresh.assistantId !== claimed.authority.assistantId || fresh.grantId !== claimed.authority.grantId || fresh.grantHash !== claimed.authority.grantHash || fresh.proofId !== claimed.authority.proofId || fresh.proofHash !== claimed.authority.proofHash || fresh.snapshotHash !== claimed.authority.snapshotHash) throw Error("ai_start_authority_changed");
    const command = await db.telnyxCallCommand.findFirst({ where: { ...identity, status: "uncertain", reconciliation_state: "ai_start_attempt_consumed" } });
    if (!command) throw Error("ai_start_command_mismatch");
    if (await providerCallHasWithdrawal(claimed.target.account_id, claimed.target.provider_call_id)) throw Error("withdrawal_is_terminal");
  } catch (error) {
    await db.telnyxCallCommand.updateMany({ where: { ...identity, status: "uncertain", reconciliation_state: "ai_start_attempt_consumed" }, data: { status: "failed", error_code: "ai_start_presend_veto", reconciliation_state: "ai_start_consumed_without_send" } });
    throw error;
  }
  const result = await sendTelnyxCallCommand({ callControlId: claimed.target.provider_call_id, action: "ai_assistant_start", body: { ...claimed.request, command_id: claimed.command.command_id } }).catch(() => ({ status: 0, ok: false, providerDate: null, conversationId: null, errorCode: "telnyx_response_uncertain" }));
  const complete = result.ok && Boolean(result.providerDate && result.conversationId);
  const error = result.ok ? !result.providerDate ? "telnyx_start_time_unconfirmed" : !result.conversationId ? "telnyx_start_conversation_unconfirmed" : null : result.errorCode;
  await db.$transaction(async client => {
    const observedAt = result.status > 0 ? (await client.$queryRaw<{ now: Date }[]>`SELECT date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC') AS now`)[0].now : null;
    const updated = await client.telnyxCallCommand.updateMany({ where: { ...identity, status: "uncertain", reconciliation_state: "ai_start_attempt_consumed" }, data: { status: complete ? "succeeded" : result.ok || result.status === 0 || result.status >= 500 ? "uncertain" : "failed", error_code: error, provider_response_status: result.status, provider_responded_at: observedAt, provider_date_at: result.providerDate, conversation_id: result.conversationId, reconciliation_state: complete ? "ai_start_response_recorded" : "ai_start_no_retry_operator_termination_required" } });
    if (updated.count !== 1) throw Error("ai_start_result_identity_mismatch");
  });
  if (!complete) throw Error(error ?? "ai_start_unconfirmed");
  await withCaptureLock(claimed.target.account_id, claimed.target.provider_call_id, async client => {
    await client.$queryRaw`SELECT id FROM "CallCaptureSession" WHERE id = ${claimed.target.id} AND account_id = ${claimed.target.account_id} FOR NO KEY UPDATE`;
    const current = await client.callCaptureSession.findUnique({ where: { id: claimed.target.id, account_id: claimed.target.account_id } });
    if (!current || !sameTarget(current, claimed.target) || current.content_admission_closed_at || current.capture_ended_at || current.call_disconnected_at || await providerCallHasWithdrawal(claimed.target.account_id, claimed.target.provider_call_id, client)) throw Error("ai_start_termination_required");
    await client.callCaptureSession.updateMany({ where: { id: current.id, account_id: current.account_id, provider_call_id: claimed.target.provider_call_id, generation: claimed.target.generation, control_state: "START_PENDING", withdrawal_received_at: null, content_admission_closed_at: null, call_disconnected_at: null }, data: { conversation_id: result.conversationId } });
  });
}
