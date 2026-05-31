import { memory } from "../_data/scenario";

/**
 * Renders the Phase-1 Business Memory gates as an explicit DISABLED state.
 * RAG / vector / per-tenant knowledge are NOT active in Phase 1 (ADR-0034) —
 * this panel makes that visible and must never imply otherwise.
 */
export function MemoryGatesPanel() {
  const rows: { label: string; enabled: boolean }[] = [
    { label: "RAG retrieval", enabled: memory.gates.rag_enabled },
    { label: "Vector memory", enabled: memory.gates.vector_memory_enabled },
    { label: "Per-tenant knowledge", enabled: memory.gates.per_tenant_knowledge_enabled },
  ];
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        Memory mode — Phase 1 (operational event-ledger capture)
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between text-sm">
            <span className="text-ink-secondary">{r.label}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-soft px-2.5 py-0.5 text-xs font-medium text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
              {r.enabled ? "Active" : "Not active"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-muted">
        Advanced retrieval / vector / per-tenant knowledge is deliberately gated for a later phase.
      </p>
    </div>
  );
}
