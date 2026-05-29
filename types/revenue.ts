import { Cents, ISODate, UUID, newId, nowIso } from "./common";

export interface RevenueMetrics {
  id: UUID;
  account_id: UUID;
  period_start: ISODate;
  period_end: ISODate;
  total_calls: number;
  missed_calls: number;
  calls_answered_by_ai: number;
  qualified_leads: number;
  appointments_booked: number;
  quotes_requested: number;
  quotes_sent: number;
  jobs_won: number;
  estimated_recovered_revenue: Cents;
  verified_recovered_revenue: Cents;
  admin_hours_saved: number;
  response_time_avg_seconds: number;
  roi_multiple?: number;
  created_at: ISODate;
}

export function MockRevenueMetrics(
  overrides: Partial<RevenueMetrics> = {},
): RevenueMetrics {
  const now = nowIso();
  return {
    id: newId(),
    account_id: "org_mock_1",
    period_start: "2026-05-01T00:00:00.000Z",
    period_end: "2026-05-31T23:59:59.999Z",
    total_calls: 87,
    missed_calls: 31,
    calls_answered_by_ai: 24,
    qualified_leads: 14,
    appointments_booked: 8,
    quotes_requested: 4,
    quotes_sent: 3,
    jobs_won: 2,
    estimated_recovered_revenue: 1_245_000,
    verified_recovered_revenue: 540_000,
    admin_hours_saved: 22,
    response_time_avg_seconds: 38,
    roi_multiple: 3.8,
    created_at: now,
    ...overrides,
  };
}
