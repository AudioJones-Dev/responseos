import StatCard from "@/components/dashboard/StatCard";
import { getMockOrganizations } from "@/lib/mock/organizations";
import { getMockCalls } from "@/lib/mock/calls";
import { getMockLeadEvents } from "@/lib/mock/leads";
import { getMockBookings } from "@/lib/mock/bookings";
import { getMockQuoteRequests } from "@/lib/mock/quotes";
import { getCurrentMockRevenueMetrics } from "@/lib/mock/revenueMetrics";

const formatUsd = (cents: number): string =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default function AdminHome() {
  const organizations = getMockOrganizations();
  const calls = getMockCalls();
  const leads = getMockLeadEvents();
  const bookings = getMockBookings();
  const quotes = getMockQuoteRequests();
  const revenue = getCurrentMockRevenueMetrics();

  const missed = calls.filter((c) => c.status === "missed").length;
  const aiAnswered = calls.filter(
    (c) =>
      c.status === "answered" &&
      ["retell", "vapi", "bland"].includes(c.provider),
  ).length;
  const qualified = leads.filter((l) => l.status === "qualified").length;
  const booked = bookings.length;
  const quoteCount = quotes.length;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <header className="mb-8 flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          AJ Digital Operator Console
        </p>
        <h1 className="text-3xl font-semibold">Admin Overview</h1>
        <p className="text-sm text-zinc-600">
          Internal-first console. Mock data shown until live providers
          are connected.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Clients"
          value={organizations.filter((o) => o.status === "active").length}
          hint={`${organizations.length} total workspaces`}
          accent="primary"
        />
        <StatCard
          label="Missed Calls Detected"
          value={missed}
          hint="Across all workspaces (mock)"
          accent="warning"
        />
        <StatCard
          label="Calls Answered by AI"
          value={aiAnswered}
          hint="Retell / Vapi (mock)"
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
          value={formatUsd(revenue.estimated_recovered_revenue)}
          hint="This month (mock)"
          accent="primary"
        />
        <StatCard
          label="ROI Multiple"
          value={revenue.roi_multiple ? `${revenue.roi_multiple.toFixed(1)}x` : "—"}
          hint="Estimated recovered revenue / monthly cost"
        />
      </section>
    </main>
  );
}
