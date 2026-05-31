import { PageHeader, Card, CardHeading, StatusBadge, ButtonLink } from "@/components/ui";
import { MemoryGatesPanel } from "../../../_components/MemoryGatesPanel";
import { memory } from "../../../_data/scenario";

export default function BusinessMemory() {
  return (
    <>
      <PageHeader
        eyebrow="Step 4 · Business Memory"
        title="What the business now remembers"
        description={`${memory.model} · captured ${memory.capturedAt}`}
        actions={<StatusBadge label="Phase 1" tone="accent" />}
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeading>Captured record</CardHeading>
            <p className="mt-3 text-sm text-ink-secondary">{memory.summary}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Operational context</p>
                <p className="mt-1.5 text-sm text-ink-secondary">{memory.operationalContext}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Commercial context</p>
                <p className="mt-1.5 text-sm text-ink-secondary">{memory.commercialContext}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {memory.entities.map((e) => (
                <span
                  key={e.label}
                  className="rounded-md border border-line bg-surface-elevated px-2.5 py-1 text-xs text-ink-secondary"
                >
                  <span className="text-ink-muted">{e.label}:</span> {e.value}
                </span>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeading>Event-ledger trail</CardHeading>
            <ol className="mt-4 flex flex-col gap-3">
              {memory.trail.map((step) => (
                <li key={step.t} className="flex gap-3">
                  <span className="w-12 shrink-0 pt-0.5 font-mono text-[11px] text-ink-muted">{step.t}</span>
                  <div>
                    <p className="text-sm font-medium text-ink">{step.event}</p>
                    <p className="text-sm text-ink-secondary">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <MemoryGatesPanel />
          <Card>
            <CardHeading>Next actions on file</CardHeading>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {memory.nextActions.map((a) => (
                <li key={a.label}>
                  <p className="font-medium text-ink">{a.label}</p>
                  <p className="text-ink-secondary">{a.owner} · {a.dueAt}</p>
                </li>
              ))}
            </ul>
          </Card>
          <ButtonLink href="/demo/walkthrough/follow-up">See the follow-up queue →</ButtonLink>
        </div>
      </div>
    </>
  );
}
