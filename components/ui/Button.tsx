import type { ComponentProps, MouseEventHandler, ReactNode } from "react";
import Link from "next/link";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[color,background-color,border-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Penumbra Signal glow — opt-in only (Brand 2.1). Inset top-edge lip + a
 * restrained Signal-Yellow ring on hover/focus. Reserved for marketing/demo
 * CTAs; not applied to console/app buttons by default.
 */
const glowCls =
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.36)] hover:shadow-[0_0_0_6px_rgba(232,255,90,0.12)] focus-visible:shadow-[0_0_0_6px_rgba(232,255,90,0.12)] focus-visible:outline-none";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-black hover:bg-accent-hover",
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
  glow = false,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; glow?: boolean }) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], glow && glowCls, className)}
      {...props}
    />
  );
}

/** Link styled as a button — for navigation actions. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  glow = false,
  className,
  children,
  href,
  onClick,
}: {
  variant?: Variant;
  size?: Size;
  glow?: boolean;
  className?: string;
  children: ReactNode;
  href: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(base, variants[variant], sizes[size], glow && glowCls, className)}
    >
      {children}
    </Link>
  );
}
