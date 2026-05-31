/**
 * Marketing social links — Penumbra Signal treatment (Brand 2.1).
 * Inline currentColor brand glyphs (repo icon strategy, no new deps); platform
 * identity comes from the mark, not a platform-color fill. Muted by default,
 * Signal-Yellow + restrained glow ring on hover/focus (no blue, no brand fills).
 */
type Social = { label: string; href: string; path: string };

const SOCIALS: Social[] = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/audiojones/",
    path: "M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@audiojones",
    path: "M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z",
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/AudioJonesTheAIConsultant",
    path: "M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.02 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.01 1.79-4.68 4.53-4.68 1.31 0 2.68.24 2.68.24v2.96H15.83c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z",
  },
];

export function SocialLinks({ className }: { className?: string }) {
  return (
    <ul className={["flex list-none gap-2 p-0", className].filter(Boolean).join(" ")}>
      {SOCIALS.map((s) => (
        <li key={s.label}>
          <a
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.label}
            className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-muted transition-[color,border-color,box-shadow] hover:border-accent/50 hover:text-accent hover:shadow-[0_0_0_5px_rgba(232,255,90,0.10)] focus-visible:border-accent/50 focus-visible:text-accent focus-visible:shadow-[0_0_0_5px_rgba(232,255,90,0.10)] focus-visible:outline-none"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
              <path d={s.path} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
