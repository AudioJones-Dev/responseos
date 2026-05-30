import type { ReactNode } from "react";
import { cn } from "./cn";

/** Standard page header — eyebrow label, title (Sora), optional description + actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-ink-secondary">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </header>
  );
}
