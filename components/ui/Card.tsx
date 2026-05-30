import type { ReactNode } from "react";
import { cn } from "./cn";

/** Data surface — DESIGN.md §4 Cards. Background surface, subtle border, hover brighten. */
export function Card({
  children,
  className,
  as: Tag = "div",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "section";
  interactive?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "rounded-lg border border-line bg-surface p-5",
        interactive && "transition-colors hover:border-line-strong",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn("text-lg font-semibold text-ink", className)}>
      {children}
    </h3>
  );
}
