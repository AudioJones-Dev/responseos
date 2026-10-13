import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { withTenantScope } from "@/lib/data/session-helpers";
import { EmptyState, PageHeader, StatusBadge, Table, TBody, TD, THead, TR } from "@/components/ui";
export const dynamic = "force-dynamic";
type Row = {reference: string; environment: string; status: string; mode: string; attempt_count: number; last_error_code: string | null};
export default async function RoutingDeliveriesPage({searchParams}: {searchParams: Promise<{accountId?: string}>}) {
  await requireRole(["aj_admin", "operator", "client_admin", "client_viewer"]);
  const supplied = (await searchParams).accountId;
  const scope = await withTenantScope(supplied && /^[a-zA-Z0-9_-]{1,100}$/.test(supplied) ? supplied : undefined);
  const accountId = scope.ok ? scope.effectiveAccountId : undefined;
  let rows: Row[] = [];
  if (accountId && db) rows = await db.$queryRaw<Row[]>`SELECT i.reference, i.environment, d.status, d.mode, d.attempt_count, d.last_error_code FROM "HostedRoutingDelivery" d JOIN "FrlWebIntake" i ON i.id = d.intake_id AND i.account_id = d.account_id WHERE d.account_id = ${accountId} ORDER BY d.created_at DESC LIMIT 100`;
  return <>
    <PageHeader eyebrow="Operator Console" title="Routing deliveries" description="Durable intake receipts and delivery status for the selected workspace. Simulated confirmation does not establish CRM delivery." />
    {!accountId ? <EmptyState title="Select a workspace" description="Routing evidence requires a workspace. Operators open this page with ?accountId=." /> : rows.length === 0 ? <EmptyState title="No routing deliveries" description="Receipts appear after approved intake persistence." /> : <Table>
      <THead columns={["Receipt", "Environment", "Mode", "Status", "Attempts", "Attention"]} />
      <TBody>{rows.map(row => <TR key={row.reference}>
        <TD mono>{row.reference}</TD><TD>{row.environment}</TD><TD>{row.mode}</TD>
        <TD><StatusBadge label={row.status} tone={row.status === "confirmed" ? "success" : row.status === "rejected" || row.status === "uncertain" ? "danger" : "warning"} /></TD>
        <TD>{row.attempt_count}</TD><TD>{row.last_error_code ?? "—"}</TD>
      </TR>)}</TBody>
    </Table>}
  </>;
}
