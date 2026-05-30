import { PageHeader, Card, CardHeading, StatusBadge } from "@/components/ui";

export default function AdminSettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Operator Console"
        title="Operator Settings"
        description="Provider credentials, team members, and role assignments for the operator console."
      />

      <section className="grid gap-4">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <CardHeading>Provider Credentials</CardHeading>
            <StatusBadge label="Env-managed" tone="neutral" />
          </div>
          <p className="mt-2 text-sm text-ink-secondary">
            Provider keys are read from environment variables and never
            persisted to the database. When a key is absent, the matching
            adapter falls back to mock. Configuration UI is a placeholder until
            v0.3.
          </p>
        </Card>

        <Card>
          <CardHeading>Team Members</CardHeading>
          <p className="mt-2 text-sm text-ink-secondary">
            Invite operators and manage who can access the console. Member
            management is a placeholder.
          </p>
        </Card>

        <Card>
          <CardHeading>Role Assignments</CardHeading>
          <p className="mt-2 text-sm text-ink-secondary">
            Assign roles to scope what each operator can view and act on. Role
            controls are a placeholder.
          </p>
        </Card>
      </section>
    </>
  );
}
