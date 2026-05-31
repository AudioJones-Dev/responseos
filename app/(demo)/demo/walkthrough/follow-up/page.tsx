import { PageHeader, Card, StatusBadge, AlertBanner, ButtonLink, Table, THead, TBody, TR, TD } from "@/components/ui";
import { followUps, usdRange } from "../../../_data/scenario";

export default function FollowUpQueue() {
  return (
    <>
      <PageHeader
        eyebrow="Step 5 · Follow-Up Queue"
        title="What needs a human, and when"
        description="Prioritised by urgency and revenue at risk"
      />

      <Table className="mb-6">
        <THead columns={["Lead", "Reason", "Owner", "Due", "Est. value", "Urgency", "CRM"]} />
        <TBody>
          {followUps.map((f) => (
            <TR key={f.id}>
              <TD className="font-medium text-ink">{f.lead}</TD>
              <TD>{f.reason}</TD>
              <TD>{f.owner}</TD>
              <TD>{f.dueAt}</TD>
              <TD className="text-ink">{usdRange(f.estimatedValue)}</TD>
              <TD>
                <StatusBadge label={f.urgency} tone={f.urgency === "high" ? "danger" : "neutral"} />
              </TD>
              <TD>
                <StatusBadge label={f.crmStatus} tone="success" />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {followUps.map((f) => (
        <Card key={f.id} className="mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">{f.lead} — {f.reason}</p>
              <p className="mt-1 text-sm text-ink-secondary">Suggested: {f.suggestedAction}</p>
            </div>
            <StatusBadge label="Action recommended" tone="accent" />
          </div>
          <AlertBanner variant="danger" className="mt-4">
            Risk if ignored: {f.riskIfIgnored}
          </AlertBanner>
        </Card>
      ))}

      <div className="mt-2">
        <ButtonLink href="/demo/walkthrough/integrations">See integration status →</ButtonLink>
      </div>
    </>
  );
}
