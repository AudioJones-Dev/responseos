import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { err, errFromThrown, ok, type Result } from "./result";
import {
  assertRowInScope,
  isCrossTenantRole,
  withTenantScope,
} from "./session-helpers";

export type AssessmentStatus =
  | "draft"
  | "in_review"
  | "delivered"
  | "signed"
  | "declined"
  | "expired";

export type FitDiagnosis = "ai_fit" | "borderline" | "no_fit";

export type EngagementTier =
  | "recovery_core"
  | "recovery_pro"
  | "recovery_performance";

export interface AssessmentReport {
  id: string;
  organization_id: string;
  status: AssessmentStatus;
  inputs_json: unknown;
  readiness_score?: number;
  revenue_leak_estimate?: number;
  fit_diagnosis?: FitDiagnosis;
  current_workflow_map?: unknown;
  recommended_workflow_map?: unknown;
  implementation_scope?: string;
  projected_roi_multiple?: number;
  proposed_tier?: EngagementTier;
  proposed_setup_cents?: number;
  proposed_monthly_cents?: number;
  proposed_outcome_terms?: unknown;
  delivered_at?: string;
  signed_at?: string;
  created_at: string;
  updated_at: string;
}

interface AssessmentRow {
  id: string;
  organization_id: string;
  status: string;
  inputs_json: unknown;
  readiness_score: number | null;
  revenue_leak_estimate: number | null;
  fit_diagnosis: string | null;
  current_workflow_map: unknown;
  recommended_workflow_map: unknown;
  implementation_scope: string | null;
  projected_roi_multiple: number | null;
  proposed_tier: string | null;
  proposed_setup_cents: number | null;
  proposed_monthly_cents: number | null;
  proposed_outcome_terms: unknown;
  delivered_at: Date | null;
  signed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function rowToAssessment(row: AssessmentRow): AssessmentReport {
  return {
    id: row.id,
    organization_id: row.organization_id,
    status: row.status as AssessmentStatus,
    inputs_json: row.inputs_json,
    readiness_score: row.readiness_score ?? undefined,
    revenue_leak_estimate: row.revenue_leak_estimate ?? undefined,
    fit_diagnosis: (row.fit_diagnosis as FitDiagnosis) ?? undefined,
    current_workflow_map: row.current_workflow_map ?? undefined,
    recommended_workflow_map: row.recommended_workflow_map ?? undefined,
    implementation_scope: row.implementation_scope ?? undefined,
    projected_roi_multiple: row.projected_roi_multiple ?? undefined,
    proposed_tier: (row.proposed_tier as EngagementTier) ?? undefined,
    proposed_setup_cents: row.proposed_setup_cents ?? undefined,
    proposed_monthly_cents: row.proposed_monthly_cents ?? undefined,
    proposed_outcome_terms: row.proposed_outcome_terms ?? undefined,
    delivered_at: row.delivered_at ? row.delivered_at.toISOString() : undefined,
    signed_at: row.signed_at ? row.signed_at.toISOString() : undefined,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listAssessmentReports(params: {
  organizationId?: string;
  status?: AssessmentStatus;
}): Promise<Result<AssessmentReport[]>> {
  const scope = await withTenantScope(params.organizationId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    return ok([]);
  }

  try {
    const rows = await db.assessmentReport.findMany({
      where: {
        ...(scope.effectiveOrgId
          ? { organization_id: scope.effectiveOrgId }
          : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { created_at: "desc" },
    });
    return ok(rows.map(rowToAssessment));
  } catch (e) {
    return errFromThrown<AssessmentReport[]>(e);
  }
}

export async function getAssessmentReportById(
  id: string,
): Promise<Result<AssessmentReport>> {
  const scope = await withTenantScope(undefined);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    return err("not_found", `AssessmentReport ${id} not found.`);
  }

  try {
    const row = await db.assessmentReport.findUnique({ where: { id } });
    if (!row) return err("not_found", `AssessmentReport ${id} not found.`);
    const report = rowToAssessment(row);
    const scoped = assertRowInScope(
      report,
      scope.effectiveOrgId,
      isCrossTenantRole(scope.session),
    );
    return scoped.ok
      ? ok(report)
      : err(scoped.error.code, scoped.error.message);
  } catch (e) {
    return errFromThrown<AssessmentReport>(e);
  }
}
