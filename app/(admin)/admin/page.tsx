import StatCard from "@/components/dashboard/StatCard";
import { PageHeader, AlertBanner } from "@/components/ui";
import {
  Appointments,
  Calls,
  Leads,
  Accounts,
  Quotes,
  RevenueMetrics,
} from "@/lib/data";

const formatUsd = (cents: number): string =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default async function AdminHome() {
  const [orgsR, callsR, leadsR, appointmentsR, quotesR, revenueR] =
    await Promise.all([
      Accounts.listAccounts(),
      Calls.listCalls({}),
      Leads.listLeads({}),
      Appointments.listAppointments({}),
      Quotes.listQuoteRequests({}),
      RevenueMetrics.getCurrentRevenueMetrics({}),
    ]);

  const accounts = orgsR.ok ? orgsR.data : [];
  const calls = callsR.ok ? callsR.data : [];
  const leads = leadsR.ok ? leadsR.data : [];
  const appointments = appointmentsR.ok ? appointmentsR.data : [];
  const quotes = quotesR.ok ? quotesR.data : [];
  const revenue = revenueR.ok ? revenueR.data : null;

  const missed = calls.filter((c) => c.status === "missed").length;
  const aiAnswered = calls.filter(
    (c) =>
      c.status === "answered" && ["retell", "vapi", "bland"].includes(c.provider),
  ).length;
  const qualified = leads.filter((l) => l.status === "qualified").length;
  const booked = appointments.length;
  const quoteCount = quotes.length;

  return (
    <>
      <PageHeader
        eyebrow="AJ Digital Operator Console"
        title="Admin Overview"
        description="Portfolio health across all workspaces."
      />

      <AlertBanner className="mb-6">
        Mock data shown across all workspaces — live providers connect in v0.3.
      </AlertBanner>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Clients"
          value={accounts.filter((o) => o.status === "active").length}
          hint={`${accounts.length} total workspaces`}
          accent="primary"
        />
        <StatCard
          label="Missed Calls Detected"
          value={missed}
          hint="Across all workspaces"
          accent="warning"
        />
        <StatCard
          label="Calls Answered by AI"
          value={aiAnswered}
          hint="Retell / Vapi"
        />
        <StatCard
          label="Qualified Leads Captured"
          value={qualified}
          hint={`${leads.length} total lead events`}
        />
        <StatCard label="Appointments Booked" value={booked} />
        <StatCard label="Quote Requests Created" value={quoteCount} />
        <StatCard
          label="Estimated Recovered Revenue"
          value={revenue ? formatUsd(revenue.estimated_recovered_revenue) : "—"}
          hint="This month"
          accent="primary"
        />
        <StatCard
          label="ROI Multiple"
          value={
            revenue?.roi_multiple ? `${revenue.roi_multiple.toFixed(1)}x` : "—"
          }
          hint="Recovered revenue / monthly cost"
        />
      </section>
    </>
  );
}
