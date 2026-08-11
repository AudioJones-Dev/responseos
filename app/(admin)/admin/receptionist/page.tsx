import {
  Card,
  CardHeading,
  EmptyState,
  PageHeader,
  StatusBadge,
  Table,
  TBody,
  TD,
  THead,
  TR,
  type Tone,
} from "@/components/ui";
import { AgentProfiles, ProfessionalOpportunities } from "@/lib/data";
import { parseAgentProfilePolicy } from "@/lib/professional";

const statusTone: Record<string, Tone> = {
  new: "info",
  qualifying: "warning",
  scheduled: "success",
  escalated: "danger",
  closed: "neutral",
};

const titleCase = (s: string): string =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default async function AdminReceptionistPage() {
  const [profileResult, opportunityResult] = await Promise.all([
    AgentProfiles.listAgentProfiles({}),
    ProfessionalOpportunities.listProfessionalOpportunities({}),
  ]);
  const profiles = profileResult.ok ? profileResult.data : [];
  const opportunities = opportunityResult.ok ? opportunityResult.data : [];

  return (
    <>
      <PageHeader
        eyebrow="Operator Console"
        title="Professional Receptionist"
        description="Agent profiles and the professional opportunities their conversations produced. Rows are tenant-scoped like every other console view."
      />

      <Card className="mb-8">
        <CardHeading className="mb-4">Professional opportunities</CardHeading>
        {opportunities.length === 0 ? (
          <EmptyState
            title="No professional opportunities yet"
            description="Recruiter, consulting, and professional inquiries captured by an agent profile appear here."
          />
        ) : (
          <Table>
            <THead
              columns={[
                "Company",
                "Role",
                "Contact",
                "Type",
                "Interest",
                "Status",
                "Next action",
              ]}
            />
            <TBody>
              {opportunities.map((opportunity) => (
                <TR key={opportunity.id}>
                  <TD className="font-medium text-ink">
                    {opportunity.company ?? "—"}
                  </TD>
                  <TD>{opportunity.role_title ?? "—"}</TD>
                  <TD>{opportunity.recruiter_name ?? "—"}</TD>
                  <TD>{titleCase(opportunity.opportunity_type)}</TD>
                  <TD>
                    {opportunity.interest_level
                      ? titleCase(opportunity.interest_level)
                      : "—"}
                  </TD>
                  <TD>
                    <StatusBadge
                      label={titleCase(opportunity.status)}
                      tone={statusTone[opportunity.status] ?? "neutral"}
                    />
                  </TD>
                  <TD>{opportunity.next_action ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeading className="mb-4">Agent profiles</CardHeading>
        {profiles.length === 0 ? (
          <EmptyState
            title="No agent profiles configured"
            description="An account with the professional receptionist enabled carries one profile per audience."
          />
        ) : (
          <Table>
            <THead
              columns={[
                "Profile",
                "Slug",
                "Type",
                "Appointment types",
                "State",
              ]}
            />
            <TBody>
              {profiles.map((profile) => {
                const policy = parseAgentProfilePolicy(
                  profile.system_policy_json,
                );
                return (
                  <TR key={profile.id}>
                    <TD className="font-medium text-ink">
                      {profile.name}
                      {profile.is_default ? " · default" : ""}
                    </TD>
                    <TD mono>{profile.slug}</TD>
                    <TD>{titleCase(profile.type)}</TD>
                    <TD>
                      {policy.allowedAppointmentTypes
                        .map((type) => titleCase(type))
                        .join(", ")}
                    </TD>
                    <TD>
                      <StatusBadge
                        label={profile.enabled ? "Enabled" : "Disabled"}
                        tone={profile.enabled ? "success" : "neutral"}
                      />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
