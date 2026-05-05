interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "default" | "primary" | "warning";
}

const accentStyles: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "border-zinc-200 bg-white",
  primary: "border-emerald-200 bg-emerald-50",
  warning: "border-amber-200 bg-amber-50",
};

export default function StatCard({
  label,
  value,
  hint,
  accent = "default",
}: StatCardProps) {
  return (
    <div
      className={`rounded-xl border p-5 shadow-sm ${accentStyles[accent]}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-zinc-900">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}
