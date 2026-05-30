import {
  PageHeader,
  EmptyState,
  StatusBadge,
  Table,
  THead,
  TBody,
  TR,
  TD,
  type Tone,
} from "@/components/ui";
import { Leads } from "@/lib/data";

const formatUsd = (cents?: number): string =>
  typeof cents === "number"
    ? (cents / 100).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })
    : "—";

const statusTone: Record<string, Tone> = {
  qualified: "success",
  booked: "success",
  quoted: "success",
  won: "success",
  new: "warning",
  unqualified: "danger",
  lost: "danger",
  archived: "neutral",
};

const urgencyTone: Record<string, Tone> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

const titleCase = (s: string): string =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default async function AdminLeadsPage() {
  const result = await Leads.listLeads({});
  const leads = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        eyebrow="Operator Console"
        title="Lead Events"
        description="The central revenue-recovery object. Every captured demand signal becomes a lead event, tracked from first touch to won or lost."
      />

      {leads.length === 0 ? (
        <EmptyState
          title="No lead events yet"
          description="As missed calls, quote requests, and inbound messages are captured, each demand signal will appear here with its recovery status and value."
        />
      ) : (
        <Table>
          <THead
            columns={[
              "Source",
              "Event",
              "Status",
              "Urgency",
              "Estimated",
              "Recovered",
            ]}
          />
          <TBody>
            {leads.map((l) => (
              <TR key={l.id}>
                <TD>{titleCase(l.source)}</TD>
                <TD>{titleCase(l.event_type)}</TD>
                <TD>
                  <StatusBadge
                    label={titleCase(l.status)}
                    tone={statusTone[l.status] ?? "neutral"}
                  />
                </TD>
                <TD>
                  <StatusBadge
                    label={titleCase(l.urgency)}
                    tone={urgencyTone[l.urgency] ?? "neutral"}
                  />
                </TD>
                <TD className="tabular-nums">
                  {formatUsd(l.estimated_value)}
                </TD>
                <TD
                  className={
                    typeof l.recovered_value === "number"
                      ? "font-medium tabular-nums text-accent"
                      : "tabular-nums text-ink-muted"
                  }
                >
                  {formatUsd(l.recovered_value)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
