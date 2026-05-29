import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockCallSegments } from "@/lib/mock/callSegments";
import type { CallSegment, CallSegmentSpeaker } from "@/types/callSegment";
import { err, errFromThrown, ok, type Result } from "./result";
import { isCrossTenantRole, withTenantScope } from "./session-helpers";

interface CallSegmentRow {
  id: string;
  account_id: string;
  call_id: string;
  sequence: number;
  speaker: string;
  text: string;
  redacted_text: string | null;
  confidence: number | null;
  started_at: Date;
  ended_at: Date;
  created_at: Date;
}

function rowToCallSegment(row: CallSegmentRow): CallSegment {
  return {
    id: row.id,
    account_id: row.account_id,
    call_id: row.call_id,
    sequence: row.sequence,
    speaker: row.speaker as CallSegmentSpeaker,
    text: row.text,
    redacted_text: row.redacted_text ?? undefined,
    confidence: row.confidence ?? undefined,
    started_at: row.started_at.toISOString(),
    ended_at: row.ended_at.toISOString(),
    created_at: row.created_at.toISOString(),
  };
}

export async function listCallSegmentsByCall(params: {
  accountId: string;
  callId: string;
}): Promise<Result<CallSegment[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const all = getMockCallSegments().filter((s) => s.call_id === params.callId);
    if (!isCrossTenantRole(scope.session) && scope.effectiveAccountId !== undefined) {
      return ok(all.filter((s) => s.account_id === scope.effectiveAccountId));
    }
    return ok(all);
  }

  try {
    const rows = await db.callSegment.findMany({
      where: {
        call_id: params.callId,
        ...(scope.effectiveAccountId
          ? { account_id: scope.effectiveAccountId }
          : {}),
      },
      orderBy: { sequence: "asc" },
    });
    return ok(rows.map(rowToCallSegment));
  } catch (e) {
    return errFromThrown<CallSegment[]>(e);
  }
}

/**
 * Append-only writer for finalized call segments. Idempotent on
 * `(call_id, sequence)` — re-running the normalizer with the same turn
 * sequence is a no-op (returns the existing row).
 */
export async function recordCallSegment(entry: {
  account_id: string;
  call_id: string;
  sequence: number;
  speaker: CallSegmentSpeaker;
  text: string;
  redacted_text?: string | null;
  confidence?: number | null;
  started_at: Date;
  ended_at: Date;
}): Promise<Result<CallSegment>> {
  if (db === null) {
    return err(
      "not_available",
      "recordCallSegment requires a database connection.",
    );
  }

  try {
    const existing = await db.callSegment.findUnique({
      where: {
        call_id_sequence: { call_id: entry.call_id, sequence: entry.sequence },
      },
    });
    if (existing) {
      return ok(rowToCallSegment(existing));
    }
    const created = await db.callSegment.create({
      data: {
        account_id: entry.account_id,
        call_id: entry.call_id,
        sequence: entry.sequence,
        speaker: entry.speaker,
        text: entry.text,
        redacted_text: entry.redacted_text ?? null,
        confidence: entry.confidence ?? null,
        started_at: entry.started_at,
        ended_at: entry.ended_at,
      },
    });
    return ok(rowToCallSegment(created));
  } catch (e) {
    return errFromThrown<CallSegment>(e);
  }
}
