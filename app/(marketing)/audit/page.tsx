import { ButtonLink, Card } from "@/components/ui";
import { AuditRequestForm } from "./AuditRequestForm";

export const metadata = {
  title: "Revenue recovery audit",
  description:
    "Map your missed-demand surface and get an estimated recovered-revenue number for the next 30 days — a clear figure, not a sales pitch.",
};

const STEPS = [
  {
    n: "01",
    title: "Connect your call log + CRM",
    body: "We pull your missed calls, after-hours traffic, and quote history (mock for now). No rip-and-replace — we read what you already have.",
  },
  {
    n: "02",
    title: "We size the missed-demand surface",
    body: "Missed calls, unanswered SMS, lost quote requests, and slow follow-up are mapped against your average job value to find the leak.",
  },
  {
    n: "03",
    title: "You get a recovery plan with an ROI estimate",
    body: "A RECOVER deployment plan and an estimated recovered-revenue number for the next 30 days — proof before you commit a dollar.",
  },
];

const SURFACE = [
  "Missed calls during jobs and after hours",
  "Unanswered SMS and web form replies",
  "Lost or unfollowed quote requests",
  "Slow first-response on warm leads",
];

export default function AuditPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
        Revenue recovery audit
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-[1.1] text-ink sm:text-4xl">
        See the revenue you&apos;re already missing
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
        We map your missed-demand surface area and hand you an estimated
        recovered-revenue number for the next 30 days. A clear figure, not a
        sales pitch.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="#request" glow>
          Request my audit
        </ButtonLink>
        <ButtonLink href="/demo" variant="secondary">
          See it on real workflows
        </ButtonLink>
      </div>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold text-ink">
          How the audit runs
        </h2>
        <ol className="mt-8 space-y-4">
          {STEPS.map((s) => (
            <li key={s.n}>
              <Card className="flex gap-5" interactive>
                <span className="font-mono text-sm text-accent">{s.n}</span>
                <div>
                  <h3 className="text-lg font-semibold text-ink">{s.title}</h3>
                  <p className="mt-1 text-sm text-ink-secondary">{s.body}</p>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold text-ink">
          What we look for
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
          Every leak is logged as a lead event and priced against your average
          job value.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {SURFACE.map((item) => (
            <Card key={item} className="flex items-start gap-3" interactive>
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <p className="text-sm text-ink-secondary">{item}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="request" className="mt-14 scroll-mt-24">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Request your audit
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
          Tell us where the demand is leaking. We&apos;ll come back with a
          recovery plan and a 30-day recovered-revenue estimate.
        </p>
        <Card className="mt-8" as="section">
          <AuditRequestForm />
        </Card>
      </section>
    </main>
  );
}
