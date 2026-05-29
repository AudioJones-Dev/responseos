import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import {
  getCurrentMockRevenueMetrics,
  getMockRevenueMetrics,
} from "@/lib/mock/revenueMetrics";
import type { RevenueMetrics } from "@/types/revenue";
import { err, errFromThrown, ok, type Result } from "./result";
import {
  assertRowInScope,
  isCrossTenantRole,
  withTenantScope,
} from "./session-helpers";

interface RevRow {
  id: string;
  account_id: string;
  period_start: Date;
  period_end: Date;
  total_calls: number;
  missed_calls: number;
  calls_answered_by_ai: number;
  qualified_leads: number;
  appointments_booked: number;
  quotes_requested: number;
  quotes_sent: number;
  jobs_won: number;
  estimated_recovered_revenue: number;
  verified_recovered_revenue: number;
  admin_hours_saved: number;
  response_time_avg_seconds: number;
  roi_multiple: number | null;
  created_at: Date;
}

function rowToRev(row: RevRow): RevenueMetrics {
  return {
    id: row.id,
    account_id: row.account_id,
    period_start: row.period_start.toISOString(),
    period_end: row.period_end.toISOString(),
    total_calls: row.total_calls,
    missed_calls: row.missed_calls,
    calls_answered_by_ai: row.calls_answered_by_ai,
    qualified_leads: row.qualified_leads,
    appointments_booked: row.appointments_booked,
    quotes_requested: row.quotes_requested,
    quotes_sent: row.quotes_sent,
    jobs_won: row.jobs_won,
    estimated_recovered_revenue: row.estimated_recovered_revenue,
    verified_recovered_revenue: row.verified_recovered_revenue,
    admin_hours_saved: row.admin_hours_saved,
    response_time_avg_seconds: row.response_time_avg_seconds,
    roi_multiple: row.roi_multiple ?? undefined,
    created_at: row.created_at.toISOString(),
  };
}

export async function listRevenueMetrics(params: {
  accountId?: string;
}): Promise<Result<RevenueMetrics[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const all = getMockRevenueMetrics();
    if (scope.effectiveAccountId) {
      return ok(all.filter((r) => r.account_id === scope.effectiveAccountId));
    }
    return ok(all);
  }

  try {
    const rows = await db.revenueMetrics.findMany({
      where: scope.effectiveAccountId
        ? { account_id: scope.effectiveAccountId }
        : undefined,
      orderBy: { period_start: "desc" },
    });
    return ok(rows.map(rowToRev));
  } catch (e) {
    return errFromThrown<RevenueMetrics[]>(e);
  }
}

export async function getCurrentRevenueMetrics(params: {
  accountId?: string;
}): Promise<Result<RevenueMetrics | null>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const current = getCurrentMockRevenueMetrics();
    if (
      scope.effectiveAccountId &&
      current.account_id !== scope.effectiveAccountId
    ) {
      return ok(null);
    }
    return ok(current);
  }

  try {
    const row = await db.revenueMetrics.findFirst({
      where: scope.effectiveAccountId
        ? { account_id: scope.effectiveAccountId }
        : undefined,
      orderBy: { period_start: "desc" },
    });
    if (!row) return ok(null);
    const metric = rowToRev(row);
    const scoped = assertRowInScope(
      metric,
      scope.effectiveAccountId,
      isCrossTenantRole(scope.session),
    );
    return scoped.ok
      ? ok(metric)
      : err(scoped.error.code, scoped.error.message);
  } catch (e) {
    return errFromThrown<RevenueMetrics | null>(e);
  }
}
