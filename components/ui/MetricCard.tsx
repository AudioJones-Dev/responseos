import type { ReactNode } from "react";
import { cn } from "./cn";

type Trend = "up" | "down" | "flat";

/**
 * MetricCard — single KPI: label, prominent value, optional delta/hint.
 * DESIGN.md §9 MetricCard / RevenueMetricCard. `revenue` styles the value as
 * financial-grade (accent or success), never the same as a generic metric.
 */
export function MetricCard({
  label,
  value,
  hint,
  delta,
  trend,
  revenue = false,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: string;
  trend?: Trend;
  revenue?: boolean;
  emphasis?: boolean;
}) {
  const trendColor =
    trend === "up"
      ? "text-success"
      : trend === "down"
        ? "text-danger"
        : "text-ink-muted";

  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface p-5 transition-colors hover:border-line-strong",
        emphasis && "border-accent/40",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold tabular-nums",
          revenue ? "font-display text-success" : "text-ink",
          revenue && emphasis && "text-accent",
        )}
      >
        {value}
      </p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta ? <span className={cn("font-medium", trendColor)}>{delta}</span> : null}
        {hint ? <span className="text-ink-muted">{hint}</span> : null}
      </div>
    </div>
  );
}
