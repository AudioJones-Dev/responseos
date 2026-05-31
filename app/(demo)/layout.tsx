import type { ReactNode } from "react";
import Link from "next/link";
import { DemoNav } from "./_components/DemoNav";
import { DemoStepFooter } from "./_components/DemoStepFooter";
import { business } from "./_data/scenario";
import { LogoMark } from "@/components/layout/Logo";

export default function DemoWalkthroughLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-base text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-base/80 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/demo/walkthrough" className="flex min-w-0 items-center gap-2.5">
            <LogoMark className="h-7 shrink-0" />
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="font-display text-sm font-semibold text-ink">
                Revenue Recovery Demo
              </span>
              <span className="truncate text-[11px] text-ink-muted">{business.name}</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
              Demo mode
            </span>
            <Link
              href="/demo"
              className="hidden rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-surface-elevated hover:text-ink sm:inline"
            >
              Exit demo
            </Link>
          </div>
        </div>
        <DemoNav />
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-6">
        {children}
        <DemoStepFooter />
      </main>

      <footer className="border-t border-line">
        <p className="mx-auto w-full max-w-[1200px] px-4 py-5 text-xs text-ink-muted sm:px-6">
          Demo data only — fictional scenario, no real customer information, no live providers
          connected. © {new Date().getFullYear()} AJ Digital LLC.
        </p>
      </footer>
    </div>
  );
}
