import StatCard from "@/components/dashboard/StatCard";
import { getCurrentMockRevenueMetrics } from "@/lib/mock/revenueMetrics";

const formatUsd = (cents: number): string =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const formatSeconds = (s: number): string =>
  s < 60 ? `${s}s` : `${Math.round(s / 60)}m ${s % 60}s`;

export default function ClientDashboard() {
  const m = getCurrentMockRevenueMetrics();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <header className="mb-8 flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Client Dashboard
        </p>
        <h1 className="text-3xl font-semibold">This Month</h1>
        <p className="text-sm text-zinc-600">
          {m.period_start.slice(0, 10)} → {m.period_end.slice(0, 10)} (mock data)
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
          Recovered Revenue This Month
        </p>
        <p className="mt-3 text-5xl font-semibold text-emerald-900">
          {formatUsd(m.estimated_recovered_revenue)}
          <span className="ml-2 text-base font-medium text-emerald-700">
            estimated
          </span>
        </p>
        <p className="mt-2 text-sm text-emerald-800">
          {m.roi_multiple ? `${m.roi_multiple.toFixed(1)}x` : "—"} estimated ROI
        </p>
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
    </main>
  );
}
