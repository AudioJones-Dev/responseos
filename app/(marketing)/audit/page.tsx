import { ButtonLink, Card } from "@/components/ui";
import { AuditRequestForm } from "./AuditRequestForm";

export const metadata = {
  title: "Readiness & Revenue Leak Assessment",
  description:
    "The Readiness & Revenue Leak Assessment sizes your missed demand, scores your readiness, and gives you a straight fit / no-fit answer before any install.",
};

const STEPS = [
  {
    n: "01",
    title: "Connect your call log + CRM",
    body: "We review your missed calls, after-hours traffic, and quote history from the exports you share. No rip-and-replace.",
  },
  {
    n: "02",
    title: "We size the missed-demand surface",
    body: "Missed calls, unanswered SMS, lost quote requests, and slow follow-up are mapped against your average job value to find the leak.",
  },
  {
    n: "03",
    title: "You get a recovery plan with an ROI estimate",
    body: "A recommended workflow, implementation scope, and projected ROI — before you commit to implementation.",
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
        Readiness & Revenue Leak Assessment
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-[1.1] text-ink sm:text-4xl">
        See the revenue you&apos;re already missing
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
        The assessment sizes your missed demand, scores your readiness, and
        gives you a straight fit / no-fit answer before any install.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="#request" glow>
          Request my assessment
        </ButtonLink>
        <ButtonLink href="/demo" variant="secondary">
          See a demo
        </ButtonLink>
      </div>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold text-ink">
          How the assessment runs
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
          Each gap is priced against your average job value.
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
          Request your assessment
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
          Tell us where demand is slipping. We&apos;ll follow up to schedule
          your assessment.
        </p>
        <Card className="mt-8" as="section">
          <AuditRequestForm />
        </Card>
      </section>
    </main>
  );
}
