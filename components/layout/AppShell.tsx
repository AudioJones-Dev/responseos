import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import type { NavItem } from "./nav";

/**
 * AppShell — sidebar + topbar + fluid main (max-width 1440, centered).
 * Shared by the admin console and client portal (DESIGN.md §4).
 */
export function AppShell({
  items,
  product,
  scope,
  switchHref,
  switchLabel,
  children,
}: {
  items: NavItem[];
  product: string;
  scope: string;
  switchHref: string;
  switchLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full">
      <Sidebar items={items} product={product} scope={scope} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          items={items}
          title={scope}
          switchHref={switchHref}
          switchLabel={switchLabel}
        />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
