import type { AssessmentStatus, Prisma } from "@prisma/client";
import { nextTestId } from "./ids";

export function makeAssessmentReport(
  params: { organizationId: string; status?: AssessmentStatus },
  overrides: Partial<Prisma.AssessmentReportCreateInput> = {},
): Prisma.AssessmentReportCreateInput {
  const base: Prisma.AssessmentReportCreateInput = {
    id: overrides.id ?? nextTestId("assessment"),
    organization_id: params.organizationId,
    status: params.status ?? "draft",
    inputs_json: { missedCallsPerMonth: 20, averageJobValueCents: 120_000 },
    readiness_score: 78,
    revenue_leak_estimate: 450_000,
    fit_diagnosis: "ai_fit",
    current_workflow_map: { intake: "manual" },
    recommended_workflow_map: { intake: "ai-assisted" },
    implementation_scope: "Test implementation scope",
    projected_roi_multiple: 3.2,
    proposed_tier: "recovery_core",
    proposed_setup_cents: 150_000,
    proposed_monthly_cents: 250_000,
    proposed_outcome_terms: { kind: "per_qualified_appointment", amountCents: 2_500 },
  };
  return { ...base, ...overrides };
}
