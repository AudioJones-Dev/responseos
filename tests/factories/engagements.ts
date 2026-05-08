import type { Prisma } from "@prisma/client";

let engagementCounter = 0;

export function makeEngagement(
  params: { organizationId: string; assessmentReportId: string },
  overrides: Partial<Prisma.EngagementCreateInput> = {},
): Prisma.EngagementCreateInput {
  engagementCounter += 1;
  const suffix = engagementCounter.toString().padStart(3, "0");

  return {
    id: `engagement_test_${suffix}`,
    organization_id: params.organizationId,
    assessment_report_id: params.assessmentReportId,
    tier: "recovery_core",
    status: "active",
    setup_fee_cents: 100_000,
    monthly_fee_cents: 50_000,
    outcome_fee_kind: "per_qualified_appointment",
    outcome_fee_terms_json: { rate_cents: 5_000 },
    usage_model: "bundled_with_cap",
    included_voice_minutes: 1_000,
    passthrough_margin_pct: null,
    is_founding_pilot: false,
    signed_at: new Date("2026-05-01T12:00:00.000Z"),
    started_at: new Date("2026-05-02T12:00:00.000Z"),
    ...overrides,
  };
}
