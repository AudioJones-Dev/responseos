import { notFound } from "next/navigation";
import { Card, CardHeading, EmptyState, PageHeader, StatusBadge, Table, TBody, TD, THead, TR } from "@/components/ui";
import { getProspectBootstrapDetail, listAvailableTelephonyNumbers } from "@/lib/prospectBootstrap/service";
import { verifyProspectProviderAttestation } from "@/lib/prospectBootstrap/attestation";
import { BootstrapLifecycleActions, FactReviewActions } from "../ProspectBootstrapActions";

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
            <TR key={source.id}><TD mono>{source.normalized_url}</TD><TD><StatusBadge label={source.status} tone={source.status === "acquired" ? "success" : "warning"} /></TD><TD mono>{source.fetched_at?.toISOString().slice(0, 16) ?? "—"}</TD><TD>{source.extracted_text ? `${source.extracted_text.length.toLocaleString()} chars` : "purged"}</TD></TR>
          ))}</TBody></Table>
        )}
      </Card>
      <Card className="mb-8">
        <CardHeading className="mb-4">Fact review</CardHeading>
        {facts.length === 0 ? <EmptyState title="No observed facts" description="Acquired sources may require manual fact entry in a later iteration if the deterministic extractor finds no eligible business facts." /> : (
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
      </Card>
      <div className="grid gap-6 md:grid-cols-3">
        <Card><CardHeading>Memory snapshots</CardHeading><p className="mt-2 text-2xl font-semibold">{snapshots.length}</p></Card>
        <Card><CardHeading>Number assignments</CardHeading><p className="mt-2 text-2xl font-semibold">{assignments.length}</p></Card>
        <Card><CardHeading>Promotion packages</CardHeading><p className="mt-2 text-2xl font-semibold">{promotions.length}</p></Card>
      </div>
    </>
  );
}
