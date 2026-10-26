import { ButtonLink, Card, StatusBadge } from "@/components/ui";
import { AtmosphereBackground } from "@/components/layout/AtmosphereBackground";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Pricing",
  description:
    "ResponseOS starts with a paid assessment, then setup and a monthly retainer scoped to what the assessment finds. See what an implementation can include.",
  path: "/pricing",
});

// One scope, sized from the assessment. ADR-0028 retired the named
// tiers as the public model, so nothing here is a package to pick.
const scope = [
  {
    title: "Respond and qualify",
    items: [
      "Missed-call recovery",
      "AI inbound answering (in development)",
      "Lead qualification scoring",
    ],
  },
  {
    title: "Book and follow up",
    note: "In development",
    items: [
      "Quote and booking flows",
      "Outbound recovery campaigns",
      "Client portal access",
    ],
  },
  {
    title: "Measure and support",
    items: [
      "Monthly ROI report",
      "AJ Digital operator support",
      "Quarterly business reviews",
      "Outcome-aligned terms, once measurement is verified",
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
        Pricing
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-[1.1] text-ink sm:text-4xl">
        Priced against the leak, not the hype.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
        Every engagement starts with a paid assessment that sizes the leak.
        Then setup plus a monthly retainer. Outcome-aligned terms come only
        after measurement is verified, and never as performance-only pricing.
      </p>

      <section className="mt-10 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Card className="relative isolate overflow-hidden border-line-strong p-8">
          <AtmosphereBackground
            family="noise-glass"
            size="1600x900"
            intensity={0.6}
          />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
              Step 1 · Proof before you commit
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
              Readiness & Revenue Leak Assessment
            </h2>
            <p className="mt-3 font-display text-4xl font-semibold text-accent">
              $1,500
              <span className="ml-2 align-middle text-sm font-normal text-ink-secondary">
                flat
              </span>
            </p>
            <p className="mt-3 max-w-md text-sm text-ink-secondary">
              A paid diagnostic that maps your missed-demand surface, scores
              AI-readiness, and returns a revenue-leak estimate with a clear
              fit / no-fit call — before a dollar goes toward implementation.
              Apply the full fee toward implementation when you sign within 30
              days.
            </p>
            <div className="mt-6">
              <ButtonLink href="/audit" glow>
                Start your assessment
              </ButtonLink>
            </div>
          </div>
        </Card>

        <Card className="p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Step 2 · Implementation
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
            How the retainer works
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-ink-secondary">
            <li className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>
                Every engagement combines a one-time{" "}
                <span className="text-ink">setup fee</span> with a{" "}
                <span className="text-ink">monthly retainer</span>, sized to
                your volume.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>
                <span className="text-ink">Outcome-aligned terms</span> are
                considered only when the workflow, source data, attribution
                rules, and production measurement are verified. Until then,
                there are no outcome fees — just setup and the monthly
                retainer.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>
                No performance-only deals and no seat licenses. You always know
                the base before you start.
              </span>
            </li>
          </ul>
        </Card>
      </section>

      <h2 className="mt-14 font-display text-2xl font-semibold text-ink">
        What an implementation can include
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
        There are no packages to pick. The assessment decides which of these
        your business needs, and the setup and monthly figures follow from
        that scope.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {scope.map((group) => (
          <Card key={group.title} className="relative isolate flex flex-col overflow-hidden">
            <AtmosphereBackground family="noise-glass" size="1080x1080" intensity={0.7} />
            <div className="relative flex flex-1 flex-col">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-ink">{group.title}</h3>
                {group.note ? <StatusBadge label={group.note} tone="neutral" /> : null}
              </div>
              <ul className="mt-5 space-y-2.5 text-sm text-ink-secondary">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-10 flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">
            Not sure it&apos;s worth it?
          </h2>
          <p className="mt-1 max-w-xl text-sm text-ink-secondary">
            That&apos;s what the assessment is for.
          </p>
        </div>
        <ButtonLink href="/audit" variant="secondary" className="shrink-0">
          Book the assessment
        </ButtonLink>
      </Card>
    </main>
  );
}
