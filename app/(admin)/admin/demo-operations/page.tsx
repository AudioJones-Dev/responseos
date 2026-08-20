import { CrmRetryAction, ProspectActions } from "./DemoOperationActions";
import { listCrmSyncOperations } from "@/lib/crm/syncFinalizedCall";
import { Calls } from "@/lib/data";
import { listProspectIntakes } from "@/lib/data/prospectIntakes";
import { EmptyState, PageHeader, StatusBadge, Table, TBody, TD, THead, TR } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DemoOperationsPage() {
  const demoAccountId = process.env.RESPONSEOS_DEMO_ACCOUNT_ID;
  const inboundAccountId = process.env.RESPONSEOS_INBOUND_ACCOUNT_ID;
  const [callResult, crmResult, intakeResult] = await Promise.all([
    Calls.listCalls({ accountId: demoAccountId }),
    demoAccountId
      ? listCrmSyncOperations({ accountId: demoAccountId })
      : Promise.resolve({ ok: true as const, data: [] }),
    inboundAccountId
      ? listProspectIntakes({ accountId: inboundAccountId })
      : Promise.resolve({ ok: true as const, data: [] }),
  ]);
  const calls = callResult.ok ? callResult.data.filter((call) => call.provider === "telnyx") : [];
  const operations = crmResult.ok ? crmResult.data : [];
  const intakes = intakeResult.ok ? intakeResult.data : [];

  return (
    <>
      <PageHeader
        eyebrow="Operator Console"
        title="Demo operations"
        description="Canonical Telnyx evidence, durable CRM sync state, and the prospect-intake review queue. Full transcripts remain inside authenticated ResponseOS call views."
      />

      <h2 className="mb-3 mt-8 font-display text-xl font-semibold text-ink">Telnyx call evidence</h2>
      {calls.length === 0 ? <EmptyState title="No Telnyx calls captured" description="Signed demo call events will appear here after normalization." /> : (
        <Table>
          <THead columns={["Started", "Caller", "Status", "Summary"]} />
          <TBody>{calls.map((call) => (
            <TR key={call.id}>
              <TD mono>{call.started_at.slice(0, 16).replace("T", " ")}</TD>
              <TD mono>{call.from_number}</TD>
              <TD><StatusBadge label={call.status} tone={call.status === "completed" ? "success" : "neutral"} /></TD>
              <TD>{call.summary ?? "Awaiting summary"}</TD>
            </TR>
          ))}</TBody>
        </Table>
      )}

      <h2 className="mb-3 mt-8 font-display text-xl font-semibold text-ink">CRM synchronization</h2>
      {operations.length === 0 ? <EmptyState title="No CRM operations" description="A finalized canonical call creates a durable synchronization operation." /> : (
        <Table>
          <THead columns={["Call", "Provider", "Status", "Attempts", "Action"]} />
          <TBody>{operations.map((operation) => (
            <TR key={operation.id}>
              <TD mono>{operation.call_id}</TD>
              <TD>{operation.provider}</TD>
              <TD><StatusBadge label={operation.status.replaceAll("_", " ")} tone={operation.status === "succeeded" ? "success" : operation.status === "retryable_failed" ? "danger" : "warning"} /></TD>
              <TD>{operation.attempt_count}</TD>
              <TD><CrmRetryAction id={operation.id} retryable={operation.status === "retryable_failed"} /></TD>
            </TR>
          ))}</TBody>
        </Table>
      )}

      <h2 className="mb-3 mt-8 font-display text-xl font-semibold text-ink">Prospect intake</h2>
      {intakes.length === 0 ? <EmptyState title="No prospect requests" description="Persisted intake records will appear after the public gate is enabled." /> : (
        <Table>
          <THead columns={["Reference", "Business", "Status", "Received", "Action"]} />
          <TBody>{intakes.map((intake) => (
            <TR key={intake.id}>
              <TD mono>{intake.reference}</TD>
              <TD>{intake.request?.business_name ?? "PII purged"}</TD>
              <TD><StatusBadge label={intake.status} tone={intake.status === "qualified" ? "success" : intake.status === "rejected" ? "neutral" : "warning"} /></TD>
              <TD mono>{intake.created_at.slice(0, 10)}</TD>
              <TD><ProspectActions id={intake.id} status={intake.status} /></TD>
            </TR>
          ))}</TBody>
        </Table>
      )}
    </>
  );
}
