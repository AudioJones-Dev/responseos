import type { AssessmentStatus, Prisma } from "@prisma/client";

let assessmentCounter = 0;

export function makeAssessmentReport(
  params: { organizationId: string; status?: AssessmentStatus },
  overrides: Partial<Prisma.AssessmentReportCreateInput> = {},
): Prisma.AssessmentReportCreateInput {
  assessmentCounter += 1;
  const suffix = assessmentCounter.toString().padStart(3, "0");

  return {
    id: `assessment_test_${suffix}`,
    organization_id: params.organizationId,
    status: params.status ?? "draft",
    inputs_json: {
      missed_call_volume_per_month: 10,
      lead_sources: ["phone"],
    },
    readiness_score: 65,
    revenue_leak_estimate: 250_000,
    fit_diagnosis: "ai_fit",
    implementation_scope: "Test implementation scope",
    projected_roi_multiple: 2.5,
    proposed_tier: "recovery_core",
    proposed_setup_cents: 100_000,
    proposed_monthly_cents: 50_000,
    proposed_outcome_terms: { kind: "per_qualified_appointment" },
    ...overrides,
  };
}
