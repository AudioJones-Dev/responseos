import { PageHeader, MetricCard, Card, ButtonLink, AlertBanner } from "@/components/ui";
import { overview, founderBriefing, lead, usd, usdRange } from "../../_data/scenario";

export default function RevenueRecoveryOverview() {
  return (
    <>
      <PageHeader
        eyebrow="Revenue Recovery Demo"
        title="Revenue Recovery Overview"
        description={`${overview.period} · what revenue we protected and what needs action`}
      />

      <AlertBanner className="mb-6">
        Guided walkthrough on mock data — no live calls, CRM, or providers are connected.
      </AlertBanner>

      <section className="mb-6 overflow-hidden rounded-lg border border-accent/30 bg-surface">
        <div className="bg-accent-soft p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Estimated Revenue Protected
          </p>
          <p className="mt-3 font-display text-4xl font-semibold tabular-nums text-ink sm:text-5xl">
            {usd(overview.revenueProtected)}
          </p>
          <p className="mt-2 text-sm text-ink-secondary">
            {overview.revenueProtectedDelta} · {Math.round(overview.missedCallRecoveryRate * 100)}%
            missed-call recovery rate
          </p>
        </div>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Recovered Calls" value={overview.recoveredCalls} hint="Captured + followed up" />
        <MetricCard label="Qualified Leads" value={overview.qualifiedLeads} hint="Scored opportunities" />
        <MetricCard label="Appointments" value={overview.appointments} hint="Requested / booked" />
        <MetricCard
          label="Follow-ups Due"
          value={overview.followUpsDue}
          hint={`${overview.atRiskCount} at-risk`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Founder Intelligence — today
          </p>
          <p className="mt-3 text-sm text-ink">{founderBriefing.whatChanged}</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-ink-secondary">
            {founderBriefing.points.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {p}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Top next action
            </p>
            <p className="mt-3 text-base font-semibold text-ink">{founderBriefing.topNextAction}</p>
            <p className="mt-2 text-sm text-ink-secondary">
              At-risk lead: <span className="text-ink">{lead.name}</span> ·{" "}
              {usdRange(lead.estimatedValue)} · {lead.region}
            </p>
          </div>
          <div className="mt-5">
            <ButtonLink href="/demo/walkthrough/call">Open the at-risk call →</ButtonLink>
          </div>
        </Card>
      </section>
    </>
  );
}
