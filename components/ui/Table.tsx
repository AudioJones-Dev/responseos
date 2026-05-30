import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * DataTable primitives — DESIGN.md §9. Sticky header, row hover, tight density.
 * Composed by pages: <Table><THead/><TBody>{rows}</TBody></Table>.
 */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className={cn("w-full text-left text-sm", className)}>{children}</table>
    </div>
  );
}

export function THead({ columns }: { columns: ReactNode[] }) {
  return (
    <thead className="sticky top-0 z-10 bg-surface-elevated">
      <tr>
        {columns.map((c, i) => (
          <th
            key={i}
            className="whitespace-nowrap border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted"
          >
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-line/60 transition-colors last:border-0 hover:bg-surface-elevated/60">
      {children}
    </tr>
  );
}

export function TD({
  children,
  className,
  mono = false,
}: {
  children: ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-4 py-3 text-ink-secondary",
        mono && "font-mono text-xs text-ink-muted",
        className,
      )}
    >
      {children}
    </td>
  );
}
