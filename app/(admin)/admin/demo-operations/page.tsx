import { ConsentControls } from "./ConsentControls";
import { loadCallReviewConsole } from "@/lib/callReview/service";
import type { ReviewPayload } from "@/lib/callReview/contracts";
import { CallReviewCard } from "./CallReviewCard";
import { CrmRetryAction, ProspectActions } from "./DemoOperationActions";
import { listCrmSyncOperations } from "@/lib/crm/syncFinalizedCall";
import { Calls } from "@/lib/data";
import { listProspectIntakes } from "@/lib/data/prospectIntakes";
import { EmptyState, PageHeader, StatusBadge, Table, TBody, TD, THead, TR } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DemoOperationsPage() {
  // Sign-in is enforced upstream but the application role is not, so an
  // authenticated non-operator reaches this page and the console's own
  // operator check throws mid-render. Answer with a denied state instead of an
  // uncaught rendering exception; the check itself stays in the console.
  let console_: Awaited<ReturnType<typeof loadCallReviewConsole>>;
  try {
    console_ = await loadCallReviewConsole();
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "operator_required") throw error;
    return (
      <>
        <PageHeader title="Demo operations" />
        <EmptyState title="Operator access required" description="This console is limited to ResponseOS operators." />
      </>
    );
  }
  const { captures, reviews } = console_;

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

      <h2 className="mb-3 mt-8 font-display text-xl font-semibold text-ink">Capture consent</h2>
      {captures.map((capture) => <div key={capture.id}><ConsentControls id={capture.id} callReference={capture.provider_call_id} /><p>Latest consent: {capture.consentAction ?? "No affirmative consent recorded"}</p></div>)}
      <h2 className="mb-3 mt-8 font-display text-xl font-semibold text-ink">Supervised call review</h2>
      <p>Review each call before approving its CRM record and email. Email acceptance does not confirm inbox delivery.</p>
      {reviews.length === 0 && <EmptyState title="No calls awaiting review" description="A finalized call with consented evidence will appear here." />}
      {reviews.map((row) => <CallReviewCard key={row.id + row.status} id={row.id} callId={row.call_id} revision={row.revision} status={row.status} recipient={row.recipient} payload={row.payload_json as unknown as ReviewPayload} transcript={(row.evidence_json as { transcript?: string }).transcript ?? null} crmStatus={row.crm_status} emailStatus={row.email_status} />)}
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
