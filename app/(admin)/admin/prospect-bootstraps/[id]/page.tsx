import { notFound } from "next/navigation";
import { Card, CardHeading, EmptyState, PageHeader, StatusBadge, Table, TBody, TD, THead, TR } from "@/components/ui";
import { getProspectBootstrapDetail, listAvailableTelephonyNumbers } from "@/lib/prospectBootstrap/service";
import { verifyProspectProviderAttestation } from "@/lib/prospectBootstrap/attestation";
import { PROSPECT_MEMORY_UNKNOWNS } from "@/lib/prospectBootstrap/contracts";
import { PROSPECT_DEMO_ALLOWED_ACTIONS, PROSPECT_DEMO_PROHIBITED_ACTIONS, PROSPECT_DEMO_POLICY } from "@/lib/prospectBootstrap/policy";
import { PROSPECT_RECEPTIONIST_TEMPLATE, PROSPECT_RECEPTIONIST_TEMPLATE_CHECKSUM } from "@/lib/prospectBootstrap/template";
import { BootstrapLifecycleActions, FactReviewActions, ManualFactForm, PromotionAcknowledgmentForm } from "../ProspectBootstrapActions";

export const dynamic = "force-dynamic";

export default async function ProspectBootstrapDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detailResult, numbersResult] = await Promise.all([getProspectBootstrapDetail(id), listAvailableTelephonyNumbers()]);
  if (!detailResult.ok || !detailResult.data.account) notFound();
  const { bootstrap, account, sources, facts, snapshots, assignments, promotions, numbers } = detailResult.data;
  const availableNumbers = numbersResult.ok ? numbersResult.data.map((number) => ({
    id: number.id,
    e164: number.e164,
    preflightReady: (() => {
      try {
        const capabilities = number.capabilities_json as Record<string, unknown> | null;
        verifyProspectProviderAttestation({
          value: capabilities?.providerAttestation,
          providerNumberId: number.provider_number_id,
          e164: number.e164,
          publicKey: process.env.RESPONSEOS_PROVIDER_ATTESTATION_PUBLIC_KEY,
        });
        return true;
      }
      catch { return false; }
    })(),
  })) : [];
  const quarantinedAssignments = assignments
    .filter((assignment) => assignment.status === "quarantined")
    .map((assignment) => ({
      id: assignment.id,
      e164: numbers.find((number) => number.id === assignment.telephony_number_id)?.e164 ?? "Unknown number",
      quarantineUntil: assignment.quarantine_until?.toISOString(),
      eligible: Boolean(assignment.quarantine_until && assignment.quarantine_until <= new Date()),
    }));
  const conflicts = facts.filter((fact) => fact.status === "conflicted");
  const currentSnapshot = snapshots.find((snapshot) => snapshot.id === bootstrap.current_memory_snapshot_id);
  const activeAssignment = assignments.find((assignment) => assignment.id === bootstrap.active_assignment_id);
  const activeNumber = activeAssignment
    ? numbers.find((number) => number.id === activeAssignment.telephony_number_id)
    : undefined;
  let activeNumberAttested = false;
  if (activeNumber) {
    try {
      const capabilities = activeNumber.capabilities_json as Record<string, unknown> | null;
      verifyProspectProviderAttestation({
        value: capabilities?.providerAttestation,
        providerNumberId: activeNumber.provider_number_id,
        e164: activeNumber.e164,
        publicKey: process.env.RESPONSEOS_PROVIDER_ATTESTATION_PUBLIC_KEY,
      });
      activeNumberAttested = true;
    } catch { activeNumberAttested = false; }
  }
  return (
    <>
      <PageHeader eyebrow="Prospect Demo · Operator Only" title={account.name} description={`${bootstrap.canonical_website} · ${bootstrap.status.replaceAll("_", " ")}`} />
      <Card className="mb-8">
        <CardHeading className="mb-4">Lifecycle gate</CardHeading>
        <BootstrapLifecycleActions id={bootstrap.id} status={bootstrap.status} availableNumbers={availableNumbers} quarantinedAssignments={quarantinedAssignments} />
        <p className="mt-3 text-sm text-muted">Inbound-only · recording off · CRM off · scheduling off · provider memory off</p>
      </Card>
      <Card className="mb-8">
        <CardHeading className="mb-4">Collected sources</CardHeading>
        {sources.length === 0 ? <EmptyState title="No sources acquired" description="Acquire the canonical page and any manually approved same-site URLs." /> : (
          <Table><THead columns={["URL", "Status", "Fetched", "Content"]} /><TBody>{sources.map((source) => (
            <TR key={source.id}><TD mono>{source.normalized_url}</TD><TD><StatusBadge label={source.status} tone={source.status === "acquired" ? "success" : "warning"} /></TD><TD mono>{source.fetched_at?.toISOString().slice(0, 16) ?? "—"}</TD><TD>{source.extracted_text ? `${source.extracted_text.length.toLocaleString()} chars · ${source.content_hash?.slice(0, 12) ?? "no hash"}` : "purged"}</TD></TR>
          ))}</TBody></Table>
        )}
      </Card>
      <Card className="mb-8">
        <CardHeading className="mb-4">Fact review</CardHeading>
        {facts.length === 0 ? <EmptyState title="No observed facts" description="Use the source-backed correction form below when the deterministic extractor finds no eligible business facts." /> : (
          <Table><THead columns={["Fact", "Observed value", "Evidence", "State", "Decision"]} /><TBody>{facts.map((fact) => (
            <TR key={fact.id}>
              <TD mono>{fact.fact_key}</TD>
              <TD>{typeof fact.value_json === "string" ? fact.value_json : JSON.stringify(fact.value_json)}</TD>
              <TD>{fact.evidence_excerpt.slice(0, 220)}</TD>
              <TD><StatusBadge label={fact.status.replaceAll("_", " ")} tone={fact.status === "operator_approved_for_demo" || fact.status === "owner_confirmed" ? "success" : fact.status === "conflicted" ? "danger" : "warning"} /></TD>
              <TD><FactReviewActions id={fact.id} reviewed={["operator_approved_for_demo", "owner_confirmed", "rejected"].includes(fact.status)} /></TD>
            </TR>
          ))}</TBody></Table>
        )}
        <ManualFactForm
          bootstrapId={bootstrap.id}
          enabled={bootstrap.status === "review_required"}
          sources={sources.filter((source) => source.status === "acquired" && source.extracted_text).map((source) => ({ id: source.id, url: source.normalized_url }))}
        />
      </Card>
      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeading>Unknowns and conflicts</CardHeading>
          <p className="mt-3 text-sm font-medium">Required unknown responses</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{PROSPECT_MEMORY_UNKNOWNS.map((unknown) => <li key={unknown}>{unknown}</li>)}</ul>
          <p className="mt-4 text-sm font-medium">Conflicting observed facts</p>
          {conflicts.length === 0 ? <p className="mt-2 text-sm text-muted">None detected.</p> : (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-danger">{conflicts.map((fact) => <li key={fact.id}>{fact.fact_key}: {typeof fact.value_json === "string" ? fact.value_json : JSON.stringify(fact.value_json)}</li>)}</ul>
          )}
        </Card>
        <Card>
          <CardHeading>Agent instructions and boundaries</CardHeading>
          <p className="mt-3 text-sm"><span className="font-medium">Template:</span> {PROSPECT_RECEPTIONIST_TEMPLATE.version}</p>
          <p className="mt-1 break-all font-mono text-xs text-muted">Checksum: {PROSPECT_RECEPTIONIST_TEMPLATE_CHECKSUM}</p>
          <p className="mt-3 text-sm text-muted">{PROSPECT_DEMO_POLICY.requiredDisclosure}</p>
          <p className="mt-4 text-sm font-medium">Allowed</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{PROSPECT_DEMO_ALLOWED_ACTIONS.map((action) => <li key={action}>{action}</li>)}</ul>
          <p className="mt-4 text-sm font-medium">Prohibited</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{PROSPECT_DEMO_PROHIBITED_ACTIONS.map((action) => <li key={action}>{action}</li>)}</ul>
        </Card>
        <Card>
          <CardHeading>Memory snapshot review</CardHeading>
          <p className="mt-3 text-sm">Snapshots: {snapshots.length}</p>
          {currentSnapshot ? (
            <div className="mt-2 space-y-1 text-sm text-muted">
              <p>Current version: {currentSnapshot.version} · {currentSnapshot.status}</p>
              <p className="break-all font-mono text-xs">Hash: {currentSnapshot.content_hash}</p>
              <p>Approved: {currentSnapshot.approved_at?.toISOString() ?? "not approved"}</p>
            </div>
          ) : <p className="mt-2 text-sm text-muted">No approved immutable snapshot.</p>}
        </Card>
        <Card>
          <CardHeading>Phone-number and attestation state</CardHeading>
          {activeAssignment && activeNumber ? (
            <div className="mt-3 space-y-1 text-sm text-muted">
              <p>{activeNumber.e164} · {activeAssignment.status}</p>
              <p>Provider: {activeNumber.provider}</p>
              <p>Attestation: {activeNumberAttested ? "valid and current" : "missing, invalid, or expired"}</p>
            </div>
          ) : <p className="mt-3 text-sm text-muted">No number assigned. Activation is unavailable.</p>}
        </Card>
      </div>
      <Card className="mb-8">
        <CardHeading>Promotion handshake</CardHeading>
        {promotions.length === 0 ? <p className="mt-3 text-sm text-muted">No promotion package exported.</p> : (
          <div className="mt-3 grid gap-4">{promotions.map((promotion) => (
            <div className="grid gap-2 rounded-md border border-line p-4" key={promotion.id}>
              <p className="text-sm">{promotion.status} · <span className="font-mono">{promotion.correlation_id}</span></p>
              <p className="break-all font-mono text-xs text-muted">Manifest: {promotion.manifest_hash}</p>
              {promotion.status === "exported" ? <PromotionAcknowledgmentForm correlationId={promotion.correlation_id} manifestHash={promotion.manifest_hash} /> : null}
              {promotion.imported_account_ref ? <p className="text-sm text-muted">Imported account: {promotion.imported_account_ref}</p> : null}
            </div>
          ))}</div>
        )}
      </Card>
      <div className="grid gap-6 md:grid-cols-3">
        <Card><CardHeading>Memory snapshots</CardHeading><p className="mt-2 text-2xl font-semibold">{snapshots.length}</p></Card>
        <Card><CardHeading>Number assignments</CardHeading><p className="mt-2 text-2xl font-semibold">{assignments.length}</p></Card>
        <Card><CardHeading>Promotion packages</CardHeading><p className="mt-2 text-2xl font-semibold">{promotions.length}</p></Card>
      </div>
    </>
  );
}
