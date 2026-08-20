import { ButtonLink, Card } from "@/components/ui";
import { AtmosphereBackground } from "@/components/layout/AtmosphereBackground";

export const metadata = {
  title: "Product demo",
  description:
    "Walk through a fictional, persisted ResponseOS call lifecycle with qualification, follow-up, and illustrative reporting.",
};

const PAINS = [
  "Missed calls become missed jobs.",
  "Voicemails don't qualify leads.",
  "Follow-up gets delayed or forgotten.",
  "CRM records stay incomplete.",
  "Job context stays trapped in conversations.",
  "Founders can't see which opportunities are leaking.",
];

const LOOP = [
  "Call evidence",
  "Qualification",
  "Mock CRM state",
  "Operational memory",
  "Founder action",
];

const STEPS = [
  {
    n: "01",
    title: "A fictional call is persisted",
    body: "The sandbox begins with tenant-scoped call evidence for a fictional after-hours inquiry.",
  },
  {
    n: "02",
    title: "A follow-up state is recorded",
    body: "The walkthrough shows the intended follow-up state without sending a text, placing a callback, or invoking a provider.",
  },
  {
    n: "03",
    title: "The fictional lead is qualified",
    body: "Seeded service-area, urgency, and job-type facts produce an illustrative qualification record for operator review.",
  },
  {
    n: "04",
    title: "A human callback is queued",
    body: "The next action is a human callback. No appointment, quote, deal, or scheduling-provider action is created.",
  },
  {
    n: "05",
    title: "Illustrative value is displayed",
    body: "The dashboard labels estimated opportunity value separately from verified outcomes and recovered revenue.",
  },
];

const FAQS = [
  {
    q: "Is ResponseOS just an AI receptionist?",
    a: "No. The product direction connects call evidence, qualification, CRM synchronization, operational context, and a human next action. This public walkthrough demonstrates that model with fictional records.",
  },
  {
    q: "Is this real customer data?",
    a: "No. The demo uses clearly-labeled mock data only — fictional names, numbers, and scenarios. No real customer or personal information.",
  },
  {
    q: "Is the demo live or simulated?",
    a: "This public walkthrough is simulated on persisted fictional data. A separate supervised live-call surface remains hidden unless its environment and release gates are explicitly enabled.",
  },
  {
    q: "Is advanced AI memory active?",
    a: "Not yet. Phase-1 Business Memory is structured event capture only — transcript, summary, intent, urgency, follow-up status, next action. Per-tenant knowledge and retrieval are intentionally gated for a later phase.",
  },
  {
    q: "Will I be locked into one phone or CRM vendor?",
    a: "ResponseOS uses provider-adapter boundaries to reduce coupling. Actual portability still depends on each provider's account, number, data-export, and contract rules.",
  },
];

export default function DemoPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 sm:px-6">
      <section className="relative isolate overflow-hidden">
        <AtmosphereBackground
          family="ledger-depth"
          size="1600x900"
          intensity={0.6}
        />
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Guided walkthrough
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
          From fictional call to evidence-backed follow-up
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
          Walk through a persisted fictional lifecycle in an isolated sandbox.
          Every value and provider effect is labeled by its evidence status.
        </p>
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">
          This walkthrough demonstrates the operating model; it does not claim
          a live call, CRM write, booking, or recovered revenue.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/demo/walkthrough" glow>
            Revenue Recovery Demo
          </ButtonLink>
          <ButtonLink href="/audit" variant="secondary">
            Run a revenue audit
          </ButtonLink>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold text-ink">
          The problem isn&apos;t that customers aren&apos;t calling
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
          Too much intent disappears between the phone call, the CRM, the
          follow-up task, and the founder&apos;s memory. By the time anyone
          notices, the job is gone.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {PAINS.map((p) => (
            <Card key={p} className="flex items-start gap-3" interactive>
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-action" />
              <p className="text-sm text-ink-secondary">{p}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold text-ink">
          One evidence chain, from the call record to the next action
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
          The sandbox demonstrates how call evidence, qualification, mock CRM
          state, operational context, and a human next action connect without
          invoking a live provider.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {LOOP.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <span className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink">
                {step}
              </span>
              {i < LOOP.length - 1 ? (
                <span className="text-ink-muted" aria-hidden>
                  →
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold text-ink">
          See the revenue recovery loop
        </h2>
        <ol className="mt-6 space-y-4">
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

      <section className="mt-16">
        <Card className="p-8">
          <h2 className="font-display text-2xl font-semibold text-ink">
            It doesn&apos;t just answer the call — it remembers what happened
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-ink-secondary">
            Business Memory means the conversation doesn&apos;t vanish when the
            call ends. ResponseOS keeps the operational context — transcript,
            summary, lead intent, service need, urgency, follow-up status, and
            next action — so your team can pick up exactly where the caller left
            off.
          </p>
          <p className="mt-4 max-w-2xl rounded-lg border border-line bg-canvas-soft p-4 text-sm text-ink-muted">
            <span className="font-medium text-ink-secondary">
              Honest scope:
            </span>{" "}
            Phase-1 Business Memory is structured operational capture, not a
            black-box &ldquo;AI brain.&rdquo; Per-tenant knowledge and retrieval
            come in a later phase — Phase 1 is about never losing the context of
            a call.
          </p>
        </Card>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Questions, answered straight
        </h2>
        <div className="mt-6 space-y-3">
          {FAQS.map((f) => (
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
            Start with a Revenue Recovery Demo
          </h2>
          <p className="mt-1 max-w-xl text-sm text-ink-secondary">
            Inspect how fictional call evidence, qualification, mock CRM state,
            and a human follow-up remain linked inside the sandbox.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <ButtonLink href="/demo/walkthrough" glow>
            Revenue Recovery Demo
          </ButtonLink>
          <ButtonLink href="/demo/client-dashboard" variant="secondary">
            Client dashboard
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
