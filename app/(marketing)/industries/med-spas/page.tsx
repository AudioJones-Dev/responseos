import { ButtonLink, Card } from "@/components/ui";

export const metadata = {
  title: "For med spas",
  description:
    "ResponseOS for med spas — high-ticket consults booked before they cool, with discreet, on-brand follow-up.",
};

const POINTS = [
  {
    title: "Catch the consult request",
    body: "High-ticket consult inquiries are captured the instant they come in — across calls, texts, and form fills.",
  },
  {
    title: "Qualify fit, not just interest",
    body: "Service, timing, and decision-maker are scored so your front desk spends time on consults that convert.",
  },
  {
    title: "Book before the lead cools",
    body: "Qualified consults route straight to a confirmed appointment, attributed back to the original inquiry.",
  },
];

export default function MedSpasPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
        For med spas
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-[1.1] text-ink sm:text-4xl">
        High-ticket consults, booked before they cool
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
        High-ticket consults need fast response. ResponseOS catches the consult
        request, qualifies fit on service, timing, and decision-maker, and books
        the appointment before the lead cools off.
      </p>
      <div className="mt-8">
        <ButtonLink href="/audit">Request a revenue audit</ButtonLink>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {POINTS.map((point) => (
          <Card key={point.title} interactive>
            <h2 className="text-lg font-semibold text-ink">{point.title}</h2>
            <p className="mt-2 text-sm text-ink-secondary">{point.body}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
