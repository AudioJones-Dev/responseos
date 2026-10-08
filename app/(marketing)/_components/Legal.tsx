import type { ReactNode } from "react";

export const LEGAL_CONTACT_EMAIL = "privacy@ajdigital.app";

export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
        Legal
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold leading-[1.1] text-ink sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-sm text-ink-muted">Last updated {lastUpdated}</p>
      {children}
    </main>
  );
}

export function LegalIntro({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 space-y-4 text-base leading-relaxed text-ink-secondary">
      {children}
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-ink-secondary">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function ContactEmail() {
  return (
    <a
      href={`mailto:${LEGAL_CONTACT_EMAIL}`}
      className="text-ink underline underline-offset-2"
    >
      {LEGAL_CONTACT_EMAIL}
    </a>
  );
}
