"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { steps } from "../_data/scenario";
import { cn } from "@/components/ui/cn";

/** Top stepper for the demo walkthrough (active-state aware). */
export function DemoNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
      {steps.map((s, i) => {
        const active = pathname === s.href;
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors",
              active
                ? "bg-surface-elevated text-ink"
                : "text-ink-secondary hover:bg-surface-elevated/60 hover:text-ink",
            )}
          >
            <span
              className={cn(
                "grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold",
                active ? "bg-accent text-black" : "bg-neutral-soft text-ink-muted",
              )}
            >
              {i + 1}
            </span>
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
