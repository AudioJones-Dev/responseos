interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "default" | "primary" | "warning";
}

const valueStyles: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "text-ink",
  primary: "text-accent",
  warning: "text-warning",
};

export default function StatCard({
  label,
  value,
  hint,
  accent = "default",
}: StatCardProps) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5 transition-colors hover:border-line-strong">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-semibold tabular-nums ${valueStyles[accent]}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
