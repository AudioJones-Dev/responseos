import Link from "next/link";
import { Card, CardHeading, EmptyState, PageHeader, StatusBadge, Table, TBody, TD, THead, TR } from "@/components/ui";
import { listProspectBootstraps } from "@/lib/prospectBootstrap/service";
import { CreateProspectBootstrapForm } from "./ProspectBootstrapActions";

export const dynamic = "force-dynamic";

export default async function ProspectBootstrapsPage() {
  const result = await listProspectBootstraps();
  const bootstraps = result.ok ? result.data : [];
  return (
    <>
      <PageHeader eyebrow="Operator Console" title="Personalized prospect demos" description="Operator-reviewed public context, isolated sandbox tenants, and time-bounded demo activation. This surface never provisions provider resources or production credentials." />
      <Card className="mb-8">
        <CardHeading className="mb-4">Create isolated workspace</CardHeading>
        <CreateProspectBootstrapForm />
      </Card>
      {bootstraps.length === 0 ? <EmptyState title="No prospect bootstraps" description="Create an operator-only sandbox workspace from a public HTTPS website." /> : (
        <Table>
          <THead columns={["Business", "Website", "Status", "Expires", "Review"]} />
          <TBody>{bootstraps.map((bootstrap) => (
            <TR key={bootstrap.id}>
              <TD className="font-medium text-ink">{bootstrap.account_name}</TD>
              <TD mono>{new URL(bootstrap.canonical_website).hostname}</TD>
              <TD><StatusBadge label={bootstrap.status.replaceAll("_", " ")} tone={bootstrap.status === "active" ? "success" : bootstrap.status === "failed" ? "danger" : "warning"} /></TD>
              <TD mono>{bootstrap.expires_at?.slice(0, 10) ?? "—"}</TD>
              <TD><Link className="text-sm font-semibold text-brand-blue hover:underline" href={`/admin/prospect-bootstraps/${bootstrap.id}`}>Open review</Link></TD>
            </TR>
          ))}</TBody>
        </Table>
      )}
    </>
  );
}
