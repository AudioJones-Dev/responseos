import { ButtonLink, Card } from "@/components/ui";

export const metadata = {
  title: "For home services",
  description:
    "Missed-call response, intake, and booking for HVAC, roofing, plumbing, electrical, and landscaping businesses — designed around after-hours demand.",
};

const POINTS = [
  {
    title: "Catch the 6:42pm missed call",
    body: "After-hours and on-the-job calls get a response instead of voicemail.",
  },
  {
    title: "Reply in under 60 seconds",
    body: "An automated text opens the conversation before the homeowner dials the next contractor on their list.",
  },
  {
    title: "Qualify urgency, then book",
    body: "Service area, job type, and urgency are scored, and qualified demand is routed straight to a booked estimate.",
  },
];

export default function HomeServicesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
        For home services
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-[1.1] text-ink sm:text-4xl">
        Every missed call is a job that went to the next contractor.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
        HVAC, roofing, plumbing, electrical, landscaping. ResponseOS captures
        the missed call at 6:42pm, replies in seconds, qualifies the urgency,
        and books the estimate before the homeowner moves on.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/demo/walkthrough" glow>
          Revenue Recovery Demo
        </ButtonLink>
        <ButtonLink href="/audit" variant="secondary">
          Book the Readiness Assessment
        </ButtonLink>
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
