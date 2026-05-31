import Link from "next/link";
import { ButtonLink, Card } from "@/components/ui";

const PILLARS = [
  {
    title: "Capture",
    body: "Every missed call, SMS reply, web form, and AI-answered call is logged as a lead event — nothing falls through.",
  },
  {
    title: "Qualify",
    body: "Service area, urgency, decision-maker, budget timeline. Each lead gets a 0–100 score before anyone lifts a finger.",
  },
  {
    title: "Recover",
    body: "Automated follow-up, booking, and quote flows turn missed demand into booked, revenue-attributed jobs.",
  },
  {
    title: "Report",
    body: "Recovered revenue, ROI multiple, response time, and admin hours saved — reconciled every month.",
  },
];

const PROOF = [
  { value: "< 60s", label: "First response to missed demand" },
  { value: "24/7", label: "Capture across calls, SMS, and forms" },
  { value: "1 ledger", label: "Every event tied to recovered revenue" },
];

export default function MarketingHome() {
  return (
    <main className="flex-1">
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pt-28">
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Revenue recovery operating system
        </p>
        <h1 className="mt-6 max-w-3xl font-display text-4xl font-semibold leading-[1.1] text-ink sm:text-6xl">
          The revenue your service business{" "}
          <span className="text-accent">already earned</span> — recovered.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-secondary">
          ResponseOS captures missed calls, qualifies leads, automates
          follow-up, books opportunities, and reports the revenue you recovered.
          OFFER is the philosophy. RECOVER is how we ship it.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/audit" glow>Run a revenue audit</ButtonLink>
          <ButtonLink href="/demo" variant="secondary">
            Watch the demo
          </ButtonLink>
        </div>

        <dl className="mt-14 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
          {PROOF.map((p) => (
            <div key={p.label} className="bg-surface p-6">
              <dt className="font-display text-3xl font-semibold text-ink">
                {p.value}
              </dt>
              <dd className="mt-1 text-sm text-ink-secondary">{p.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
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

      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <Card className="flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">
              See it on real workflows
            </h2>
            <p className="mt-2 max-w-xl text-sm text-ink-secondary">
              Walk the operator console and client portal on seeded data — calls,
              leads, bookings, and recovered-revenue reporting end to end.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <ButtonLink href="/admin" variant="secondary">
              Operator console
            </ButtonLink>
            <ButtonLink href="/client/dashboard">Client dashboard</ButtonLink>
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
