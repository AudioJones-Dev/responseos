import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { withCaptureLock } from "@/lib/callReview/consent";
import { queueCallReview } from "@/lib/callReview/service";
import { providerCallHasWithdrawal } from "@/lib/callReview/withdrawal";

export type PilotReviewDraft = "not_pilot" | "in_progress" | "withdrawn" | "no_transcript" | "queued";

export function pilotTranscriptText(turns: Array<{ speaker: string; text: string }>) {
  return turns.map(turn => `${turn.speaker === "caller" ? "Caller" : "Sam"}: ${turn.text}`).join("\n");
}

/**
 * ADR-0082: once a pilot call has ended, copies its consented transcript onto
 * the call and queues the next review revision for operator editing. Safe to
 * repeat: an unchanged transcript reuses the existing revision.
 */
export async function draftGrokPilotReview(captureId: string): Promise<PilotReviewDraft> {
  if (!db) throw new Error("database_unavailable");
  const located = await db.callCaptureSession.findUnique({ where: { id: captureId }, select: { account_id: true, provider_call_id: true, admission_mode: true } });
  if (!located || located.admission_mode !== "pilot") return "not_pilot";
  return withCaptureLock(located.account_id, located.provider_call_id, async client => {
    const capture = await client.callCaptureSession.findUniqueOrThrow({ where: { id: captureId } });
    const session = await client.grokCallSession.findUnique({ where: { capture_id: captureId }, select: { id: true, stopped_at: true } });
    if (!session) return "in_progress";
    // Waits out an in-flight turn write, which holds this row; later writes see the closed capture.
    await client.$queryRaw`SELECT id FROM "GrokCallSession" WHERE id=${session.id} FOR UPDATE`;
    if (!session.stopped_at && !capture.call_disconnected_at) return "in_progress";
    if (await providerCallHasWithdrawal(capture.account_id, capture.provider_call_id, client)) return "withdrawn";
    const call = await client.call.findFirst({ where: { account_id: capture.account_id, provider: "telnyx", provider_call_id: capture.provider_call_id } });
    if (!call || call.status !== "completed") return "in_progress";
    const turns = await client.grokTranscriptTurn.findMany({ where: { session_id: session.id, account_id: capture.account_id }, orderBy: { sequence: "asc" }, select: { speaker: true, text: true } });
    if (!turns.length) return "no_transcript";
    const transcript = pilotTranscriptText(turns);
    if (call.transcript !== transcript) await client.call.update({ where: { id: call.id }, data: { transcript } });
    await queueCallReview(capture.account_id, call.id, {}, client);
    return "queued";
  });
}
