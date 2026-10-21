import { ButtonLink, Card } from "@/components/ui";
import { JsonLd } from "@/components/seo/JsonLd";
import { faqJsonLd } from "@/lib/seo";

type Item = { title: string; body: string };

export type IndustryContent = {
  eyebrow: string;
  headline: string;
  lede: string;
  points: Item[];
  problemsHeading: string;
  problems: Item[];
  steps: Item[];
  signals: string[];
  faqs: { q: string; a: string }[];
};

export function IndustryPage({ content }: { content: IndustryContent }) {
  const c = content;
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
      <JsonLd data={faqJsonLd(c.faqs)} />
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
        {c.eyebrow}
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-[1.1] text-ink sm:text-4xl">
        {c.headline}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-secondary">{c.lede}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/demo/walkthrough" glow>
          Revenue Recovery Demo
        </ButtonLink>
        <ButtonLink href="/audit" variant="secondary">
          Book the Readiness Assessment
        </ButtonLink>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {c.points.map((point) => (
          <Card key={point.title} interactive>
            <h2 className="text-lg font-semibold text-ink">{point.title}</h2>
            <p className="mt-2 text-sm text-ink-secondary">{point.body}</p>
          </Card>
        ))}
      </div>

      <section className="mt-20">
        <h2 className="font-display text-2xl font-semibold text-ink">{c.problemsHeading}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {c.problems.map((p) => (
            <div key={p.title} className="border-l-2 border-line-strong pl-4">
              <h3 className="text-sm font-semibold text-ink">{p.title}</h3>
              <p className="mt-1.5 text-sm text-ink-secondary">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <h2 className="font-display text-2xl font-semibold text-ink">
          How the loop is designed to work
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.steps.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full">
                <p className="font-mono text-xs text-ink-muted">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-base font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm text-ink-secondary">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-20 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">
            What qualification looks at
          </h2>
          <p className="mt-2 text-sm text-ink-secondary">
            Signals the scoring is designed to capture on first contact. The
            Readiness Assessment tunes them to how your business actually sells.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-ink-secondary">
            {c.signals.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="text-accent" aria-hidden>
                  •
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <Card className="p-6">
          <h2 className="font-display text-xl font-semibold text-ink">
            Where this stands today
          </h2>
          <p className="mt-3 text-sm text-ink-secondary">
            ResponseOS is in active development. The public demo runs on
            fictional records and mock adapters, and live phone, calendar, and
            CRM integrations are still being validated. Estimated opportunity
            value is always shown separately from verified outcomes.
          </p>
          <p className="mt-3 text-sm text-ink-secondary">
            What you can do now is the Readiness &amp; Revenue Leak Assessment:
            a $1,000 flat diagnostic that sizes your missed demand and gives a
            straight fit / no-fit answer. The full fee applies toward
            implementation if you sign within 30 days.
          </p>
        </Card>
      </section>

      <section className="mt-20">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Questions, answered straight
        </h2>
        <div className="mt-6 space-y-3">
          {c.faqs.map((f) => (
            <Card key={f.q}>
              <h3 className="text-sm font-semibold text-ink">{f.q}</h3>
              <p className="mt-1.5 text-sm text-ink-secondary">{f.a}</p>
            </Card>
          ))}
        </div>
      </section>

      <Card className="mt-16 flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">
            Find out what your missed calls are worth
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">
            The assessment is allowed to conclude ResponseOS isn&apos;t right for
            you. That&apos;s the point of paying for it first.
          </p>
        </div>
        <ButtonLink href="/audit" glow>
          Request my assessment
        </ButtonLink>
      </Card>
    </main>
  );
}
