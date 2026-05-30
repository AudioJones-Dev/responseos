import { PageHeader, Card, CardHeading } from "@/components/ui";

const sections = [
  {
    title: "Business Hours",
    description:
      "When your business is open to take jobs, so follow-up happens at the right time.",
  },
  {
    title: "Service Area",
    description: "The areas you cover, used to prioritise nearby customers.",
  },
  {
    title: "Urgency Rules",
    description:
      "How quickly different kinds of requests should be followed up.",
  },
  {
    title: "Team Members",
    description: "The people in your business who can see these results.",
  },
];

export default function ClientSettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Client Portal"
        title="Workspace Settings"
        description="Tune how your business is set up. These controls arrive in a later release."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Card key={s.title}>
            <CardHeading>{s.title}</CardHeading>
            <p className="mt-2 text-sm text-ink-secondary">{s.description}</p>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-ink-muted">
              Coming soon
            </p>
          </Card>
        ))}
      </div>
    </>
  );
}
