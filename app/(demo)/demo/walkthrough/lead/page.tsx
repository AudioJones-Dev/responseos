import { PageHeader, Card, CardHeading, StatusBadge, MetricCard, ButtonLink } from "@/components/ui";
import { DemoDataBanner } from "../../../_components/DemoDataBanner";
import { getWalkthroughScenario } from "../../../_data/getWalkthroughScenario";
import { usdRange } from "../../../_data/scenario";

export default async function LeadOpportunity() {
  const { lead, source, error } = await getWalkthroughScenario();
  const facts: { label: string; value: string }[] = [
    { label: "Service category", value: lead.serviceCategory },
    { label: "Work type", value: lead.workType },
    { label: "Region", value: lead.region },
    { label: "Appointment intent", value: lead.appointmentIntent },
    { label: "Follow-up owner", value: lead.followUpOwner },
    { label: "Source", value: lead.sourceAttribution },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Step 3 · Lead / Opportunity"
        title={lead.name}
        description={`${lead.dealStage} · ${lead.region}`}
        actions={<StatusBadge label={`HubSpot: ${lead.crmSyncStatus}`} tone="success" />}
      />
      <DemoDataBanner source={source} error={error} />

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Qualification" value={`${lead.qualificationScore}/100`} hint={lead.qualificationBand} emphasis />
        <MetricCard label="Est. deal value" value={usdRange(lead.estimatedValue)} hint={lead.workType} revenue />
        <MetricCard label="Urgency" value={lead.urgency} hint={lead.appointmentIntent} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeading>Opportunity detail</CardHeading>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            {facts.map((f) => (
              <div key={f.label} className="flex justify-between gap-4 border-b border-line/60 pb-3 last:border-0 last:pb-0">
                <dt className="text-ink-muted">{f.label}</dt>
                <dd className="text-right text-ink">{f.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="flex flex-col justify-between">
          <div>
            <CardHeading>Linked records</CardHeading>
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">HubSpot deal</dt>
                <dd className="font-mono text-xs text-ink-secondary">{lead.hubspotDealId}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Source call</dt>
                <dd className="font-mono text-xs text-ink-secondary">{lead.relatedCallId}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Memory record</dt>
                <dd className="font-mono text-xs text-ink-secondary">{lead.relatedMemoryId}</dd>
              </div>
            </dl>
          </div>
          <div className="mt-5">
            <ButtonLink href="/demo/walkthrough/memory">See what we remembered →</ButtonLink>
          </div>
        </Card>
      </div>
    </>
  );
}
