import {
  EmptyState,
  PageHeader,
  StatusBadge,
  Table,
  TBody,
  TD,
  THead,
  TR,
} from "@/components/ui";
import { AgentProfiles } from "@/lib/data";

const titleCase = (value: string): string =>
  value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

export default async function AdminAgentProfilesPage() {
  const result = await AgentProfiles.listAgentProfiles({});
  const profiles = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        eyebrow="Operator Console"
        title="Agent Profiles"
        description="Reusable, tenant-scoped receptionist configurations. Runtime provider and knowledge integrations remain gated."
      />
      {profiles.length === 0 ? (
        <EmptyState
          title="No agent profiles yet"
          description="Tenant-scoped assistant configurations will appear here."
        />
      ) : (
        <Table>
          <THead columns={["Profile", "Type", "Slug", "Default", "Status"]} />
          <TBody>
            {profiles.map((profile) => (
              <TR key={profile.id}>
                <TD className="font-medium text-ink">{profile.name}</TD>
                <TD>{titleCase(profile.profile_type)}</TD>
                <TD mono>{profile.slug}</TD>
                <TD>{profile.is_default ? "Yes" : "No"}</TD>
                <TD>
                  <StatusBadge
                    label={profile.enabled ? "Enabled" : "Disabled"}
                    tone={profile.enabled ? "success" : "neutral"}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
