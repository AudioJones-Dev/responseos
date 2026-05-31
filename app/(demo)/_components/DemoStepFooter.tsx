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
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.36)] transition-[background-color,box-shadow] duration-200 hover:bg-accent-hover hover:shadow-[0_0_0_6px_rgba(232,255,90,0.12)] focus-visible:shadow-[0_0_0_6px_rgba(232,255,90,0.12)] focus-visible:outline-none"
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
