import type { Prisma } from "@prisma/client";
import { nextTestId } from "./ids";

export function makeEngagement(
  params: { accountId: string; assessmentReportId: string },
  overrides: Partial<Prisma.EngagementCreateInput> = {},
): Prisma.EngagementCreateInput {
  const base: Prisma.EngagementCreateInput = {
    id: overrides.id ?? nextTestId("engagement"),
    account_id: params.accountId,
    assessment_report_id: params.assessmentReportId,
    tier: "recovery_core",
    status: "active",
    setup_fee_cents: 150_000,
    monthly_fee_cents: 250_000,
    outcome_fee_kind: "per_qualified_appointment",
    outcome_fee_terms_json: { amountCents: 2_500 },
    usage_model: "bundled_with_cap",
    included_voice_minutes: 500,
    passthrough_margin_pct: null,
    is_founding_pilot: true,
    pilot_ends_at: new Date("2026-07-23T17:30:00.000Z"),
    signed_at: new Date("2026-04-23T17:30:00.000Z"),
    started_at: new Date("2026-04-24T13:00:00.000Z"),
  };
  return { ...base, ...overrides };
}
