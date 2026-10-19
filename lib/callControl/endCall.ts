import "@/lib/serverOnlyGuard";
import { randomUUID } from "node:crypto";
import type { CallCaptureSession, Prisma, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { withCaptureLock } from "@/lib/callReview/consent";
import { requireReviewOperator } from "@/lib/callReview/service";
import { assertStoredWebhookIdentity } from "@/lib/data/webhookEvents";
import { parseCallControlEvent, sendTelnyxCallCommand } from "@/lib/providers/telnyx/callControl";

export type EndCallTarget = { captureId: string; expectedAccountId: string; expectedProviderCallId: string; generation: number };

export async function disconnectionEvidence(capture: CallCaptureSession, client: Prisma.TransactionClient) {
  const events = await client.webhookEvent.findMany({ where: {
    account_id: capture.account_id, provider: "telnyx", provider_call_id: capture.provider_call_id,
    event_type: "call.hangup", signature_valid: true,
  }, orderBy: { received_at: "desc" } });
  for (const candidate of events) {
    let row;
    try { row = await assertStoredWebhookIdentity(candidate.id, client); } catch { continue; }
    if (row.account_id !== capture.account_id || row.provider !== "telnyx" || row.provider_call_id !== capture.provider_call_id || !row.signature_valid || row.event_type !== "call.hangup") continue;
    const event = parseCallControlEvent(row.raw_body);
    if (!event || event.data.id !== row.provider_event_id || event.data.event_type !== "call.hangup") continue;
    const p = event.data.payload;
    if (!capture.call_session_id || !capture.call_leg_id || p.call_control_id !== capture.provider_call_id || p.call_session_id !== capture.call_session_id || p.call_leg_id !== capture.call_leg_id) continue;
    try {
      const state = JSON.parse(Buffer.from(p.client_state ?? "", "base64").toString("utf8"));
      if (state.captureId !== capture.id || state.generation !== capture.generation) continue;
    } catch { continue; }
    return { confirmed: true, eventId: row.provider_event_id, occurredAt: event.data.occurred_at, receivedAt: row.received_at.toISOString() };
  }
  return { confirmed: false, eventId: null, occurredAt: null, receivedAt: null };
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
    const command = await client.telnyxCallCommand.create({ data: {
      account_id: capture.account_id, capture_session_id: capture.id, assignment_id: capture.assignment_id,
      generation: capture.generation, command_type: "hangup", command_id: randomUUID(), provider_resource: capture.provider_call_id,
      request_json: { client_state: Buffer.from(JSON.stringify({ captureId: capture.id, generation: capture.generation })).toString("base64") },
      status: "uncertain", reconciliation_state: "end_call_dispatch_claimed",
    } });
    const now = (await client.$queryRaw<{ now: Date }[]>`SELECT date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC') AS now`)[0].now;
    await client.callCaptureSession.update({ where: { id: capture.id, account_id: capture.account_id }, data: {
      content_admission_closed_at: capture.content_admission_closed_at ?? now,
      control_state: capture.withdrawal_received_at ? capture.control_state : "SAFE_FALLBACK",
    } });
    await client.auditLog.create({ data: { account_id: capture.account_id, actor_type: actor ? "user" : "system", ...(actor ? { actor_user_id: actor.id, actor_role: actor.role } : {}), action: "call_end_requested", category: "workflow", target_type: "CallCaptureSession", target_id: capture.id, metadata_json: { generation: capture.generation, commandId: command.command_id } } });
    return { dispatch: true as const, capture, command, evidence };
  });
  if (!claimed.dispatch) return { commandStatus: claimed.command?.status ?? null, disconnection: claimed.evidence };
  return withCaptureLock(located.account_id, located.provider_call_id, async client => {
    const capture = await client.callCaptureSession.findUniqueOrThrow({ where: { id: located.id, account_id: located.account_id } });
    if (capture.generation !== input.generation || capture.provider_call_id !== input.expectedProviderCallId || capture.assignment_id !== claimed.capture.assignment_id) throw new Error("end_call_target_mismatch");
    const evidence = await disconnectionEvidence(capture, client);
    if (evidence.confirmed) return { commandStatus: "uncertain", disconnection: evidence };
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
