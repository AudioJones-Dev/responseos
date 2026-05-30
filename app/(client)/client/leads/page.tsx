import {
  PageHeader,
  StatusBadge,
  EmptyState,
  Table,
  THead,
  TBody,
  TR,
  TD,
} from "@/components/ui";
import { getCurrentAccount } from "@/lib/auth/session";
import { Leads } from "@/lib/data";
import type { LeadEventStatus, LeadUrgency } from "@/types/lead";

const FALLBACK_ACCOUNT_ID = "org_mock_1";

const statusLabel: Record<LeadEventStatus, string> = {
  new: "New",
  qualified: "Qualified",
  unqualified: "Unqualified",
  booked: "Booked",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
  archived: "Archived",
};

const statusTone: Record<
  LeadEventStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  qualified: "success",
  booked: "success",
  won: "success",
  quoted: "success",
  new: "warning",
  unqualified: "neutral",
  archived: "neutral",
  lost: "danger",
};

const urgencyLabel: Record<LeadUrgency, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const urgencyTone: Record<LeadUrgency, "danger" | "warning" | "neutral"> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

export default async function ClientLeadsPage() {
  const org = await getCurrentAccount();
  const result = await Leads.listLeads({
    accountId: org?.id ?? FALLBACK_ACCOUNT_ID,
  });
  const leads = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        eyebrow="Client Portal"
        title="Leads"
        description="Potential jobs captured from your calls and messages, with how urgent each one looked."
      />

      {leads.length === 0 ? (
        <EmptyState
          title="No leads captured yet"
          description="Once a missed call is recovered or a customer reaches out, qualified leads will appear here."
        />
      ) : (
        <Table>
          <THead columns={["Job Type", "Status", "Urgency", "Source"]} />
          <TBody>
            {leads.map((l) => (
              <TR key={l.id}>
                <TD className="text-ink">{l.event_type}</TD>
                <TD>
                  <StatusBadge
                    label={statusLabel[l.status]}
                    tone={statusTone[l.status]}
                  />
                </TD>
                <TD>
                  <StatusBadge
                    label={urgencyLabel[l.urgency]}
                    tone={urgencyTone[l.urgency]}
                  />
                </TD>
                <TD>{l.source}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
