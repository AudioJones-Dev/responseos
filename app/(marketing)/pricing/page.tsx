import { ButtonLink, Card, StatusBadge, cn } from "@/components/ui";
import { AtmosphereBackground } from "@/components/layout/AtmosphereBackground";

const description =
  "Managed revenue-response infrastructure. Implementations start at $8,500; managed service starts at $1,500/month, plus provider usage.";

export const metadata = {
  title: "Pricing",
  description,
  openGraph: { title: "ResponseOS Pricing", description },
  twitter: { title: "ResponseOS Pricing", description },
};

const tiers = [
  {
    name: "Supervised Recovery Pilot",
    status: "Current offer",
    implementation: "$8,500",
    monthly: "$1,500/month",
    term: "90 days after go-live",
    summary: "Validate one meaningful revenue-response workflow under supervised conditions.",
    bullets: [
      "One business unit, one location, one primary workflow",
      "One CRM/FSM, 1–2 inbound channels, 1–2 production integrations within the agreed scope",
      "Supervised launch, operational reporting, and bounded optimization",
      "Business-hours support and a monthly operating review",
    ],
    featured: true,
  },
  {
    name: "Managed Core",
    status: "Target offering",
    implementation: "$12,500–$18,500",
    monthly: "$2,500–$3,500/month",
    term: "6 months after go-live",
    summary: "A broader managed scope, subject to capability and delivery-readiness validation.",
    bullets: [
      "Target scope: 2–4 critical workflows across up to 3 locations",
      "One CRM/FSM instance, up to 4 channels, approximately 3–5 integrations",
      "Recurring optimization, operating review, and change-backlog management",
      "Final scope and service commitments require readiness validation",
    ],
    featured: false,
  },
  {
    name: "Managed Operations",
    status: "Target offering",
    implementation: "$20,000–$35,000+",
    monthly: "$4,500–$7,500+/month",
    term: "6–12 months after go-live",
    summary: "For more complex operations across workflows, locations, and teams, once delivery readiness is demonstrated.",
    bullets: [
      "Target scope: 5+ critical workflows and multiple locations or departments",
      "Advanced routing, integration oversight, and defined support targets",
      "Governance, executive review, and controlled workflow expansion",
      "Service obligations and capacity are scoped individually",
    ],
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
        Pricing
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-[1.1] text-ink sm:text-4xl">
        Managed revenue-response infrastructure
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
        ResponseOS implementations start at $8,500. Managed ResponseOS starts at
        $1,500/month, plus provider usage.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-ink-secondary">
        Pricing reflects your workflows, locations, channels, integrations, and
        managed operating responsibility. Exact scope and pricing are confirmed
        after a fit review and, where needed, an assessment.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/audit" glow>Start with a free fit review</ButtonLink>
        <ButtonLink href="/demo" variant="secondary">Watch the demo</ButtonLink>
      </div>

      <section className="mt-10 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Card className="relative isolate overflow-hidden border-line-strong p-8">
          <AtmosphereBackground family="noise-glass" size="1600x900" intensity={0.6} />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
              Assessment · When investigation is needed
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
              Readiness &amp; Revenue Leak Assessment
            </h2>
            <p className="mt-3 font-display text-4xl font-semibold text-accent">
              $1,500
              <span className="ml-2 align-middle text-sm font-normal text-ink-secondary">
                one-time
              </span>
            </p>
            <p className="mt-3 text-sm text-ink-secondary">
              We review response paths, operating rules, CRM/FSM readiness, and
              potential leakage to define a scope and fit/no-fit recommendation.
              Complex assessments are $2,500–$5,000.
            </p>
            <p className="mt-3 text-sm text-ink-secondary">
              A paid assessment is not mandatory for a simple, already-bounded
              pilot. The free fit review determines what investigation is needed.
            </p>
            <p className="mt-3 text-sm text-ink-secondary">
              The standard $1,500 assessment may be credited in full toward a
              qualifying Managed Core implementation within 30 days, provided
              scope remains substantially consistent and no extraordinary
              fieldwork or custom architecture was required.
            </p>
          </div>
        </Card>
        <Card className="p-8">
          <h2 className="font-display text-2xl font-semibold text-ink">
            How the commercial model works
          </h2>
          <ul className="mt-4 space-y-4 text-sm text-ink-secondary">
            <li><strong className="text-ink">Implementation:</strong> a one-time fee for the agreed design, configuration, integration, testing, and launch scope.</li>
            <li><strong className="text-ink">Managed operations:</strong> a recurring fee for bounded monitoring, QA, optimization, reporting, and operating responsibility.</li>
            <li><strong className="text-ink">Provider usage:</strong> billed separately and transparently. Client-owned accounts are preferred where practical. AJ Digital-operated usage passes through at cost unless a separate administration fee is expressly approved.</li>
            <li><strong className="text-ink">Change control:</strong> new workflows, locations, integrations, or materially expanded support require a change order or tier review.</li>
          </ul>
          <p className="mt-4 text-sm text-ink-secondary">
            Fixed implementation and managed service are the standard. Revenue
            share is not the standard pricing model.
          </p>
        </Card>
      </section>

      <h2 className="mt-14 font-display text-2xl font-semibold text-ink">
        Start bounded. Expand with evidence.
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
        The supervised Pilot is the current commercial offer. Core and Operations
        describe target scopes; delivery assumptions remain provisional. Every
        engagement requires a capability and readiness check before commitment.
      </p>
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {tiers.map((tier) => (
          <Card
            key={tier.name}
            className={cn(
              "relative isolate flex flex-col overflow-hidden",
              tier.featured && "border-accent/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
            )}
          >
            <AtmosphereBackground family="noise-glass" size="1080x1080" intensity={0.7} />
            <div className="relative flex flex-1 flex-col">
              <div><StatusBadge label={tier.status} tone={tier.featured ? "accent" : "neutral"} /></div>
              <h3 className="mt-3 text-lg font-semibold text-ink">{tier.name}</h3>
              <p className="mt-4 font-display text-2xl font-semibold text-ink">{tier.implementation}</p>
              <p className="text-xs text-ink-muted">one-time implementation</p>
              <p className="mt-3 text-lg font-medium text-accent">{tier.monthly}</p>
              <p className="mt-1 text-xs text-ink-muted">Plus provider usage · Minimum {tier.term}</p>
              <p className="mt-4 text-sm text-ink-secondary">{tier.summary}</p>
              <ul className="mt-5 space-y-2.5 text-sm text-ink-secondary">
                {tier.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {bullet}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <ButtonLink href="/audit" variant={tier.featured ? "primary" : "secondary"} glow={tier.featured} className="w-full">
                  Discuss your scope
                </ButtonLink>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-5 max-w-3xl text-sm text-ink-secondary">
        The Pilot excludes unlimited changes, custom dashboards beyond agreed
        reporting, advanced SLAs, regulated-data architecture, causal revenue
        attribution, and 24/7 custom incident response. Enterprise / Regulated
        deployments are a future, proposal-only offering, subject to demonstrated
        security and operational controls.
      </p>
      <Card className="mt-10 p-8">
        <h2 className="font-display text-xl font-semibold text-ink">Measurement with clear limits</h2>
        <p className="mt-3 max-w-3xl text-sm text-ink-secondary">
          Potential opportunities, estimated influence, verified bookings or
          jobs, and collected revenue are different measures. We only describe
          revenue as attributable recovered revenue when evidence supports
          incremental impact under an agreed methodology.
        </p>
        <p className="mt-3 max-w-3xl text-sm text-ink-muted">
          This site demonstrates workflows with mock adapters. Commercial scope
          does not establish live integration readiness or verified client outcomes.
        </p>
      </Card>
    </main>
  );
}
