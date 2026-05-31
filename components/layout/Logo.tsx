import Link from "next/link";
import { cn } from "@/components/ui/cn";

/**
 * ResponseOS RO mark (Brand 2.0/2.1, ADR-0025) — white "R" + Signal-Yellow "O"
 * ring, inlined for crisp rendering on dark surfaces. Mirrors
 * `public/brand/responseos-mark.svg`.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="76 130 360 250"
      className={cn("w-auto", className)}
      role="img"
      aria-label="ResponseOS"
    >
      <g fill="#FCFDFF">
        <rect x="106" y="160" width="64" height="190" rx="6" />
        <path
          fillRule="evenodd"
          d="M156 160 H206 C252 160 252 266 206 266 H156 Z M170 186 H202 C224 186 224 240 202 240 H170 Z"
        />
        <path d="M150 250 H206 L252 350 H196 Z" />
      </g>
      <rect
        x="278"
        y="160"
        width="128"
        height="190"
        rx="46"
        fill="none"
        stroke="#E8FF5A"
        strokeWidth="38"
      />
    </svg>
  );
}

/** Header lockup: RO mark + "ResponseOS" wordmark (Syne). */
export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      aria-label="ResponseOS home"
      className={cn("flex items-center gap-2.5", className)}
    >
      <LogoMark className="h-7 shrink-0" />
      <span className="font-display text-sm font-semibold text-ink">ResponseOS</span>
    </Link>
  );
}
