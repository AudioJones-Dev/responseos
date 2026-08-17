import type { ReactNode } from "react";
import Link from "next/link";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { Logo } from "@/components/layout/Logo";
import { MarketingButtonLink } from "@/components/marketing/MarketingButtonLink";

const NAV = [
  { label: "Platform", href: "/" },
  { label: "Industries", href: "/industries/home-services" },
  { label: "Pricing", href: "/pricing" },
  { label: "Trust", href: "/trust" },
  { label: "Demo", href: "/demo" },
];

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-base/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
          <Logo />
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
              href="/demo/operator-console"
              className="hidden text-sm text-ink-secondary transition-colors hover:text-ink sm:inline"
            >
              Operator console
            </Link>
            <MarketingButtonLink
              event="homepage_nav_audit_clicked"
              href="/audit"
              size="sm"
              glow
              className="whitespace-nowrap"
            >
              Request a revenue audit
            </MarketingButtonLink>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-ink-muted sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Logo className="mr-1" />
              <Link href="/pricing" className="hover:text-ink-secondary">
                Pricing
              </Link>
              <Link href="/demo" className="hover:text-ink-secondary">
                Demo
              </Link>
              <Link href="/audit" className="hover:text-ink-secondary">
                Revenue audit
              </Link>
              <Link href="/trust" className="hover:text-ink-secondary">
                Trust
              </Link>
            </div>
            <SocialLinks />
          </div>
          <p>
            Revenue recovery infrastructure for founder-led service businesses.
            ResponseOS is built by AJ Digital LLC and is not HIPAA-certified.
          </p>
          <p>
            © {new Date().getFullYear()} AJ Digital LLC. The current product
            preview uses sample data and has no live provider integrations.
          </p>
        </div>
      </footer>
    </div>
  );
}
