import type { ReactNode } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui";

const NAV = [
  { label: "Platform", href: "/" },
  { label: "Industries", href: "/industries/home-services" },
  { label: "Pricing", href: "/pricing" },
  { label: "Demo", href: "/demo" },
];

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-base/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-sm font-bold text-white">
              R
            </span>
            <span className="font-display text-sm font-semibold text-ink">
              ResponseOS
            </span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-ink-secondary transition-colors hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="hidden text-sm text-ink-secondary transition-colors hover:text-ink sm:inline"
            >
              Operator console
            </Link>
            <ButtonLink href="/audit" size="sm">
              Run a revenue audit
            </ButtonLink>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-ink-muted sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="font-display text-sm font-semibold text-ink-secondary">
              ResponseOS
            </span>
            <Link href="/pricing" className="hover:text-ink-secondary">
              Pricing
            </Link>
            <Link href="/demo" className="hover:text-ink-secondary">
              Demo
            </Link>
            <Link href="/audit" className="hover:text-ink-secondary">
              Revenue audit
            </Link>
          </div>
          <p>
            © {new Date().getFullYear()} AJ Digital LLC. ResponseOS is an
            internal-first product in active development — this is a local
            scaffold with mock data and no live integrations.
          </p>
        </div>
      </footer>
    </div>
  );
}
