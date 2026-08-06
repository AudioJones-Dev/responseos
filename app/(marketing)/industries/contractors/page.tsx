import { ButtonLink, Card } from "@/components/ui";

export const metadata = {
  title: "For contractors",
  description:
    "ResponseOS for contractors — win the quote before it goes cold. Capture missed calls, qualify leads, and follow up automatically.",
};

const POINTS = [
  {
    title: "Route to the right estimator",
    body: "Inbound lands with the estimator who owns the trade and territory — no front-desk triage, no missed handoffs.",
  },
  {
    title: "Capture the scope on first contact",
    body: "Job type, square footage, timeline, and budget signal are captured and scored before anyone schedules a site visit.",
  },
  {
    title: "Track quote-to-job, not spreadsheets",
    body: "Every quote is attributed back to the lead that triggered it, so you see win rate and recovered revenue without the sprawl.",
  },
];

export default function ContractorsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
        For contractors
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-[1.1] text-ink sm:text-4xl">
        Win the quote before it goes cold
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
        Remodelers, GCs, and specialty trades. ResponseOS routes inbound to the
        right estimator, captures the scope, and tracks the quote-to-job funnel
        without the spreadsheet sprawl.
      </p>
      <div className="mt-8">
        <ButtonLink href="/audit">Request a revenue audit</ButtonLink>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {POINTS.map((point) => (
          <Card key={point.title} interactive>
            <h2 className="text-lg font-semibold text-ink">{point.title}</h2>
            <p className="mt-2 text-sm text-ink-secondary">{point.body}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
