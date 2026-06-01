import { ButtonLink, Card, StatusBadge, cn } from "@/components/ui";
import { AtmosphereBackground } from "@/components/layout/AtmosphereBackground";

export const metadata = {
  title: "Pricing",
  description:
    "ResponseOS is priced against the revenue we recover. Compare the Recovery tiers and what each one includes.",
};

const tiers = [
  {
    name: "Recovery Core",
    price: "TBD",
    summary: "Stop the bleeding. Recover the calls you're already missing.",
    bullets: [
      "Missed-call recovery",
      "AI inbound answering (mock)",
      "Lead qualification scoring",
      "Monthly ROI report",
    ],
  },
  {
    name: "Recovery Pro",
    price: "TBD",
    summary: "Turn recovered demand into booked, attributed jobs.",
    bullets: [
      "Everything in Core",
      "Quote + booking flows",
      "Outbound recovery campaigns",
      "Client portal access",
    ],
    featured: true,
  },
  {
    name: "Recovery Performance",
    price: "ROI-aligned",
    summary: "We front the work and earn on the revenue we recover.",
    bullets: [
      "Everything in Pro",
      "Earn-on-outcomes structure",
      "AJ Digital operator support",
      "Quarterly business reviews",
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
        Priced against the revenue we recover
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
        ROI-aligned partnerships, not seat licenses. We front the work and tie
        every tier to recovered revenue — so the cost only matters next to the
        dollars it returns.
      </p>

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {tiers.map((tier) => (
          <Card
            key={tier.name}
            interactive
            className={cn(
              "relative isolate flex flex-col overflow-hidden",
              tier.featured &&
                "border-accent/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
            )}
          >
            <AtmosphereBackground family="noise-glass" size="1080x1080" intensity={0.7} />
            {tier.featured ? (
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(232,255,90,0.08),transparent_38%)]"
                aria-hidden
              />
            ) : null}
            <div className="relative flex flex-1 flex-col">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-ink">{tier.name}</h2>
                {tier.featured ? (
                  <StatusBadge label="Most popular" tone="accent" />
                ) : null}
              </div>
              <p
                className={cn(
                  "mt-4 font-display text-3xl font-semibold",
                  tier.featured ? "text-accent" : "text-ink",
                )}
              >
                {tier.price}
              </p>
              <p className="mt-3 text-sm text-ink-secondary">{tier.summary}</p>
              <ul className="mt-5 space-y-2.5 text-sm text-ink-secondary">
                {tier.bullets.map((b) => (
                  <li key={b} className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-8 pt-2">
                <ButtonLink
                  href="/audit"
                  variant={tier.featured ? "primary" : "secondary"}
                  glow={tier.featured}
                  className="w-full"
                >
                  Run a revenue audit
                </ButtonLink>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-10 flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">
            Not sure which tier fits?
          </h2>
          <p className="mt-1 max-w-xl text-sm text-ink-secondary">
            Start with an audit. We size your missed-demand surface and quote
            against the revenue it represents — no commitment.
          </p>
        </div>
        <ButtonLink href="/demo" variant="secondary" className="shrink-0">
          Watch the demo
        </ButtonLink>
      </Card>
    </main>
  );
}
