import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import type {
  LeadQualification,
  QualificationStatus,
  QualificationTimeline,
} from "@/types/leadQualification";
import { err, errFromThrown, ok, type Result } from "./result";
import {
  isCrossTenantRole,
  withTenantScope,
} from "./session-helpers";

interface QualRow {
  id: string;
  lead_event_id: string;
  service_needed: string | null;
  service_area_match: boolean;
  budget_range: string | null;
  timeline: string | null;
  property_type: string | null;
  decision_maker: boolean | null;
  qualification_score: number;
  qualification_status: string;
  disqualification_reason: string | null;
  created_at: Date;
}

function rowToQual(row: QualRow): LeadQualification {
  return {
    id: row.id,
    lead_event_id: row.lead_event_id,
    service_needed: row.service_needed ?? undefined,
    service_area_match: row.service_area_match,
    budget_range: row.budget_range ?? undefined,
    timeline: (row.timeline as QualificationTimeline) ?? undefined,
    property_type: row.property_type ?? undefined,
    decision_maker: row.decision_maker ?? undefined,
    qualification_score: row.qualification_score,
    qualification_status: row.qualification_status as QualificationStatus,
    disqualification_reason: row.disqualification_reason ?? undefined,
    created_at: row.created_at.toISOString(),
  };
}

/**
 * No mock fixture exists; mock fallback returns null. The qualification
 * enrichment is hydrated alongside leads at the consumer layer in Phase C.
 */
export async function getLeadQualificationByLeadId(
  leadEventId: string,
): Promise<Result<LeadQualification | null>> {
  const scope = await withTenantScope(undefined);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    return ok(null);
  }

  try {
    const row = await db.leadQualification.findUnique({
      where: { lead_event_id: leadEventId },
    });
    if (!row) return ok(null);

    // Tenant scope enforced via the parent LeadEvent — fetch and check.
    if (!isCrossTenantRole(scope.session)) {
      const lead = await db.leadEvent.findUnique({
        where: { id: leadEventId },
        select: { account_id: true },
      });
      if (!lead || lead.account_id !== scope.effectiveAccountId) {
        return err(
          "tenant_scope_denied",
          "Caller is not in the resource's tenant scope.",
        );
      }
    }
    return ok(rowToQual(row));
  } catch (e) {
    return errFromThrown<LeadQualification | null>(e);
  }
}
