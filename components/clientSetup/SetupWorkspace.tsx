import { Card, CardHeading, PageHeader, StatusBadge } from "@/components/ui";
import type { SetupView } from "@/lib/clientSetup/service";

const capabilities = { recording: "Recording", transcription: "Transcription", aiAnswering: "AI answering", forwarding: "Forwarding", outboundCalls: "Outbound calls", automatedFollowUp: "Automated follow-up", memoryIngestion: "Automatic memory ingestion" };

export function SetupWorkspace({ setup, perspective }: { setup: SetupView; perspective: "admin" | "customer" }) {
  const { account, draft } = setup;
  return <>
    <PageHeader eyebrow={perspective === "admin" ? "Operator Console · Account setup" : "Client Portal · Account setup"} title={account.name} description="Review business details and prepare your receptionist. Service has not been activated by this setup." />
    {setup.synthetic && <p className="mb-6 rounded-lg border border-line p-4 text-sm" role="status">Synthetic preview — test business and identities only. Changes are not saved in this preview.</p>}
    <div className="mb-6 flex flex-wrap gap-3"><StatusBadge label="Inactive setup" tone="warning" /><StatusBadge label="Draft · Not published" tone="neutral" /></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><CardHeading>Business overview</CardHeading><dl className="mt-4 space-y-2 text-sm">
        <dt className="text-ink-muted">Founder</dt><dd>{draft.founderName}</dd>
        <dt className="text-ink-muted">Industry</dt><dd>{account.industry}</dd>
        <dt className="text-ink-muted">Timezone</dt><dd>{account.timezone}</dd>
      </dl><p className="mt-4 text-sm text-ink-secondary">Founder details are business information. They do not assign account ownership or grant access.</p></Card>
      <Card><CardHeading>Business contact number</CardHeading><p className="mt-4 font-mono text-lg">{draft.contactNumber}</p><p className="mt-2 text-sm">Ownership unverified · Routing unverified · Unprovisioned</p><p className="mt-4 text-sm text-ink-secondary">Contact information only. No provider number or routing assignment is created.</p></Card>
      <Card><CardHeading>Business facts · Draft</CardHeading>{draft.facts.length ? <dl className="mt-4 space-y-3 text-sm">{draft.facts.map((fact, i) => <div key={i}><dt className="font-medium">{fact.label}</dt><dd className="whitespace-pre-wrap text-ink-secondary">{fact.value}</dd></div>)}</dl> : <p className="mt-4 text-sm text-ink-secondary">No draft facts added.</p>}<p className="mt-4 text-sm text-ink-secondary">These facts are not available to the receptionist.</p></Card>
      <Card><CardHeading>Opening disclosure · Draft</CardHeading><p className="mt-4 whitespace-pre-wrap text-sm">{draft.disclosure.text || "No disclosure drafted."}</p><p className="mt-4 text-sm"><strong>Purpose: </strong>{draft.disclosure.purpose || "Not specified"}</p><p className="mt-3 whitespace-pre-wrap text-sm"><strong>Proposed consent flow: </strong>{draft.disclosure.consentFlow || "Not configured"}</p><p className="mt-3 whitespace-pre-wrap text-sm"><strong>Proposed refusal flow: </strong>{draft.disclosure.refusalFlow || "Not configured"}</p><p className="mt-4 text-sm text-ink-secondary">Not approved or active. Consent and refusal handling need review before any capture begins.</p></Card>
      <Card><CardHeading>Receptionist setup</CardHeading><ul className="mt-4 space-y-2 text-sm">{Object.entries(capabilities).map(([key, label]) => <li key={key} className="flex justify-between gap-3"><span>{label}</span><span className="font-semibold">Off</span></li>)}</ul><p className="mt-4 text-sm text-ink-secondary">Setup cannot enable these capabilities. Existing external services are not inspected or changed here.</p></Card>
      <Card><CardHeading>Remaining setup</CardHeading><ul className="mt-4 list-disc space-y-2 pl-5 text-sm"><li>Verify contact-number ownership and routing.</li><li>Review business facts and disclosure purpose.</li><li>Approve consent and refusal handling.</li><li>Confirm ownership and customer access separately.</li><li>Complete a separate service activation review.</li></ul>{perspective === "admin" ? <p className="mt-4 text-sm text-ink-secondary">Production destination unresolved. Local draft revision {draft.revision}. No production execution is authorized.</p> : <p className="mt-4 text-sm text-ink-secondary">Read-only review. Ask your operator to correct draft details. This page cannot approve or activate service.</p>}</Card>
    </div>
  </>;
}
