/** Inline stroke icons (24×24, currentColor) — dependency-free, on-theme. */
type IconProps = { className?: string };

const wrap = (path: React.ReactNode) =>
  function Icon({ className }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        {path}
      </svg>
    );
  };

export const Icons = {
  overview: wrap(
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>,
  ),
  clients: wrap(
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M15 11a3 3 0 1 0-1.5-5.6" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M15.5 19a5.5 5.5 0 0 1 5-5.4" />
    </>,
  ),
  workspaces: wrap(
    <>
      <path d="M3 21V7l9-4 9 4v14" />
      <path d="M3 21h18" />
      <path d="M9 21v-6h6v6" />
    </>,
  ),
  calls: wrap(
    <path d="M5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3 5.7 2 2 0 0 1 5 3.5Z" />,
  ),
  leads: wrap(
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </>,
  ),
  appointments: wrap(
    <>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M3.5 9h17M8 3v3M16 3v3" />
      <path d="M8.5 14.5l2.5 2.5 4-4.5" />
    </>,
  ),
  quotes: wrap(
    <>
      <path d="M6 3h8l4 4v14H6Z" />
      <path d="M14 3v4h4" />
      <path d="M9 13h6M9 16.5h4" />
    </>,
  ),
  revenue: wrap(
    <>
      <path d="M12 3v18" />
      <path d="M16.5 7.5c-1-1.3-2.7-2-4.5-2-2.5 0-4 1.2-4 3s1.5 2.6 4 3 4 1.2 4 3-1.7 3-4 3c-1.9 0-3.6-.8-4.5-2" />
    </>,
  ),
  reports: wrap(
    <>
      <path d="M4 20V4M20 20H4" />
      <path d="M8 16v-4M12 16V7M16 16v-6" />
    </>,
  ),
  automations: wrap(
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
  ),
  playbooks: wrap(
    <>
      <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17H7.5A2.5 2.5 0 0 0 5 21.5Z" />
      <path d="M5 4.5v17" />
    </>,
  ),
  billing: wrap(
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
    </>,
  ),
  settings: wrap(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.5M12 19v2.5M4.5 4.5l1.8 1.8M17.7 17.7l1.8 1.8M2.5 12H5M19 12h2.5M4.5 19.5l1.8-1.8M17.7 6.3l1.8-1.8" />
    </>,
  ),
};

export type IconName = keyof typeof Icons;
