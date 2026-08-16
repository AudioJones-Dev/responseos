import {
  PageHeader,
  EmptyState,
  StatusBadge,
  Table,
  THead,
  TBody,
  TR,
  TD,
  type Tone,
} from "@/components/ui";
import { Accounts } from "@/lib/data";

const statusTone: Record<string, Tone> = {
  active: "success",
  pending: "warning",
  inactive: "neutral",
  churned: "danger",
};

/**
 * Classification badge (ADR-0046). Non-customer tenants are labelled so
 * an operator never mistakes dogfooding activity for customer activity.
 */
const accountTypeTone: Record<string, Tone> = {
  customer: "neutral",
  internal: "info",
  internal_demo: "accent",
  sandbox: "warning",
};

const titleCase = (s: string): string =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default async function AdminClientsPage() {
  const result = await Accounts.listAccounts();
  const orgs = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        eyebrow="Operator Console"
        title="Clients"
        description="Workspaces ResponseOS is operating for. Tenant isolation is enforced per organization on every read and write."
      />

      {orgs.length === 0 ? (
        <EmptyState
          title="No client workspaces yet"
          description="Onboard a client to provision their isolated workspace. Active clients and their health will surface here."
        />
      ) : (
        <Table>
          <THead columns={["Client", "Slug", "Industry", "Type", "Status"]} />
          <TBody>
            {orgs.map((o) => (
              <TR key={o.id}>
                <TD className="font-medium text-ink">{o.name}</TD>
                <TD mono>{o.slug}</TD>
                <TD>{titleCase(o.industry)}</TD>
                <TD>
                  <StatusBadge
                    label={titleCase(o.account_type)}
                    tone={accountTypeTone[o.account_type] ?? "neutral"}
                  />
                </TD>
                <TD>
                  <StatusBadge
                    label={titleCase(o.status)}
                    tone={statusTone[o.status] ?? "neutral"}
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
