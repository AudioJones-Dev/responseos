import type { Metadata } from "next";
import { ButtonLink, Card } from "@/components/ui";
import {
  AuditRequestForm,
  type AuditRequestInitialValues,
} from "./AuditRequestForm";

export const metadata: Metadata = {
  title: "Revenue recovery audit",
  description:
    "Validate missed-call and follow-up gaps, review your revenue-exposure assumptions, and get a practical fit or no-fit recovery recommendation.",
  alternates: { canonical: "/audit" },
};

const STEPS = [
  {
    n: "01",
    title: "Share the current numbers",
    body: "Start with your estimate of missed calls, average booked job value, close rate, and the way your team handles follow-up today.",
  },
  {
    n: "02",
    title: "We validate the assumptions",
    body: "AJ Digital reviews the missed-demand pattern, response process, lead quality, and what can be measured without treating an estimate as a result.",
  },
  {
    n: "03",
    title: "You get a fit or no-fit recommendation",
    body: "The assessment maps a practical recovery path, a simpler process fix, or a clear conclusion that ResponseOS is not the right next step.",
  },
];

const SURFACE = [
  "Missed calls during jobs and after hours",
  "Unanswered SMS and web form replies",
  "Lost or unfollowed quote requests",
  "Slow first-response on warm leads",
];

type AuditPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readNumber(
  value: string | string[] | undefined,
  options: { max: number; integer?: boolean },
): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw.trim() === "") return undefined;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > options.max) {
    return undefined;
  }
  if (options.integer && !Number.isInteger(parsed)) return undefined;
  return parsed;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const params = await searchParams;
  const initialValues: AuditRequestInitialValues = {
    monthly_missed_calls: readNumber(params.monthly_missed_calls, {
      max: 1_000_000,
      integer: true,
    }),
    avg_job_value_usd: readNumber(params.avg_job_value_usd, {
      max: 10_000_000,
    }),
    close_rate_pct: readNumber(params.close_rate_pct, { max: 100 }),
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
        Revenue recovery audit
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-[1.1] text-ink sm:text-4xl">
        Validate where paid-for demand may be leaking
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
        Start with your numbers. We review the missed-demand pattern, test the
        assumptions behind the estimate, and give you a practical fit or no-fit
        recommendation before any implementation decision.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="#request" glow>
          Request my audit
        </ButtonLink>
        <ButtonLink href="/demo" variant="secondary">
          Explore the sample preview
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
          The assessment checks the points where a legitimate customer request
          can stall or disappear.
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
          Tell us where demand may be leaking. AJ Digital will validate the
          inputs and follow up with a recovery recommendation.
        </p>
        <Card className="mt-8" as="section">
          <AuditRequestForm initialValues={initialValues} />
        </Card>
      </section>
    </main>
  );
}
