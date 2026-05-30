"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "./icons";
import type { NavItem } from "./nav";
import { cn } from "@/components/ui/cn";

/**
 * TopBar — sticky global bar. On desktop it carries the section title + a
 * context switch; on mobile it doubles as a horizontally-scrollable nav since
 * the sidebar is hidden (DESIGN.md §4, §13).
 */
export function TopBar({
  items,
  title,
  switchHref,
  switchLabel,
}: {
  items: NavItem[];
  title: string;
  switchHref: string;
  switchLabel: string;
}) {
  const pathname = usePathname();
  const current = items.find(
    (i) => pathname === i.href || (i.href.split("/").length > 2 && pathname.startsWith(i.href)),
  );

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-base/80 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate font-display text-sm font-semibold text-ink">
            {current?.label ?? title}
          </span>
          <span className="hidden rounded-full bg-neutral-soft px-2 py-0.5 text-[11px] font-medium text-ink-secondary sm:inline">
            {title}
          </span>
        </div>
        <Link
          href={switchHref}
          className="shrink-0 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-surface-elevated hover:text-ink"
        >
          {switchLabel}
        </Link>
      </div>

      {/* Mobile nav strip */}
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
        {items.map((item) => {
          const active = pathname === item.href || (item.href.split("/").length > 2 && pathname.startsWith(item.href));
          const Icon = Icons[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                active
                  ? "bg-surface-elevated text-ink"
                  : "text-ink-secondary hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
