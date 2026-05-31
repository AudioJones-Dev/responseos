"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { steps } from "../_data/scenario";

/** Prev / Next footer that walks the demo steps in order. */
export function DemoStepFooter() {
  const pathname = usePathname();
  const i = steps.findIndex((s) => s.href === pathname);
  const prev = i > 0 ? steps[i - 1] : null;
  const next = i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;

  return (
    <div className="mt-10 flex items-center justify-between border-t border-line pt-6">
      {prev ? (
        <Link
          href={prev.href}
          className="rounded-lg border border-line-strong px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-surface-elevated hover:text-ink"
        >
          ← {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={next.href}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-accent-hover"
        >
          {next.label} →
        </Link>
      ) : (
        <Link
          href="/demo"
          className="rounded-lg border border-line-strong px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-surface-elevated hover:text-ink"
        >
          Back to demo overview
        </Link>
      )}
    </div>
  );
}
