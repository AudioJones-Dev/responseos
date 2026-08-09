import StatCard from "@/components/dashboard/StatCard";
import { PageHeader, EmptyState } from "@/components/ui";
import { getCurrentAccount } from "@/lib/auth/session";
import { RevenueMetrics } from "@/lib/data";

const formatUsd = (cents: number): string =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const formatSeconds = (s: number): string =>
  s < 60 ? `${s}s` : `${Math.round(s / 60)}m ${s % 60}s`;

const formatPeriod = (start: string, end: string): string => {
  const s = new Date(start);
  const e = new Date(end);
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(s);
  const year = e.getUTCFullYear();
  return `${month} ${s.getUTCDate()}-${e.getUTCDate()}, ${year}`;
};

const FALLBACK_ACCOUNT_ID = "org_mock_1";

export default async function ClientDashboard() {
  const org = await getCurrentAccount();
  const result = await RevenueMetrics.getCurrentRevenueMetrics({
    accountId: org?.id ?? FALLBACK_ACCOUNT_ID,
  });
  const m = result.ok ? result.data : null;

  if (!m) {
    return (
      <>
        <PageHeader eyebrow="Client Dashboard" title="Sample Month" />
        <EmptyState
          title="No revenue metrics yet"
          description="Once missed demand is captured and recovered, your recovered-revenue summary will appear here."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Client Dashboard"
        title="Sample Month"
        description={`${formatPeriod(m.period_start, m.period_end)} · mock data`}
      />

      <section className="mb-6 overflow-hidden rounded-lg border border-accent/30 bg-surface">
        <div className="bg-accent-soft p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Recovered Revenue - Sample Month
          </p>
          <p className="mt-3 font-display text-4xl font-semibold tabular-nums text-ink sm:text-5xl">
            {formatUsd(m.estimated_recovered_revenue)}
            <span className="ml-3 align-middle text-sm font-medium text-ink-secondary">
              estimated
            </span>
          </p>
          <p className="mt-2 text-sm text-ink-secondary">
            {m.roi_multiple ? `${m.roi_multiple.toFixed(1)}x` : "—"} estimated ROI
            · {formatUsd(m.verified_recovered_revenue)} verified to date
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Missed Calls Recovered"
          value={m.missed_calls}
          hint="Captured + followed up"
        />
        <StatCard
          label="Qualified Leads"
          value={m.qualified_leads}
          hint={`From ${m.total_calls} total calls`}
        />
        <StatCard
          label="Appointments Booked"
          value={m.appointments_booked}
          hint="Confirmed from recovered demand"
        />
        <StatCard
          label="Quote Requests"
          value={m.quotes_requested}
          hint={`${m.quotes_sent} sent`}
        />
        <StatCard
          label="Avg Response Time"
          value={formatSeconds(m.response_time_avg_seconds)}
          hint="First reply to inbound"
        />
        <StatCard
          label="Admin Hours Saved"
          value={`${m.admin_hours_saved}h`}
          hint="vs manual follow-up"
        />
        <StatCard
          label="Verified Recovered"
          value={formatUsd(m.verified_recovered_revenue)}
          hint="Won jobs traceable to ResponseOS"
          accent="primary"
        />
        <StatCard
          label="Jobs Won"
          value={m.jobs_won}
          hint="Closed-won attribution"
        />
      </section>
    </>
  );
}
