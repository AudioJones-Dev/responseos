import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "border border-line-strong text-ink hover:bg-surface-elevated",
  ghost: "text-ink-secondary hover:bg-surface-elevated hover:text-ink",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

/** ActionButton — DESIGN.md §9. One primary per context; accent fill is reserved. */
export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props} />
  );
}

/** Link styled as a button — for navigation actions. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  href,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  href: string;
}) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}
