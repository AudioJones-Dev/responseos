import { PageHeader, Card, CardHeading, StatusBadge, MetricCard, ButtonLink } from "@/components/ui";
import { DemoDataBanner } from "../../../_components/DemoDataBanner";
import { getWalkthroughScenario } from "../../../_data/getWalkthroughScenario";
import { usdRange } from "../../../_data/scenario";

export default async function CallIntelligence() {
  const { call, source, error } = await getWalkthroughScenario();
  return (
    <>
      <PageHeader
        eyebrow="Step 2 · Call Intelligence"
        title="After-hours call, captured and qualified"
        description={`${call.channel} · ${call.startedAt} · ${call.duration}`}
        actions={<StatusBadge label={`Urgency: ${call.urgency}`} tone="danger" />}
      />
      <DemoDataBanner source={source} error={error} />

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Qualification score" value={`${call.qualificationScore}/100`} hint={call.disposition} emphasis />
        <MetricCard label="Est. opportunity" value={usdRange(call.revenueRange)} hint="Ramp repair / replacement" revenue />
        <MetricCard label="Disposition" value={call.intent} hint={call.appointmentStatus} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeading>Transcript</CardHeading>
          <ol className="mt-4 flex flex-col gap-4">
            {call.transcript.map((line, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-12 shrink-0 pt-0.5 font-mono text-[11px] text-ink-muted">{line.t}</span>
                <div className="min-w-0">
                  <p
                    className={
                      line.speaker === "AI"
                        ? "text-xs font-semibold text-accent"
                        : "text-xs font-semibold text-ink"
                    }
                  >
                    {line.speaker === "AI" ? "AI receptionist" : call.caller}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-secondary">{line.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeading>Summary</CardHeading>
            <p className="mt-3 text-sm text-ink-secondary">{call.summary}</p>
            <dl className="mt-4 flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Service</dt>
                <dd className="text-right text-ink">{call.serviceRequested}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Consent</dt>
                <dd className="text-right text-ink">
                  {call.consent.call ? "Call ✓" : "Call ✗"} · {call.consent.sms ? "SMS ✓" : "SMS ✗"}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeading>Next action</CardHeading>
            <p className="mt-3 text-sm font-medium text-ink">{call.nextAction.label}</p>
            <p className="mt-1 text-sm text-ink-secondary">
              {call.nextAction.owner} · {call.nextAction.dueAt}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge label={call.crmSyncStatus} tone="success" />
              <StatusBadge label={call.memoryStatus} tone="accent" />
            </div>
          </Card>

          <ButtonLink href="/demo/walkthrough/lead">See the lead it created →</ButtonLink>
        </div>
      </div>
    </>
  );
}
