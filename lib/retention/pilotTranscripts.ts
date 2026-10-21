import "@/lib/serverOnlyGuard";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { err, errFromThrown, ok, type Result } from "@/lib/data/result";
import { retentionAuditData } from "./audit";

export type PilotTranscriptPurgeCounts = { sessions: number; turnsDeleted: number; callsCleared: number; reviewsCleared: number };

/**
 * ADR-0082: removes pilot transcripts at their 30-day expiry — the turns, the
 * call's transcript copy and the transcript held in review evidence. The
 * approved review payload and the HubSpot record are kept; this purge does
 * not reach the CRM.
 */
export async function purgeExpiredPilotTranscripts(params: { now?: Date; preview?: boolean }): Promise<Result<PilotTranscriptPurgeCounts>> {
  if (db === null) return err("no_database", "Pilot transcript purge requires DATABASE_URL.");
  const now = params.now ?? new Date();
  try {
    const expired = await db.grokTranscriptTurn.groupBy({ by: ["session_id", "account_id"], where: { expires_at: { lte: now } } });
    if (params.preview) {
      const turnsDeleted = await db.grokTranscriptTurn.count({ where: { expires_at: { lte: now } } });
      return ok({ sessions: expired.length, turnsDeleted, callsCleared: 0, reviewsCleared: 0 });
    }
    const counts: PilotTranscriptPurgeCounts = { sessions: 0, turnsDeleted: 0, callsCleared: 0, reviewsCleared: 0 };
    for (const { session_id: sessionId, account_id: accountId } of expired) {
      await db.$transaction(async tx => {
        const session = await tx.grokCallSession.findUnique({ where: { id: sessionId }, select: { account_id: true, provider_call_id: true } });
        if (!session || session.account_id !== accountId) return;
        // Every turn in a session shares one consent and one expiry window, so the session goes as a whole.
        const turns = await tx.grokTranscriptTurn.deleteMany({ where: { session_id: sessionId, account_id: accountId } });
        const call = await tx.call.findFirst({ where: { account_id: accountId, provider: "telnyx", provider_call_id: session.provider_call_id }, select: { id: true } });
        let reviewsCleared = 0;
        if (call) {
          await tx.call.update({ where: { id: call.id }, data: { transcript: null } });
          const reviews = await tx.callReview.findMany({ where: { account_id: accountId, call_id: call.id }, select: { id: true, evidence_json: true } });
          for (const review of reviews) {
            const evidence = (review.evidence_json ?? {}) as Record<string, unknown>;
            if (evidence.transcript == null) continue;
            await tx.callReview.update({ where: { id: review.id }, data: { evidence_json: { ...evidence, transcript: null, transcriptPurgedAt: now.toISOString() } as Prisma.InputJsonValue } });
            reviewsCleared += 1;
          }
        }
        await tx.auditLog.create({ data: retentionAuditData({
          accountId, action: "retention.pilot_transcript_purged", targetType: "GrokCallSession",
          reason: "Pilot call transcript reached its 30-day retention boundary.",
          metadata: { sessionId, turnsDeleted: turns.count, callCleared: Boolean(call), reviewsCleared, crmCopyDeleted: false }, now,
        }) });
        counts.sessions += 1; counts.turnsDeleted += turns.count; counts.callsCleared += call ? 1 : 0; counts.reviewsCleared += reviewsCleared;
      });
    }
    return ok(counts);
  } catch (error) {
    return errFromThrown(error);
  }
}
