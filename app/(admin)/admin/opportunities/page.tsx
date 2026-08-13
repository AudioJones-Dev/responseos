import {
  EmptyState,
  PageHeader,
  StatusBadge,
  Table,
  TBody,
  TD,
  THead,
  TR,
  type Tone,
} from "@/components/ui";
import { Opportunities } from "@/lib/data";

const statusTone: Record<string, Tone> = {
  qualified: "success",
  scheduled: "success",
  new: "warning",
  escalated: "warning",
  closed_won: "success",
  closed_lost: "danger",
  archived: "neutral",
};

const titleCase = (value: string): string =>
  value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

export default async function AdminOpportunitiesPage() {
  const result = await Opportunities.listOpportunities({});
  const opportunities = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        eyebrow="Operator Console"
        title="Opportunities"
        description="Tenant-scoped opportunities created from qualified interactions. Professional context remains metadata on the reusable core record."
      />
      {opportunities.length === 0 ? (
        <EmptyState
          title="No opportunities yet"
          description="Qualified service, professional, and partnership opportunities will appear here."
        />
      ) : (
        <Table>
          <THead columns={["Type", "Status", "Interest", "Summary", "Next Action"]} />
          <TBody>
            {opportunities.map((opportunity) => (
              <TR key={opportunity.id}>
                <TD>{titleCase(opportunity.opportunity_type)}</TD>
                <TD>
                  <StatusBadge
                    label={titleCase(opportunity.status)}
                    tone={statusTone[opportunity.status] ?? "neutral"}
                  />
                </TD>
                <TD>{opportunity.interest_level ? titleCase(opportunity.interest_level) : "—"}</TD>
                <TD>{opportunity.summary ?? "—"}</TD>
                <TD>{opportunity.next_action ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
