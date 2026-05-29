import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockQaLogs } from "@/lib/mock/qaLogs";
import type { QaLog, QaReviewerType } from "@/types/qaLog";
import { err, errFromThrown, ok, type Result } from "./result";
import { isCrossTenantRole, withTenantScope } from "./session-helpers";

interface QaLogRow {
  id: string;
  account_id: string;
  call_id: string;
  rubric_version: string;
  reviewer_type: string;
  reviewer_user_id: string | null;
  score: number | null;
  findings_json: unknown;
  notes: string | null;
  reviewed_at: Date;
  created_at: Date;
}

function rowToQaLog(row: QaLogRow): QaLog {
  return {
    id: row.id,
    account_id: row.account_id,
    call_id: row.call_id,
    rubric_version: row.rubric_version,
    reviewer_type: row.reviewer_type as QaReviewerType,
    reviewer_user_id: row.reviewer_user_id ?? undefined,
    score: row.score ?? undefined,
    findings_json: row.findings_json ?? {},
    notes: row.notes ?? undefined,
    reviewed_at: row.reviewed_at.toISOString(),
    created_at: row.created_at.toISOString(),
  };
}

export async function listQaLogsByCall(params: {
  accountId: string;
  callId: string;
}): Promise<Result<QaLog[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const all = getMockQaLogs().filter((q) => q.call_id === params.callId);
    if (!isCrossTenantRole(scope.session) && scope.effectiveAccountId !== undefined) {
      return ok(all.filter((q) => q.account_id === scope.effectiveAccountId));
    }
    return ok(all);
  }

  try {
    const rows = await db.qaLog.findMany({
      where: {
        call_id: params.callId,
        ...(scope.effectiveAccountId
          ? { account_id: scope.effectiveAccountId }
          : {}),
      },
      orderBy: { reviewed_at: "desc" },
    });
    return ok(rows.map(rowToQaLog));
  } catch (e) {
    return errFromThrown<QaLog[]>(e);
  }
}

/**
 * Append-only writer. Multiple reviews per (call_id, rubric_version) are
 * allowed; "latest wins" semantics come from ordering by `reviewed_at desc`
 * in `listQaLogsByCall`. No unique constraint enforced (planning Q10).
 */
export async function recordQaLog(entry: {
  account_id: string;
  call_id: string;
  rubric_version: string;
  reviewer_type: QaReviewerType;
  reviewer_user_id?: string | null;
  score?: number | null;
  findings_json: unknown;
  notes?: string | null;
  reviewed_at: Date;
}): Promise<Result<QaLog>> {
  if (db === null) {
    return err("not_available", "recordQaLog requires a database connection.");
  }

  try {
    const created = await db.qaLog.create({
      data: {
        account_id: entry.account_id,
        call_id: entry.call_id,
        rubric_version: entry.rubric_version,
        reviewer_type: entry.reviewer_type,
        reviewer_user_id: entry.reviewer_user_id ?? null,
        score: entry.score ?? null,
        findings_json: (entry.findings_json ?? {}) as never,
        notes: entry.notes ?? null,
        reviewed_at: entry.reviewed_at,
      },
    });
    return ok(rowToQaLog(created));
  } catch (e) {
    return errFromThrown<QaLog>(e);
  }
}
