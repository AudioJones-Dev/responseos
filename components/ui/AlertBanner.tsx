import type { ReactNode } from "react";
import { cn } from "./cn";

type Variant = "info" | "warning" | "danger" | "success";

const variants: Record<Variant, string> = {
  info: "border-line-strong bg-surface-elevated text-ink-secondary",
  success: "border-success/30 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  danger: "border-danger/30 bg-danger-soft text-danger",
};

/** AlertBanner — system-level notice. DESIGN.md §9. */
export function AlertBanner({
  variant = "info",
  children,
  className,
}: {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        variants[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
