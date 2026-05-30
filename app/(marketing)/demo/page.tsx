import { ButtonLink, Card } from "@/components/ui";

const STEPS = [
  {
    n: "01",
    title: "A missed call lands",
    body: "After-hours or while on a job, an inbound call goes unanswered. ResponseOS logs it as a lead event the moment it happens.",
  },
  {
    n: "02",
    title: "AI follow-up triggers",
    body: "Within seconds, an SMS and AI callback open the conversation — capturing intent before the caller dials a competitor.",
  },
  {
    n: "03",
    title: "The lead qualifies",
    body: "Service area, urgency, and job type are scored 0–100. Qualified demand is routed to booking; the rest is nurtured.",
  },
  {
    n: "04",
    title: "Booking + quote created",
    body: "A confirmed appointment or quote request is generated, attributed back to the original missed call.",
  },
  {
    n: "05",
    title: "Recovered revenue reported",
    body: "The dashboard reconciles recovered revenue, ROI multiple, and response time — proof, not vanity metrics.",
  },
];

export default function DemoPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
        Guided walkthrough
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
        From missed call to recovered revenue
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
        Walk through ResponseOS on mock data — the full RECOVER loop, end to end.
        Every step ties back to a dollar figure on the dashboard.
      </p>

      <ol className="mt-12 space-y-4">
        {STEPS.map((s) => (
          <li key={s.n}>
            <Card className="flex gap-5" interactive>
              <span className="font-mono text-sm text-accent">{s.n}</span>
              <div>
                <h2 className="text-lg font-semibold text-ink">{s.title}</h2>
                <p className="mt-1 text-sm text-ink-secondary">{s.body}</p>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <Card className="mt-12 flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">
            Explore it yourself
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Open the live consoles running on seeded data.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <ButtonLink href="/client/dashboard">Client dashboard</ButtonLink>
          <ButtonLink href="/admin" variant="secondary">
            Operator console
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
