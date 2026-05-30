import { cn } from "./cn";

export type Tone = "success" | "warning" | "danger" | "neutral" | "accent" | "info";

const toneStyles: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent-soft text-accent",
  neutral: "bg-neutral-soft text-ink-secondary",
  info: "bg-neutral-soft text-ink-secondary",
};

/**
 * StatusBadge — record state as a compact pill. Never color-only: always a
 * text label, with a tone dot for non-color affordance (DESIGN.md §9, §14).
 */
export function StatusBadge({
  label,
  tone = "neutral",
  dot = true,
}: {
  label: string;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneStyles[tone],
      )}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      ) : null}
      {label}
    </span>
  );
}
