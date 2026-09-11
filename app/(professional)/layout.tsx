import type { ReactNode } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/layout/Logo";

/**
 * The professional receptionist runs on a different footing from the
 * revenue-recovery walkthrough, so it does not share that layout.
 *
 * `app/(demo)/layout.tsx` frames its children as Coastal Comfort — a
 * fictional business — and closes with "fictional scenario, no real
 * customer information". Every record this receptionist speaks is the
 * opposite: verified, attributed, and about a real person. Rendering one
 * under the other's chrome tells the visitor both things at once, and
 * the status vocabulary is load-bearing (doctrine §20).
 *
 * What is simulated here is the delivery, not the content: knowledge and
 * scheduling resolve to mock adapters. The footer says exactly that.
 */
export default function ProfessionalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-base text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-base/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[900px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/demo" className="flex min-w-0 items-center gap-2.5">
            <LogoMark className="h-7 shrink-0" />
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="font-display text-sm font-semibold text-ink">
                Professional receptionist
              </span>
              <span className="truncate text-[11px] text-ink-muted">
                Internal demo tenant
              </span>
            </span>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            Mock adapters
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[900px] flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-line">
        <p className="mx-auto w-full max-w-[900px] px-4 py-5 text-xs text-ink-muted sm:px-6">
          Records shown here are real and verified against their sources — this
          is not the fictional walkthrough scenario. What is simulated is the
          delivery: knowledge and scheduling resolve to mock adapters and no
          live provider is connected. © {new Date().getFullYear()} AJ Digital
          LLC.
        </p>
      </footer>
    </div>
  );
}
