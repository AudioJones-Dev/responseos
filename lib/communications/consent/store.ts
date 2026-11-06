import "@/lib/serverOnlyGuard";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { captureEventSchema, captureStateSchema, initialCaptureState, transitionCapture, type CaptureEvent } from "./capture";

export async function lockCapture(tx: Prisma.TransactionClient, accountId: string, providerCallId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([accountId, providerCallId])}, 0))`;
}

// Internal controller seam only. No webhook or public route may call this writer.
export async function createCaptureSession(input: {
  accountId: string; callId: string; providerCallId: string; disclosureVersion: string;
  expiresAt: string; participants: { legId: string; role: "caller" | "founder" | "additional" }[];
}) {
  const session = await requireRole(["aj_admin", "operator"]);
  if (!db) throw new Error("capture_store_unavailable");
  const state = initialCaptureState(input.disclosureVersion, input.expiresAt, input.participants);
  return db.$transaction(async tx => {
    await lockCapture(tx, input.accountId, input.providerCallId);
    const call = await tx.call.findFirst({ where: { id: input.callId, account_id: input.accountId, provider: "telnyx", provider_call_id: input.providerCallId } });
    if (!call) throw new Error("capture_call_mismatch");
    if (call.transcript || call.summary || call.recording_url ||
        await tx.callSegment.count({ where: { account_id: input.accountId, call_id: call.id } }) ||
        await tx.callTranscript.count({ where: { account_id: input.accountId, call_id: call.id } })) throw new Error("capture_legacy_content_present");
    const row = await tx.callCaptureConsent.create({ data: {
      account_id: input.accountId, call_id: call.id, provider_call_id: input.providerCallId,
      state_json: state,
    } });
    await tx.auditLog.create({ data: { account_id: input.accountId, actor_type: "user", actor_user_id: session.user.id,
      actor_role: session.user.role, action: "capture.session_created", category: "workflow", target_type: "CallCaptureConsent", target_id: row.id,
      metadata_json: { call_id: call.id, revision: row.revision, scope: "transcription" } } });
    return row;
  });
}

export async function recordCaptureEvent(accountId: string, providerCallId: string, input: CaptureEvent) {
  const session = await requireRole(["aj_admin", "operator"]);
  if (!db) throw new Error("capture_store_unavailable");
  const event = captureEventSchema.parse(input);
  return db.$transaction(async tx => {
    await lockCapture(tx, accountId, providerCallId);
    const row = await tx.callCaptureConsent.findUnique({ where: { account_id_provider_call_id: { account_id: accountId, provider_call_id: providerCallId } } });
    if (!row) throw new Error("capture_consent_missing");
    const state = captureStateSchema.parse(row.state_json);
    const next = transitionCapture(state, event);
    if (next === state) return row;
    const updated = await tx.callCaptureConsent.update({ where: { id: row.id, account_id: accountId }, data: { state_json: next, revision: { increment: 1 } } });
    await tx.auditLog.create({ data: { account_id: accountId, actor_type: "user", actor_user_id: session.user.id,
      actor_role: session.user.role, action: "capture.state_changed", category: "workflow", target_type: "CallCaptureConsent", target_id: row.id,
      metadata_json: { revision: updated.revision, event_id: event.id, kind: event.kind } } });
    return updated;
  });
}
