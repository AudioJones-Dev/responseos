import { cn } from "@/components/ui/cn";

export type AtmosphereFamily =
  | "signal-field"
  | "revenue-grid"
  | "noise-glass"
  | "recovery-beam"
  | "ledger-depth";

/**
 * Decorative background layer from the Penumbra Signal atmosphere asset system
 * (`public/backgrounds/responseos/*`). Renders an aria-hidden, absolutely-
 * positioned SVG behind content.
 *
 * Host must be `relative isolate overflow-hidden`; the layer sits at `-z-10`
 * so in-flow content stays on top. `intensity` (0–1) is the layer opacity —
 * dial families down at apply-time (e.g. Recovery Beam used sparingly) without
 * re-rendering source assets.
 */
export function AtmosphereBackground({
  family,
  size = "1600x900",
  intensity = 1,
  position = "center",
  className,
}: {
  family: AtmosphereFamily;
  size?: string;
  intensity?: number;
  position?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 bg-cover", className)}
      style={{
        backgroundImage: `url(/backgrounds/responseos/${family}/${family}.${size}.svg)`,
        backgroundPosition: position,
        opacity: intensity,
      }}
    />
  );
}
