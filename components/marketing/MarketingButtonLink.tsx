"use client";

import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui";
import {
  recordMarketingEvent,
  type MarketingEventName,
} from "@/lib/analytics/marketing";

export function MarketingButtonLink({
  event,
  href,
  children,
  variant = "primary",
  size = "md",
  glow = false,
  className,
}: {
  event: MarketingEventName;
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  glow?: boolean;
  className?: string;
}) {
  return (
    <ButtonLink
      href={href}
      variant={variant}
      size={size}
      glow={glow}
      className={className}
      onClick={() => recordMarketingEvent(event)}
    >
      {children}
    </ButtonLink>
  );
}
