import { FollowUpResolveAction } from "../demo-operations/DemoOperationActions";
import { listCallFollowUps } from "@/lib/followUp/service";
import { EmptyState, PageHeader, StatusBadge, Table, TBody, TD, THead, TR } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const result = await listCallFollowUps();
  const followUps = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        eyebrow="Operator Console"
        title="Human follow-up"
        description="Every finalized call that is not qualified or spam, across all accounts, with its accountable operator, backup and due time (ADR-0086)."
      />
      {!result.ok ? <EmptyState title="Follow-ups unavailable" description={result.error.message} /> : followUps.length === 0 ? (
        <EmptyState title="No follow-ups" description="Records appear here when a finalized call needs a human." />
      ) : (
        <Table>
          <THead columns={["Account", "Call", "Reason", "Status", "Owner / backup", "Due", "Action"]} />
          <TBody>{followUps.map((followUp) => (
            <TR key={followUp.id}>
              <TD>{followUp.account_name}</TD>
              <TD mono>{followUp.call_id}</TD>
              <TD>{followUp.reason.replaceAll("_", " ")}</TD>
              <TD><StatusBadge label={followUp.status} tone={followUp.status === "resolved" ? "success" : "warning"} /></TD>
              <TD mono>{followUp.owner_user_id} / {followUp.backup_user_id}</TD>
              <TD mono>{followUp.due_at.slice(0, 16).replace("T", " ")}</TD>
              <TD><FollowUpResolveAction id={followUp.id} open={followUp.status === "open"} /></TD>
            </TR>
          ))}</TBody>
        </Table>
      )}
    </>
  );
}
