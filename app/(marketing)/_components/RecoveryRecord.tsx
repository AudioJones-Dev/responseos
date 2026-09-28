import { StatusBadge, type Tone } from "@/components/ui";
import { business, call, lead, usdRange } from "../../(demo)/_data/scenario";

type Step = {
  time: string;
  title: string;
  detail: string;
  state: { label: string; tone: Tone };
  quote?: string;
  facts?: { label: string; value: string }[];
};

const callerQuote = call.transcript.find((line) => line.speaker === "Caller");

const STEPS: Step[] = [
  {
    time: "21:47",
    title: "After-hours call received",
    detail: `${lead.name} called ${business.name} after hours. In this scenario the AI receptionist answered instead of voicemail.`,
    state: { label: "Simulated", tone: "neutral" },
  },
  {
    time: "21:47",
    title: "Need and urgency captured",
    detail: `${call.serviceRequested}.`,
    quote: callerQuote?.text,
    state: { label: "Transcript", tone: "neutral" },
  },
  {
    time: "21:49",
    title: "Qualified",
    detail: `Score ${call.qualificationScore}/100 from the criteria below.`,
    facts: [
      { label: "Service area", value: `${lead.region} — in area` },
      { label: "Urgency", value: "High — safety-critical" },
      { label: "Decision-maker", value: "Confirmed" },
      { label: "Consent", value: "Call + SMS" },
    ],
    state: { label: "Illustrative score", tone: "neutral" },
  },
  {
    time: "21:50",
    title: "Context recorded",
    detail: "Transcript, summary, intent, and next action written to the event record.",
    state: { label: "Recorded", tone: "success" },
  },
  {
    time: "21:50",
    title: "Next action assigned to a person",
    detail: `${call.nextAction.label} — ${call.nextAction.owner}, ${call.nextAction.dueAt}.`,
    state: { label: "Human handoff", tone: "warning" },
  },
  {
    time: "Open",
    title: "Booking",
    detail: "Appointment requested, not booked. No calendar is connected in the demo, so the record stays open.",
    state: { label: "Unresolved", tone: "warning" },
  },
  {
    time: "Open",
    title: "CRM record",
    detail: "Not written. HubSpot sync is mock-only in this scenario.",
    state: { label: "Not connected", tone: "neutral" },
  },
];

const REVENUE_STATES = ["Estimated", "Booked", "Completed", "Collected"] as const;
const CURRENT_REVENUE_STATE = "Estimated";

export function RecoveryRecord() {
  return (
    <div className="overflow-hidden rounded-lg border border-line-strong bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas-soft px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-ink-muted">{lead.id}</span>
          <span className="text-sm font-semibold text-ink">Recovery record</span>
        </div>
        <StatusBadge label="Guided simulation — seeded scenario, not live customer data" tone="warning" />
      </div>

      <div className="grid gap-px bg-line lg:grid-cols-[1.6fr_1fr]">
        <ol className="bg-surface p-5 sm:p-6">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
              {i < STEPS.length - 1 ? (
                <span className="absolute left-[calc(3.8125rem-0.5px)] top-5 bottom-0 w-px bg-line" aria-hidden />
              ) : null}
              <span className="w-10 shrink-0 pt-0.5 font-mono text-xs text-ink-muted">{step.time}</span>
              <span
                className={
                  step.time === "Open"
                    ? "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border border-line-strong"
                    : "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-ink-secondary"
                }
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink">{step.title}</h3>
                  <StatusBadge label={step.state.label} tone={step.state.tone} />
                </div>
                <p className="mt-1 text-sm text-ink-secondary">{step.detail}</p>
                {step.quote ? (
                  <blockquote className="mt-2 border-l border-line-strong pl-3 text-sm italic text-ink-secondary">
                    “{step.quote}”
                  </blockquote>
                ) : null}
                {step.facts ? (
                  <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                    {step.facts.map((f) => (
                      <div key={f.label} className="flex gap-1.5">
                        <dt className="text-ink-muted">{f.label}:</dt>
                        <dd className="text-ink-secondary">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-6 bg-surface p-5 sm:p-6">
          <dl className="grid gap-3 text-sm">
            {[
              ["Caller", lead.name],
              ["Service", `${lead.serviceCategory} — ${lead.workType.toLowerCase()}`],
              ["Source", lead.sourceAttribution],
              ["Owner", lead.followUpOwner],
              ["Estimated value", usdRange(lead.estimatedValue)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
                <dd className="mt-0.5 text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <div>
            <p className="text-xs uppercase tracking-wide text-ink-muted">Revenue state</p>
            <ol className="mt-3 flex flex-wrap gap-2">
              {REVENUE_STATES.map((state) => (
                <li
                  key={state}
                  className={
                    state === CURRENT_REVENUE_STATE
                      ? "rounded-full border border-accent/40 bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent"
                      : "rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-muted"
                  }
                  aria-current={state === CURRENT_REVENUE_STATE ? "step" : undefined}
                >
                  {state}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-ink-muted">
              This record stops at an estimate. An estimate is not recovered
              revenue; the record moves to Booked only when a real appointment
              exists.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
