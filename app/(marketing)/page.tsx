import Link from "next/link";
import { ButtonLink, Card } from "@/components/ui";
import { AtmosphereBackground } from "@/components/layout/AtmosphereBackground";

const PILLARS = [
  {
    title: "Capture",
    body: "Missed calls, text replies, and web forms land in one place, so demand doesn't sit unworked.",
  },
  {
    title: "Qualify",
    body: "Service area, urgency, decision-maker, and timeline are checked first, so your team calls the right leads first.",
  },
  {
    title: "Recover",
    body: "Follow-up, booking, and quote flows are designed to turn missed demand into booked work.",
  },
  {
    title: "Report",
    body: "A monthly report that keeps estimated revenue separate from verified outcomes, alongside ROI, response time, and hours saved.",
  },
];

const PROOF = [
  { value: "Under 60s", label: "Target first response to missed demand" },
  { value: "24/7", label: "Designed coverage across calls, texts, and forms" },
  { value: "9 KPIs", label: "What the monthly report is designed to track" },
];

// OFFER — the commercial philosophy (docs/README.md). RECOVER is the delivery loop.
const OFFER = [
  {
    title: "Outcomes First",
    body: "We price around verified outcomes and booked work — not AI features or seat licenses.",
  },
  {
    title: "Front the Work",
    body: "We do the setup work up front, so you see the leak estimate and workflow map before you commit to implementation.",
  },
  {
    title: "Framework Driven",
    body: "Every engagement runs the same RECOVER loop: respond, evaluate, capture, offer, verify, escalate, report.",
  },
  {
    title: "Earn on Outcomes",
    body: "Optional outcome fees are upside, tied to verified results — never performance-only.",
  },
  {
    title: "ROI-Aligned Partnerships",
    body: "Pricing is anchored to verified results, so cost is judged against what it returns.",
  },
];

export default function MarketingHome() {
  return (
    <main className="flex-1">
      <section className="relative isolate mx-auto w-full max-w-6xl overflow-hidden px-4 pb-16 pt-20 sm:px-6 sm:pt-28">
        <AtmosphereBackground family="signal-field" size="1920x1080" intensity={1} />
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Revenue Recovery Infrastructure
        </p>
        <h1 className="mt-6 max-w-3xl font-display text-4xl font-semibold leading-[1.1] text-ink sm:text-6xl">
          Stop losing <span className="text-accent">revenue</span> to missed
          calls.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-secondary">
          ResponseOS is designed to capture the missed call, qualify the lead,
          book the work, and report estimated and verified revenue — across
          phone, text, and web.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/demo/walkthrough" glow>
            Revenue Recovery Demo
          </ButtonLink>
          <ButtonLink href="/audit" variant="secondary">
            Book the Readiness Assessment
          </ButtonLink>
        </div>

        <div className="relative isolate mt-14 overflow-hidden rounded-lg border border-line">
          <AtmosphereBackground family="revenue-grid" size="1600x900" intensity={0.85} />
          <dl className="grid gap-px bg-line/40 sm:grid-cols-3">
            {PROOF.map((p) => (
              <div key={p.label} className="bg-surface/80 p-6 backdrop-blur-sm">
                <dt className="font-display text-3xl font-semibold text-ink">
                  {p.value}
                </dt>
                <dd className="mt-1 text-sm text-ink-secondary">{p.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="relative isolate mx-auto w-full max-w-6xl overflow-hidden px-4 py-16 sm:px-6">
        <AtmosphereBackground family="ledger-depth" size="1600x900" intensity={0.7} />
        <h2 className="font-display text-2xl font-semibold text-ink">
          One loop, four moves
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
          Every workflow ties back to a business outcome — not an AI feature.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((card, i) => (
            <Card key={card.title} interactive>
              <span className="font-mono text-xs text-ink-muted">
                0{i + 1}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-ink">
                {card.title}
              </h3>
              <p className="mt-2 text-sm text-ink-secondary">{card.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="relative isolate mx-auto w-full max-w-6xl overflow-hidden px-4 py-16 sm:px-6">
        <AtmosphereBackground family="noise-glass" size="1600x900" intensity={0.55} />
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
          How we work
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
          Why we win when you win
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
          OFFER is how we structure the relationship. Five principles keep the
          incentives pointed at your verified results, not our feature list.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {OFFER.map((o, i) => (
            <Card
              key={o.title}
              interactive
              className={
                i < 3
                  ? "lg:col-span-2"
                  : i === 3
                    ? "lg:col-span-3"
                    : "sm:col-span-2 lg:col-span-3"
              }
            >
              <h3 className="text-base font-semibold text-ink">{o.title}</h3>
              <p className="mt-2 text-sm text-ink-secondary">{o.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <Card className="relative isolate flex flex-col items-start gap-5 overflow-hidden p-8 sm:flex-row sm:items-center sm:justify-between">
          <AtmosphereBackground family="recovery-beam" size="1600x900" intensity={0.45} position="right center" />
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">
              See the workflow on sample data
            </h2>
            <p className="mt-2 max-w-xl text-sm text-ink-secondary">
              Walk the operator console and client portal on fictional sample
              data: calls, leads, bookings, and the revenue report, each clearly
              labeled.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <ButtonLink href="/demo/operator-console" variant="secondary">
              Operator console
            </ButtonLink>
            <ButtonLink href="/demo/client-dashboard">Client dashboard</ButtonLink>
          </div>
        </Card>
        <p className="mt-6 text-xs text-ink-muted">
          Prefer a guided tour?{" "}
          <Link href="/demo" className="text-ink-secondary hover:text-ink">
            Watch the 2-minute demo →
          </Link>
        </p>
      </section>
    </main>
  );
}
