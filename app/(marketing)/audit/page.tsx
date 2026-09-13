import { ButtonLink, Card } from "@/components/ui";
import { AuditRequestForm } from "./AuditRequestForm";

const description =
  "Start with a free ResponseOS fit review. When investigation is needed, a $1,500 standard assessment defines readiness, potential leakage, and implementation scope.";

export const metadata = {
  title: "Fit review and assessment",
  description,
  openGraph: {
    title: "ResponseOS Fit Review", description, type: "website",
    siteName: "ResponseOS", locale: "en_US",
    images: [{ url: "/og/responseos-og.png", width: 1200, height: 630, alt: "ResponseOS — stop losing revenue to missed calls." }],
  },
  twitter: {
    title: "ResponseOS Fit Review", description, card: "summary_large_image",
    images: ["/og/responseos-og.png"],
  },
};

const STEPS = [
  {
    n: "01",
    title: "Start with a free fit review",
    body: "Discuss your response process, business goals, and approximate opportunity economics. This review determines fit and whether a paid assessment is needed.",
  },
  {
    n: "02",
    title: "Investigate where needed",
    body: "The standard assessment is $1,500; complex assessments are $2,500–$5,000. A simple, already-bounded pilot does not require a paid assessment.",
  },
  {
    n: "03",
    title: "Agree on a bounded scope",
    body: "An assessment produces findings, a fit/no-fit recommendation, and implementation scope where appropriate. Opportunity estimates remain estimates, not attributable recovered revenue.",
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
        Fit review and assessment
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-[1.1] text-ink sm:text-4xl">
        Find the response problem worth solving
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
        Start with a free fit review. If your workflows, systems, or readiness
        need investigation, we agree on a paid assessment before beginning that
        work. The recommendation may be to proceed, narrow scope, or use a simpler solution.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="#request" glow>
          Request a free fit review
        </ButtonLink>
        <ButtonLink href="/demo" variant="secondary">
          See the simulated workflow
        </ButtonLink>
      </div>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold text-ink">
          How the review works
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
          We examine response delays, missed demand, and follow-up gaps.
          Opportunity value informs fit; workflow complexity and operating
          responsibility determine scope and pricing.
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
          Request a free fit review
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
          Tell us about your response process and operating needs. Submitting
          a request does not purchase an assessment or book a meeting.
        </p>
        <Card className="mt-8" as="section">
          <AuditRequestForm />
        </Card>
      </section>
    </main>
  );
}
