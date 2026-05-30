import { PageHeader, Card, CardHeading, StatusBadge, AlertBanner } from "@/components/ui";

const playbooks = [
  {
    name: "Home Services",
    description:
      "Missed-call recovery, after-hours capture, and quote follow-up tuned for plumbers, HVAC, and electricians.",
    sequences: 5,
  },
  {
    name: "Med Spas",
    description:
      "Consultation booking, no-show recovery, and rebooking nudges for aesthetic and wellness clinics.",
    sequences: 4,
  },
  {
    name: "Contractors",
    description:
      "Lead qualification, estimate follow-up, and job-completion review requests for remodel and trade crews.",
    sequences: 6,
  },
];

export default function AdminPlaybooksPage() {
  return (
    <>
      <PageHeader
        eyebrow="Operator Console"
        title="Playbooks"
        description="Curated automation bundles per industry. Deploy a playbook to a workspace to install its full sequence set in one step."
      />

      <AlertBanner className="mb-6">
        Playbook catalog is previewed here. One-click deploy to a workspace
        activates in v0.3.
      </AlertBanner>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {playbooks.map((p) => (
          <Card key={p.name} interactive>
            <div className="flex items-start justify-between gap-3">
              <CardHeading>{p.name}</CardHeading>
              <StatusBadge label="Pending" tone="neutral" />
            </div>
            <p className="mt-2 text-sm text-ink-secondary">{p.description}</p>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-ink-muted">
              {p.sequences} sequences
            </p>
          </Card>
        ))}
      </section>
    </>
  );
}
