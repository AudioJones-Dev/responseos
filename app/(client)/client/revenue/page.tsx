import {
  PageHeader,
  MetricCard,
  EmptyState,
  Table,
  THead,
  TBody,
  TR,
  TD,
} from "@/components/ui";
import { getCurrentAccount } from "@/lib/auth/session";
import { RevenueMetrics } from "@/lib/data";

const FALLBACK_ACCOUNT_ID = "org_mock_1";

const formatUsd = (cents: number): string =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default async function ClientRevenuePage() {
  const org = await getCurrentAccount();
  const result = await RevenueMetrics.listRevenueMetrics({
    accountId: org?.id ?? FALLBACK_ACCOUNT_ID,
  });
  const trend = result.ok ? result.data : [];

  const totalEstimated = trend.reduce(
    (sum, m) => sum + m.estimated_recovered_revenue,
    0,
  );
  const totalVerified = trend.reduce(
    (sum, m) => sum + m.verified_recovered_revenue,
    0,
  );
  const totalJobsWon = trend.reduce((sum, m) => sum + m.jobs_won, 0);

  return (
    <>
      <PageHeader
        eyebrow="Client Portal"
        title="Revenue Recovered"
        description="Estimated versus verified revenue recovered for your business, month by month."
      />

      {trend.length === 0 ? (
        <EmptyState
          title="No revenue recovered yet"
          description="As missed demand is captured and turned into booked jobs, your recovered-revenue trend will build here."
        />
      ) : (
        <>
          <section className="mb-6 grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Estimated Recovered"
              value={formatUsd(totalEstimated)}
              hint="Across all months"
              revenue
              emphasis
            />
            <MetricCard
              label="Verified Recovered"
              value={formatUsd(totalVerified)}
              hint="Confirmed won jobs"
              revenue
            />
            <MetricCard
              label="Jobs Won"
              value={totalJobsWon}
              hint="Closed-won total"
            />
          </section>

          <Table>
            <THead
              columns={[
                "Month",
                "Qualified",
                "Booked",
                "Won",
                "Estimated",
                "Verified",
                "ROI",
              ]}
            />
            <TBody>
              {trend.map((m) => (
                <TR key={m.id}>
                  <TD mono>{m.period_start.slice(0, 7)}</TD>
                  <TD>{m.qualified_leads}</TD>
                  <TD>{m.appointments_booked}</TD>
                  <TD>{m.jobs_won}</TD>
                  <TD className="font-medium text-accent">
                    {formatUsd(m.estimated_recovered_revenue)}
                  </TD>
                  <TD className="text-success">
                    {formatUsd(m.verified_recovered_revenue)}
                  </TD>
                  <TD mono>
                    {m.roi_multiple ? `${m.roi_multiple.toFixed(1)}x` : "—"}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}
    </>
  );
}
