import StatCard from "@/components/dashboard/StatCard";
import {
  PageHeader,
  AlertBanner,
  Card,
  CardHeading,
  StatusBadge,
  Table,
  THead,
  TBody,
  TR,
  TD,
} from "@/components/ui";
import {
  Appointments,
  Calls,
  Leads,
  Accounts,
  Quotes,
  RevenueMetrics,
} from "@/lib/data";
import {
  filterCommercialRecords,
  isCommercialAccount,
} from "@/lib/reporting/accountClassification";

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
      RevenueMetrics.listRevenueMetrics({}),
    ]);

  const accounts = orgsR.ok ? orgsR.data : [];
  const calls = callsR.ok ? callsR.data : [];
  const leads = leadsR.ok ? leadsR.data : [];
  const appointments = appointmentsR.ok ? appointmentsR.data : [];
  const quotes = quotesR.ok ? quotesR.data : [];
  const commercialRevenue = filterCommercialRecords(
    revenueR.ok ? revenueR.data : [],
    accounts,
  );
  const revenue = commercialRevenue
    .slice()
    .sort((a, b) => b.period_start.localeCompare(a.period_start))[0] ?? null;

  const missed =
    revenue?.missed_calls ?? calls.filter((c) => c.status === "missed").length;
  const aiAnswered = revenue?.calls_answered_by_ai ?? calls.filter(
    (c) =>
      c.status === "answered" && ["retell", "vapi", "bland"].includes(c.provider),
  ).length;
  const qualified =
    revenue?.qualified_leads ??
    leads.filter((l) => l.status === "qualified").length;
  const booked = revenue?.appointments_booked ?? appointments.length;
  const quoteCount = revenue?.quotes_requested ?? quotes.length;
  const activeClients = accounts.filter(
    (account) => isCommercialAccount(account) && account.status === "active",
  ).length;
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
          value={activeClients}
          hint={`${accounts.length} total workspaces`}
        />
        <StatCard
          label="Missed Calls Detected"
          value={missed}
          hint="Sample month"
        />
        <StatCard
          label="Calls Answered by AI"
          value={aiAnswered}
          hint="Sample month"
        />
        <StatCard
          label="Qualified Leads Captured"
          value={qualified}
          hint={`${leads.length} total lead events`}
        />
        <StatCard
          label="Appointments Booked"
          value={booked}
          hint="Sample month"
        />
        <StatCard
          label="Quote Requests Created"
          value={quoteCount}
          hint="Sample month"
        />
        <StatCard
          label="Estimated Recovered Revenue"
          value={revenue ? formatUsd(revenue.estimated_recovered_revenue) : "—"}
          hint="Sample month"
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

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="p-0">
          <div className="border-b border-line px-5 py-4">
            <CardHeading>Client health</CardHeading>
            <p className="mt-1 text-sm text-ink-muted">
              Seeded portfolio view for review, routing, and follow-up.
            </p>
          </div>
          <Table className="border-0">
            <THead columns={["Client", "Status", "Leads waiting", "Last event", "Next action"]} />
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
            {urgentLeads.length > 0 ? (
              urgentLeads.map((lead) => (
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
              ))
            ) : (
              <p className="text-sm text-ink-muted">
                No urgent demo escalations in this sample month.
              </p>
            )}
          </div>
        </Card>
      </section>
    </>
  );
}
