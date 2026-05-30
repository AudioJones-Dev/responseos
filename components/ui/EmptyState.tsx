import type { ReactNode } from "react";

/**
 * EmptyState — DESIGN.md §15. Never a blank screen: explain why it's empty and
 * the next best action. Avoid generic "No data found".
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface/40 px-6 py-16 text-center">
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-secondary">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
