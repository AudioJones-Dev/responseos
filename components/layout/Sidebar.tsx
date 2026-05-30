"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "./icons";
import type { NavItem } from "./nav";
import { cn } from "@/components/ui/cn";

/**
 * Sidebar — 240px fixed on desktop, icon-only on tablet, hidden on mobile
 * (the TopBar carries a section label there). Active state: accent left border
 * + subtle highlight (DESIGN.md §4).
 */
export function Sidebar({
  items,
  product,
  scope,
}: {
  items: NavItem[];
  product: string;
  scope: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface/60 md:flex md:w-[68px] lg:w-60">
      <Link
        href="/"
        className="flex h-16 items-center gap-2.5 border-b border-line px-4"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent text-sm font-bold text-white">
          R
        </span>
        <span className="hidden flex-col leading-tight lg:flex">
          <span className="font-display text-sm font-semibold text-ink">
            {product}
          </span>
          <span className="text-[11px] text-ink-muted">{scope}</span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/admin" &&
              item.href !== "/client/dashboard" &&
              pathname.startsWith(item.href));
          const Icon = Icons[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={item.label}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-surface-elevated text-ink"
                  : "text-ink-secondary hover:bg-surface-elevated/60 hover:text-ink",
              )}
            >
              <span
                className={cn(
                  "absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r bg-accent transition-all",
                  active ? "w-0.5 opacity-100" : "w-0 opacity-0",
                )}
                aria-hidden
              />
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="hidden border-t border-line p-4 lg:block">
        <p className="text-[11px] leading-relaxed text-ink-muted">
          Mock data — no live providers connected.
        </p>
      </div>
    </aside>
  );
}
