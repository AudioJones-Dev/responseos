import { ButtonLink, Card } from "@/components/ui";
import { AtmosphereBackground } from "@/components/layout/AtmosphereBackground";

export const metadata = {
  title: "Product demo",
  description:
    "Walk ResponseOS from missed call to recovered revenue on seeded mock data — capture, qualify, follow-up, booking, and reporting.",
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
  "Call",
  "Qualify",
  "CRM sync",
  "Business Memory",
  "Founder action",
];

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

const FAQS = [
  {
    q: "Is ResponseOS just an AI receptionist?",
    a: "No. Answering the call is the wedge. ResponseOS is a revenue-recovery and founder-intelligence system — it qualifies the lead, keeps the CRM updated, captures the business context, and shows you what to do next.",
  },
  {
    q: "Is this real customer data?",
    a: "No. The demo uses clearly-labeled mock data only — fictional names, numbers, and scenarios. No real customer or personal information.",
  },
  {
    q: "Is the demo live or simulated?",
    a: "The current demo is a guided, simulated walkthrough on seeded mock data. Live provider integrations are gated until v0.3.",
  },
  {
    q: "Is advanced AI memory active?",
    a: "Not yet. Phase-1 Business Memory is structured event capture only — transcript, summary, intent, urgency, follow-up status, next action. Per-tenant knowledge and retrieval are intentionally gated for a later phase.",
  },
  {
    q: "Will I be locked into one phone or CRM vendor?",
    a: "No. ResponseOS is designed with provider abstraction so your CRM stays yours and your numbers stay portable — the system is built to route around any single provider.",
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
          From missed call to recovered revenue
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
          Walk through ResponseOS on mock data — the full RECOVER loop, end to
          end. Every step ties back to a dollar figure on the dashboard.
        </p>
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">
          Every missed call is a missed job. ResponseOS catches the ones that
          pay.
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
          One system, from the call to the next action
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
          ResponseOS captures inbound demand, qualifies the caller, updates the
          CRM, records the operational context, and surfaces the next action —
          so the opportunity moves forward instead of leaking.
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
            See how ResponseOS captures missed demand, qualifies leads, keeps
            the CRM updated, and turns calls into business memory — on mock data.
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
