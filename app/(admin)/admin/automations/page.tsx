import { PageHeader, Card, CardHeading, StatusBadge, AlertBanner } from "@/components/ui";

const triggers = [
  {
    name: "Missed call",
    description: "Inbound call goes unanswered — capture caller and start follow-up.",
    tone: "warning" as const,
    state: "Pending",
  },
  {
    name: "After-hours inquiry",
    description: "Contact arrives outside business hours — acknowledge and queue.",
    tone: "warning" as const,
    state: "Pending",
  },
  {
    name: "New lead",
    description: "Fresh lead event — qualify and route to the right sequence.",
    tone: "neutral" as const,
    state: "Pending",
  },
  {
    name: "Quote requested",
    description: "Prospect asks for pricing — draft and send a quote.",
    tone: "neutral" as const,
    state: "Pending",
  },
  {
    name: "Booking created",
    description: "Appointment confirmed — send reminders and prep details.",
    tone: "neutral" as const,
    state: "Pending",
  },
  {
    name: "No response",
    description: "Lead has gone quiet — nudge with a timed follow-up.",
    tone: "neutral" as const,
    state: "Pending",
  },
  {
    name: "Job completed",
    description: "Work is done — request review and surface upsell.",
    tone: "neutral" as const,
    state: "Pending",
  },
];

export default function AdminAutomationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Operator Console"
        title="Automations"
        description="Trigger-driven workflows that turn missed demand into booked work. Each trigger fires a sequence on the internal runner."
      />

      <AlertBanner className="mb-6">
        Workflow triggers are previewed here. Live runner connections (n8n / Make
        / internal) wire up in v0.3.
      </AlertBanner>

      <section className="grid gap-4 sm:grid-cols-2">
        {triggers.map((t) => (
          <Card key={t.name} interactive>
            <div className="flex items-start justify-between gap-3">
              <CardHeading>{t.name}</CardHeading>
              <StatusBadge label={t.state} tone={t.tone} />
            </div>
            <p className="mt-2 text-sm text-ink-secondary">{t.description}</p>
          </Card>
        ))}
      </section>
    </>
  );
}
