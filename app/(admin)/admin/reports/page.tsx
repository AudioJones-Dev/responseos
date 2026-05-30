import StatCard from "@/components/dashboard/StatCard";
import {
  PageHeader,
  Card,
  CardHeading,
  EmptyState,
  Table,
  THead,
  TBody,
  TR,
  TD,
} from "@/components/ui";
import { RevenueMetrics } from "@/lib/data";

const formatUsd = (cents: number): string =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default async function AdminReportsPage() {
  const result = await RevenueMetrics.listRevenueMetrics({});
  const metrics = result.ok ? result.data : [];

  const totalRecovered = metrics.reduce(
    (sum, m) => sum + m.estimated_recovered_revenue,
    0,
  );
  const totalCalls = metrics.reduce((sum, m) => sum + m.total_calls, 0);
  const totalBooked = metrics.reduce(
    (sum, m) => sum + m.appointments_booked,
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="Operator Console"
        title="Reports"
        description="Trended revenue recovery across reporting periods. Mock data until live providers connect in v0.3."
      />

      {metrics.length === 0 ? (
        <EmptyState
          title="No reporting periods yet"
          description="Once revenue metrics are recorded for a period, trended recovery and ROI will appear here."
        />
      ) : (
        <>
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Recovered Revenue"
              value={formatUsd(totalRecovered)}
              hint={`Across ${metrics.length} periods`}
              accent="primary"
            />
            <StatCard
              label="Calls Handled"
              value={totalCalls}
              hint="All reporting periods"
            />
            <StatCard
              label="Appointments Booked"
              value={totalBooked}
              hint="All reporting periods"
            />
            <StatCard label="Periods Tracked" value={metrics.length} />
          </section>

          <Card className="p-0">
            <div className="border-b border-line px-5 py-4">
              <CardHeading>Recovery by Period</CardHeading>
            </div>
            <Table>
              <THead
                columns={[
                  "Period",
                  "Calls",
                  "Missed",
                  "Qualified",
                  "Booked",
                  "Recovered",
                  "ROI",
                ]}
              />
              <TBody>
                {metrics.map((m) => (
                  <TR key={m.id}>
                    <TD mono>{m.period_start.slice(0, 7)}</TD>
                    <TD>{m.total_calls}</TD>
                    <TD>{m.missed_calls}</TD>
                    <TD>{m.qualified_leads}</TD>
                    <TD>{m.appointments_booked}</TD>
                    <TD className="font-mono text-success">
                      {formatUsd(m.estimated_recovered_revenue)}
                    </TD>
                    <TD>
                      {m.roi_multiple ? `${m.roi_multiple.toFixed(1)}x` : "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
