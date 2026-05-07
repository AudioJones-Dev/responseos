import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { err, errFromThrown, ok, type Result } from "./result";
import {
  assertRowInScope,
  isCrossTenantRole,
  withTenantScope,
} from "./session-helpers";

export type EngagementTier =
  | "recovery_core"
  | "recovery_pro"
  | "recovery_performance";

export type EngagementStatus = "active" | "paused" | "cancelled" | "completed";

export type OutcomeFeeKind =
  | "per_qualified_appointment"
  | "per_verified_recovered_lead"
  | "pct_recovered_revenue"
  | "threshold_bonus";

export type UsageModel = "bundled_with_cap" | "passthrough_with_margin";

export interface Engagement {
  id: string;
  organization_id: string;
  assessment_report_id: string;
  tier: EngagementTier;
  status: EngagementStatus;
  setup_fee_cents: number;
  monthly_fee_cents: number;
  outcome_fee_kind?: OutcomeFeeKind;
  outcome_fee_terms_json?: unknown;
  usage_model: UsageModel;
  included_voice_minutes?: number;
  passthrough_margin_pct?: number;
  is_founding_pilot: boolean;
  pilot_ends_at?: string;
  signed_at: string;
  started_at?: string;
  ended_at?: string;
  created_at: string;
  updated_at: string;
}

interface EngagementRow {
  id: string;
  organization_id: string;
  assessment_report_id: string;
  tier: string;
  status: string;
  setup_fee_cents: number;
  monthly_fee_cents: number;
  outcome_fee_kind: string | null;
  outcome_fee_terms_json: unknown;
  usage_model: string;
  included_voice_minutes: number | null;
  passthrough_margin_pct: number | null;
  is_founding_pilot: boolean;
  pilot_ends_at: Date | null;
  signed_at: Date;
  started_at: Date | null;
  ended_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function rowToEngagement(row: EngagementRow): Engagement {
  return {
    id: row.id,
    organization_id: row.organization_id,
    assessment_report_id: row.assessment_report_id,
    tier: row.tier as EngagementTier,
    status: row.status as EngagementStatus,
    setup_fee_cents: row.setup_fee_cents,
    monthly_fee_cents: row.monthly_fee_cents,
    outcome_fee_kind: (row.outcome_fee_kind as OutcomeFeeKind) ?? undefined,
    outcome_fee_terms_json: row.outcome_fee_terms_json ?? undefined,
    usage_model: row.usage_model as UsageModel,
    included_voice_minutes: row.included_voice_minutes ?? undefined,
    passthrough_margin_pct: row.passthrough_margin_pct ?? undefined,
    is_founding_pilot: row.is_founding_pilot,
    pilot_ends_at: row.pilot_ends_at
      ? row.pilot_ends_at.toISOString()
      : undefined,
    signed_at: row.signed_at.toISOString(),
    started_at: row.started_at ? row.started_at.toISOString() : undefined,
    ended_at: row.ended_at ? row.ended_at.toISOString() : undefined,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listEngagements(params: {
  organizationId?: string;
  status?: EngagementStatus;
}): Promise<Result<Engagement[]>> {
  const scope = await withTenantScope(params.organizationId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    return ok([]);
  }

  try {
    const rows = await db.engagement.findMany({
      where: {
        ...(scope.effectiveOrgId
          ? { organization_id: scope.effectiveOrgId }
          : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { signed_at: "desc" },
    });
    return ok(rows.map(rowToEngagement));
  } catch (e) {
    return errFromThrown<Engagement[]>(e);
  }
}

export async function getEngagementById(
  id: string,
): Promise<Result<Engagement>> {
  const scope = await withTenantScope(undefined);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    return err("not_found", `Engagement ${id} not found.`);
  }

  try {
    const row = await db.engagement.findUnique({ where: { id } });
    if (!row) return err("not_found", `Engagement ${id} not found.`);
    const engagement = rowToEngagement(row);
    const scoped = assertRowInScope(
      engagement,
      scope.effectiveOrgId,
      isCrossTenantRole(scope.session),
    );
    return scoped.ok
      ? ok(engagement)
      : err(scoped.error.code, scoped.error.message);
  } catch (e) {
    return errFromThrown<Engagement>(e);
  }
}
