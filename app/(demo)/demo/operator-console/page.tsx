import StatCard from "@/components/dashboard/StatCard";
import {
  AlertBanner,
  Card,
  CardHeading,
  PageHeader,
  StatusBadge,
  Table,
  TBody,
  TD,
  THead,
  TR,
} from "@/components/ui";
import { getMockAccounts } from "@/lib/mock/accounts";
import { getMockLeadEvents } from "@/lib/mock/leads";
import { getCurrentMockRevenueMetrics } from "@/lib/mock/revenueMetrics";

const formatUsd = (cents: number): string =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default function DemoOperatorConsole() {
  const accounts = getMockAccounts();
  const leads = getMockLeadEvents();
  const revenue = getCurrentMockRevenueMetrics();
  const activeClients = accounts.filter((a) => a.status === "active").length;
  const urgentLeads = leads
    .filter((l) => l.urgency === "high" && ["new", "qualified", "booked"].includes(l.status))
    .slice(0, 3);
  const clientHealth = accounts.map((account) => {
    const accountLeads = leads.filter((l) => l.account_id === account.id);
    const waiting = accountLeads.filter((l) =>
      ["new", "qualified"].includes(l.status),
    ).length;
    const lastEvent = accountLeads
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return {
      account,
      waiting,
      lastEvent: lastEvent?.event_type.replaceAll("_", " ") ?? "No events",
      status: waiting > 2 ? "Needs review" : "Healthy",
      nextAction:
        waiting > 2 ? "Review follow-up queue" : "Monitor recovered demand",
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="Operator Console Demo"
        title="Admin Overview"
        description="Portfolio health across demo workspaces."
      />

      <AlertBanner className="mb-6">
        Public read-only demo — no live calls, texts, providers, or customer data.
      </AlertBanner>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Clients"
          value={activeClients}
          hint={`${accounts.length} total workspaces`}
        />
        <StatCard
          label="Missed Calls Detected"
          value={revenue.missed_calls}
          hint="Sample month"
        />
        <StatCard
          label="Calls Answered by AI"
          value={revenue.calls_answered_by_ai}
          hint="Sample month"
        />
        <StatCard
          label="Qualified Leads Captured"
          value={revenue.qualified_leads}
          hint={`${leads.length} total lead events`}
        />
        <StatCard
          label="Appointments Booked"
          value={revenue.appointments_booked}
          hint="Sample month"
        />
        <StatCard
          label="Quote Requests Created"
          value={revenue.quotes_requested}
          hint="Sample month"
        />
        <StatCard
          label="Estimated Recovered Revenue"
          value={formatUsd(revenue.estimated_recovered_revenue)}
          hint="Sample month"
          accent="primary"
        />
        <StatCard
          label="ROI Multiple"
          value={
            revenue.roi_multiple ? `${revenue.roi_multiple.toFixed(1)}x` : "-"
          }
          hint="Recovered revenue / monthly cost"
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="p-0">
          <div className="border-b border-line px-5 py-4">
            <CardHeading>Client health</CardHeading>
            <p className="mt-1 text-sm text-ink-muted">
              Seeded portfolio view for review, routing, and follow-up.
            </p>
          </div>
          <Table className="border-0">
            <THead
              columns={[
                "Client",
                "Status",
                "Leads waiting",
                "Last event",
                "Next action",
              ]}
            />
            <TBody>
              {clientHealth.map((row) => (
                <TR key={row.account.id}>
                  <TD className="font-medium text-ink">{row.account.name}</TD>
                  <TD>
                    <StatusBadge
                      label={row.status}
                      tone={row.status === "Healthy" ? "success" : "warning"}
                    />
                  </TD>
                  <TD>{row.waiting}</TD>
                  <TD className="capitalize">{row.lastEvent}</TD>
                  <TD>{row.nextAction}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>

        <Card>
          <CardHeading>Urgent escalations</CardHeading>
          <div className="mt-4 space-y-3">
            {urgentLeads.map((lead) => (
              <div
                key={lead.id}
                className="rounded-lg border border-line bg-canvas-soft p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <StatusBadge label="High urgency" tone="warning" />
                  <span className="font-mono text-xs text-ink-muted">
                    {lead.id}
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium capitalize text-ink">
                  {lead.event_type.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Estimated value {formatUsd(lead.estimated_value ?? 0)} ·
                  review before next follow-up window.
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </>
  );
}
