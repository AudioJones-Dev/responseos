import "@/lib/serverOnlyGuard";
import { randomUUID } from "node:crypto";
import type { CallCaptureSession, Prisma, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { withCaptureLock } from "@/lib/callReview/consent";
import { requireReviewOperator } from "@/lib/callReview/service";
import { providerCallHasWithdrawal } from "@/lib/callReview/withdrawal";
import { assertStoredWebhookIdentity } from "@/lib/data/webhookEvents";
import { parseCallControlEvent, sendTelnyxCallCommand } from "@/lib/providers/telnyx/callControl";

export type EndCallTarget = { captureId: string; expectedAccountId: string; expectedProviderCallId: string; generation: number };

export type DisconnectionState = "fresh" | "expired" | "erased" | "absent" | "unverifiable";

async function exactEvent(capture: CallCaptureSession, id: string, client: Prisma.TransactionClient, types: string[]) {
  const row = await assertStoredWebhookIdentity(id, client);
  if (row.account_id !== capture.account_id || row.provider !== "telnyx" || row.provider_call_id !== capture.provider_call_id || !row.signature_valid || !types.includes(row.event_type)) return null;
  const event = parseCallControlEvent(row.raw_body);
  if (!event || event.data.id !== row.provider_event_id || event.data.event_type !== row.event_type) return null;
  const p = event.data.payload;
  if (!capture.call_session_id || !capture.call_leg_id || p.call_control_id !== capture.provider_call_id || p.call_session_id !== capture.call_session_id || p.call_leg_id !== capture.call_leg_id) return null;
  try {
    const state = JSON.parse(Buffer.from(p.client_state ?? "", "base64").toString("utf8"));
    if (state.captureId !== capture.id || state.generation !== capture.generation) return null;
  } catch { return null; }
  return { row, event };
}

// Fresh means the retained original is still present and unexpired; only then can it record the disconnection fact.
export async function verifiedExactHangup(capture: CallCaptureSession, id: string, client: Prisma.TransactionClient) {
  const metadata = await client.webhookEvent.findUnique({ where: { id }, select: { payload_purged_at: true, payload_erasure_required_at: true, payload_expires_at: true } });
  if (!metadata || metadata.payload_purged_at || metadata.payload_erasure_required_at) return null;
  const now = (await client.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0].now;
  if (metadata.payload_expires_at && metadata.payload_expires_at <= now) return null;
  try { return await exactEvent(capture, id, client, ["call.hangup"]); } catch { return null; }
}

export async function disconnectionEvidence(capture: CallCaptureSession, client: Prisma.TransactionClient) {
  const events = await client.webhookEvent.findMany({ where: {
    account_id: capture.account_id, provider: "telnyx", event_type: "call.hangup",
    OR: [{ provider_call_id: capture.provider_call_id }, { provider_call_id: null }],
  }, select: { id: true }, orderBy: { received_at: "desc" } });
  let state: DisconnectionState = events.length ? "unverifiable" : "absent";
  for (const candidate of events) {
    await client.$queryRaw`SELECT id FROM "WebhookEvent" WHERE id = ${candidate.id} FOR UPDATE`;
    const metadata = await client.webhookEvent.findUnique({ where: { id: candidate.id }, select: { account_id: true, provider: true, provider_call_id: true, event_type: true, payload_purged_at: true, payload_erasure_required_at: true, payload_expires_at: true } });
    if (!metadata || metadata.account_id !== capture.account_id || metadata.provider !== "telnyx" || metadata.event_type !== "call.hangup") continue;
    if (metadata.payload_purged_at || metadata.payload_erasure_required_at) { state = "erased"; continue; }
    const now = (await client.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0].now;
    if (metadata.payload_expires_at && metadata.payload_expires_at <= now) { if (state !== "erased") state = "expired"; continue; }
    try {
      const verified = await exactEvent(capture, candidate.id, client, ["call.hangup"]);
      if (verified) return { state: "fresh" as const, confirmed: true, eventId: verified.row.provider_event_id, occurredAt: verified.event.data.occurred_at, receivedAt: verified.row.received_at.toISOString() };
    } catch { /* Unverifiable identity is a dispatch veto, never an absence of evidence. */ }
  }
  return { state, confirmed: false, eventId: null, occurredAt: null, receivedAt: null };
}

export async function endCallEligibility(capture: CallCaptureSession, client: Prisma.TransactionClient, evidence: Awaited<ReturnType<typeof disconnectionEvidence>>, ignoreClaimId?: string) {
  if (capture.call_disconnected_at) return { allowed: false, reason: "call_disconnected" };
  if (evidence.confirmed) return { allowed: false, reason: "disconnection_confirmed" };
  // Capture end, conversation end and FINALIZING close content capture; the phone call may still be connected.
  if (["EVIDENCE_FROZEN", "TRANSFER_PENDING", "TRANSFERRED"].includes(capture.control_state)) return { allowed: false, reason: "lifecycle_ended" };
  if (evidence.state !== "absent") return { allowed: false, reason: "disconnection_evidence_unavailable" };
  const claim = await client.telnyxCallCommand.findFirst({ where: { account_id: capture.account_id, capture_session_id: capture.id, command_type: "hangup", ...(ignoreClaimId ? { id: { not: ignoreClaimId } } : {}) } });
  if (claim) return { allowed: false, reason: "hangup_already_claimed" };
  const assignment = capture.assignment_id && await client.telephonyNumberAssignment.findFirst({ where: { id: capture.assignment_id, account_id: capture.account_id, status: "qualification" } });
  if (!assignment) return { allowed: false, reason: "qualification_assignment_required" };
  const types = ["call.initiated", "call.answered", "call.speak.ended", "call.gather.ended"];
  const active = await client.webhookEvent.findMany({ where: { account_id: capture.account_id, provider: "telnyx", provider_call_id: capture.provider_call_id, event_type: { in: types }, signature_valid: true }, select: { id: true } });
  for (const row of active) {
    try { if (await exactEvent(capture, row.id, client, types)) return { allowed: true, reason: "fresh_exact_active_evidence" }; } catch { /* Missing retained identity cannot authorize a command. */ }
  }
  return { allowed: false, reason: "active_evidence_unavailable" };
}
// The committed uncertain intent is a one-shot claim. A crash never permits an automatic resend.
export async function endCaptureCall(input: EndCallTarget, actor?: { id: string; role: UserRole }) {
  if (!db) throw new Error("database_unavailable");
  const located = await db.callCaptureSession.findUnique({ where: { id: input.captureId } });
  if (!located || located.account_id !== input.expectedAccountId || located.provider_call_id !== input.expectedProviderCallId) throw new Error("end_call_target_mismatch");
  const claimed = await withCaptureLock(located.account_id, located.provider_call_id, async client => {
    const capture = await client.callCaptureSession.findUniqueOrThrow({ where: { id: located.id, account_id: located.account_id } });
    if (capture.generation !== input.generation || capture.provider_call_id !== input.expectedProviderCallId) throw new Error("end_call_target_mismatch");
    const evidence = await disconnectionEvidence(capture, client);
    if (evidence.confirmed) return { dispatch: false as const, capture, command: null, evidence };
    if (!capture.assignment_id || !capture.call_session_id || !capture.call_leg_id) throw new Error("end_call_identity_incomplete");
    const assignment = await client.telephonyNumberAssignment.findFirst({ where: { id: capture.assignment_id, account_id: capture.account_id, status: "qualification" } });
    if (!assignment) throw new Error("qualification_assignment_required");
    const existing = await client.telnyxCallCommand.findUnique({ where: { capture_session_id_command_type_generation: { capture_session_id: capture.id, command_type: "hangup", generation: capture.generation } } });
    if (existing) return { dispatch: false as const, capture, command: existing, evidence };
    const eligibility = await endCallEligibility(capture, client, evidence);
    if (!eligibility.allowed) throw new Error("end_call_ineligible");
    const command = await client.telnyxCallCommand.create({ data: {
      account_id: capture.account_id, capture_session_id: capture.id, assignment_id: capture.assignment_id,
      generation: capture.generation, command_type: "hangup", command_id: randomUUID(), provider_resource: capture.provider_call_id,
      request_json: { client_state: Buffer.from(JSON.stringify({ captureId: capture.id, generation: capture.generation })).toString("base64") },
      status: "uncertain", reconciliation_state: "end_call_dispatch_claimed",
    } });
    const now = (await client.$queryRaw<{ now: Date }[]>`SELECT date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC') AS now`)[0].now;
    await client.callCaptureSession.update({ where: { id: capture.id, account_id: capture.account_id }, data: {
      content_admission_closed_at: capture.content_admission_closed_at ?? now,
      // FINALIZING keeps its state so the ended conversation can still reconcile its final transcript.
      control_state: await providerCallHasWithdrawal(capture.account_id, capture.provider_call_id, client) || capture.control_state === "FINALIZING" ? capture.control_state : "SAFE_FALLBACK",
    } });
    await client.auditLog.create({ data: { account_id: capture.account_id, actor_type: actor ? "user" : "system", ...(actor ? { actor_user_id: actor.id, actor_role: actor.role } : {}), action: "call_end_requested", category: "workflow", target_type: "CallCaptureSession", target_id: capture.id, metadata_json: { generation: capture.generation, commandId: command.command_id } } });
    return { dispatch: true as const, capture, command, evidence };
  });
  if (!claimed.dispatch) return { commandStatus: claimed.command?.status ?? null, disconnection: claimed.evidence };
  if (actor) {
    const authorization = await withCaptureLock(located.account_id, located.provider_call_id, async client => {
      await client.$queryRaw`SELECT id FROM "CallCaptureSession" WHERE id = ${located.id} AND account_id = ${located.account_id} FOR NO KEY UPDATE`;
      await client.$queryRaw`SELECT id FROM "TelnyxCallCommand" WHERE id = ${claimed.command.id} AND account_id = ${located.account_id} FOR UPDATE`;
      await client.$queryRaw`SELECT id FROM "TelephonyNumberAssignment" WHERE id = ${claimed.capture.assignment_id} AND account_id = ${located.account_id} FOR SHARE`;
      const capture = await client.callCaptureSession.findUniqueOrThrow({ where: { id: located.id, account_id: located.account_id } });
      if (!capture.assignment_id || !capture.call_session_id || !capture.call_leg_id || capture.generation !== claimed.capture.generation || capture.provider_call_id !== claimed.capture.provider_call_id || capture.assignment_id !== claimed.capture.assignment_id || capture.call_session_id !== claimed.capture.call_session_id || capture.call_leg_id !== claimed.capture.call_leg_id) throw new Error("end_call_target_mismatch");
      const evidence = await disconnectionEvidence(capture, client);
      if (evidence.confirmed || !(await endCallEligibility(capture, client, evidence, claimed.command.id)).allowed) return { dispatch: false as const, evidence };
      const identity = {
        id: claimed.command.id, account_id: capture.account_id, capture_session_id: capture.id,
        assignment_id: capture.assignment_id, generation: capture.generation, command_type: "hangup",
        command_id: claimed.command.command_id, provider_resource: capture.provider_call_id,
        request_json: { equals: claimed.command.request_json as Prisma.InputJsonValue },
      };
      const authorized = await client.telnyxCallCommand.updateMany({ where: { ...identity, status: "uncertain", reconciliation_state: "end_call_dispatch_claimed" }, data: { reconciliation_state: "operator_end_call_authorized" } });
      if (authorized.count !== 1) throw new Error("end_call_target_mismatch");
      const target = Object.freeze({
        accountId: capture.account_id, captureId: capture.id, assignmentId: capture.assignment_id,
        callControlId: capture.provider_call_id, callSessionId: capture.call_session_id, callLegId: capture.call_leg_id,
        generation: capture.generation, commandId: claimed.command.command_id,
        clientState: Buffer.from(JSON.stringify({ captureId: capture.id, generation: capture.generation })).toString("base64"),
      });
      await client.auditLog.create({ data: {
        account_id: capture.account_id, actor_type: "user", actor_user_id: actor.id, actor_role: actor.role,
        action: "call_end_authorized", category: "workflow", target_type: "CallCaptureSession", target_id: capture.id,
        metadata_json: { ...target, commandRowId: claimed.command.id, authority: "one_shot_after_commit" },
      } });
      return { dispatch: true as const, target, identity, evidence };
    });
    if (!authorization.dispatch) return { commandStatus: "uncertain", disconnection: authorization.evidence };
    // Only this invocation may send after commit; later eligibility changes cannot revoke or retarget it.
    const result = await sendTelnyxCallCommand({ callControlId: authorization.target.callControlId, action: "hangup", body: { client_state: authorization.target.clientState, command_id: authorization.target.commandId } });
    const status = result.ok ? "succeeded" : result.errorCode === "telnyx_response_uncertain" || result.status >= 500 ? "uncertain" : "failed";
    await db.$transaction(async client => {
      const respondedAt = result.status > 0 ? (await client.$queryRaw<{ now: Date }[]>`SELECT date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC') AS now`)[0].now : null;
      const updated = await client.telnyxCallCommand.updateMany({ where: { ...authorization.identity, status: "uncertain", reconciliation_state: "operator_end_call_authorized" }, data: {
        status, provider_response_status: result.status, provider_date_at: result.providerDate, provider_responded_at: respondedAt,
        error_code: result.errorCode, reconciliation_state: "awaiting_authenticated_disconnection",
      } });
      if (updated.count !== 1) throw new Error("end_call_result_identity_mismatch");
    });
    return { commandStatus: status, disconnection: authorization.evidence };
  }
  return withCaptureLock(located.account_id, located.provider_call_id, async client => {
    const capture = await client.callCaptureSession.findUniqueOrThrow({ where: { id: located.id, account_id: located.account_id } });
    if (capture.generation !== input.generation || capture.provider_call_id !== input.expectedProviderCallId || capture.assignment_id !== claimed.capture.assignment_id) throw new Error("end_call_target_mismatch");
    const evidence = await disconnectionEvidence(capture, client);
    if (evidence.confirmed || !(await endCallEligibility(capture, client, evidence, claimed.command.id)).allowed) return { commandStatus: "uncertain", disconnection: evidence };
    const result = await sendTelnyxCallCommand({ callControlId: capture.provider_call_id, action: "hangup", body: { ...claimed.command.request_json as Record<string, unknown>, command_id: claimed.command.command_id } });
    const status = result.ok ? "succeeded" : result.errorCode === "telnyx_response_uncertain" || result.status >= 500 ? "uncertain" : "failed";
    const respondedAt = result.status > 0 ? (await client.$queryRaw<{ now: Date }[]>`SELECT date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC') AS now`)[0].now : null;
    await client.telnyxCallCommand.update({ where: { id: claimed.command.id, account_id: capture.account_id }, data: {
      status, provider_response_status: result.status, provider_date_at: result.providerDate, provider_responded_at: respondedAt,
      error_code: result.errorCode, reconciliation_state: "awaiting_authenticated_disconnection",
    } });
    return { commandStatus: status, disconnection: evidence };
  });
}

export async function requestOperatorEndCall(input: EndCallTarget) {
  const operator = await requireReviewOperator();
  return endCaptureCall(input, { id: operator.user.id, role: operator.user.role });
}
