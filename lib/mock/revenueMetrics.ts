import { MockRevenueMetrics, RevenueMetrics } from "@/types/revenue";

export const mockRevenueMetrics: RevenueMetrics[] = [
  // Current month — these are the numbers shown on the client dashboard hero.
  MockRevenueMetrics({
    id: "rev_mock_current",
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
  }),
  MockRevenueMetrics({
    id: "rev_mock_prev_1",
    account_id: "org_mock_1",
    period_start: "2026-04-01T00:00:00.000Z",
    period_end: "2026-04-30T23:59:59.999Z",
    total_calls: 71,
    missed_calls: 27,
    calls_answered_by_ai: 19,
    qualified_leads: 11,
    appointments_booked: 6,
    quotes_requested: 3,
    quotes_sent: 2,
    jobs_won: 1,
    estimated_recovered_revenue: 880_000,
    verified_recovered_revenue: 310_000,
    admin_hours_saved: 17,
    response_time_avg_seconds: 51,
    roi_multiple: 2.7,
  }),
  MockRevenueMetrics({
    id: "rev_mock_prev_2",
    account_id: "org_mock_1",
    period_start: "2026-03-01T00:00:00.000Z",
    period_end: "2026-03-31T23:59:59.999Z",
    total_calls: 64,
    missed_calls: 30,
    calls_answered_by_ai: 12,
    qualified_leads: 8,
    appointments_booked: 4,
    quotes_requested: 2,
    quotes_sent: 1,
    jobs_won: 1,
    estimated_recovered_revenue: 620_000,
    verified_recovered_revenue: 180_000,
    admin_hours_saved: 12,
    response_time_avg_seconds: 64,
    roi_multiple: 1.9,
  }),
];

export function getMockRevenueMetrics(): RevenueMetrics[] {
  return mockRevenueMetrics;
}

export function getCurrentMockRevenueMetrics(): RevenueMetrics {
  return mockRevenueMetrics[0];
}
