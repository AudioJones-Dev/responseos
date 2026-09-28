import { ButtonLink, Card } from "@/components/ui";
import { AuditRequestForm } from "./AuditRequestForm";

export const metadata = {
  title: "Readiness & Revenue Leak Assessment",
  description:
    "A $1,000 paid diagnostic that sizes your missed demand, scores your readiness, and gives you a straight fit / no-fit answer before any install. See the eight-part packet you walk away with.",
};

const STEPS = [
  {
    n: "01",
    title: "Share your call log and CRM exports",
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

const PACKET = [
  {
    title: "Readiness Score",
    body: "How ready your phones, CRM, calendar, and team are for automated response — operationally, technically, and on compliance.",
  },
  {
    title: "Revenue Leak Estimate",
    body: "Missed and slow-handled demand, priced against your average job value. An estimate, not a promise.",
  },
  {
    title: "Fit / No-Fit Diagnosis",
    body: "A straight answer on whether ResponseOS is worth implementing for your business, and why.",
  },
  {
    title: "Current Workflow Map",
    body: "How a call, text, or form moves through your business today, and where it stalls.",
  },
  {
    title: "Recommended Workflow",
    body: "What that flow would look like with ResponseOS in place, step by step.",
  },
  {
    title: "Implementation Scope",
    body: "What would be set up, what we'd need from you, and what's out of scope.",
  },
  {
    title: "Projected ROI",
    body: "The estimated return against setup and monthly cost. A projection, not a guarantee.",
  },
  {
    title: "Pricing Proposal",
    body: "Your setup and monthly figures — only if the diagnosis is a fit.",
  },
];

const FIT_SIGNALS = [
  "Average job value around $300 or more",
  "Meaningful missed-call volume — often 20 or more a month",
  "A clear booking or quote process",
  "Access to your CRM and calendar",
  "Owner and staff buy-in",
];

const NO_FIT_REASONS = [
  "You don't need it",
  "The business isn't ready yet",
  "Something simpler would do the job",
  "Your current system just needs configuring",
  "Basic processes need fixing first",
  "Another vendor fits better",
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
      <p className="mt-4 text-sm text-ink-secondary">
        <span className="font-display text-2xl font-semibold text-accent">
          $1,000
        </span>
        <span className="ml-2">
          flat. The full fee applies toward implementation if you sign within
          30 days.
        </span>
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="#request" glow>
          Request my assessment
        </ButtonLink>
        <ButtonLink href="/demo" variant="secondary">
          See a demo
        </ButtonLink>
      </div>

      <section id="deliverables" className="mt-14 scroll-mt-24">
        <h2 className="font-display text-2xl font-semibold text-ink">
          What you walk away with
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
          A written packet in eight parts when the diagnosis is a fit. If it
          isn&apos;t, you still keep the workflow map, the leak estimate, and
          the diagnosis.
        </p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PACKET.map((item, i) => (
            <li key={item.title}>
              <Card className="h-full" interactive>
                <span className="font-mono text-xs text-ink-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 text-base font-semibold text-ink">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm text-ink-secondary">{item.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

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

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Fit, and when we&apos;ll say no
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
          The assessment is allowed to conclude that ResponseOS isn&apos;t
          right for you. That&apos;s the point of paying for it first.
        </p>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="text-base font-semibold text-ink">
              Usually a good fit when
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-secondary">
              {FIT_SIGNALS.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink-muted">
              These are signals we look for, not hard cutoffs.
            </p>
          </Card>
          <Card>
            <h3 className="text-base font-semibold text-ink">
              We&apos;ll tell you if
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-secondary">
              {NO_FIT_REASONS.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink-muted">
              Not for first pilots: medical, legal, HIPAA-regulated, or other
              sensitive regulated workflows.
            </p>
          </Card>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold text-ink">
          What happens after
        </h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="text-base font-semibold text-ink">
              If it&apos;s a fit
            </h3>
            <p className="mt-2 text-sm text-ink-secondary">
              You get a Pricing Proposal for setup plus a monthly retainer.
              Sign within 30 days and the full $1,000 is credited toward
              implementation.
            </p>
          </Card>
          <Card>
            <h3 className="text-base font-semibold text-ink">
              If it isn&apos;t
            </h3>
            <p className="mt-2 text-sm text-ink-secondary">
              The engagement stops there. You keep the workflow map, the leak
              estimate, and the diagnosis.
            </p>
          </Card>
        </div>
        <p className="mt-4 max-w-2xl text-xs text-ink-muted">
          ResponseOS is in active development and live provider integrations
          are still being validated, so any implementation scope reflects what
          is available at the time.
        </p>
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
