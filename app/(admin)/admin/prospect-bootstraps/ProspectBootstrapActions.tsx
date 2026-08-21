"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

async function request(path: string, method = "POST", body?: unknown) {
  const response = await fetch(path, {
    method,
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? "The operation failed.");
  }
}

export function CreateProspectBootstrapForm() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [canonicalWebsite, setCanonicalWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto]"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(undefined);
        try {
          await request("/api/admin/prospect-bootstraps", "POST", { businessName, canonicalWebsite });
          setBusinessName("");
          setCanonicalWebsite("");
          router.refresh();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "The operation failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <input className="rounded-md border border-line bg-white px-3 py-2 text-sm" aria-label="Business name" placeholder="Business name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} required />
      <input className="rounded-md border border-line bg-white px-3 py-2 text-sm" aria-label="Public HTTPS website" placeholder="https://business.example" type="url" value={canonicalWebsite} onChange={(event) => setCanonicalWebsite(event.target.value)} required />
      <Button disabled={busy} type="submit">{busy ? "Creating…" : "Create prospect"}</Button>
      {error ? <p className="text-sm text-danger md:col-span-3">{error}</p> : null}
    </form>
  );
}

export function FactReviewActions(props: { id: string; reviewed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (props.reviewed) return null;
  async function review(status: "operator_approved_for_demo" | "rejected") {
    setBusy(true);
    setError(undefined);
    try {
      await request(`/api/admin/prospect-bootstrap-facts/${props.id}`, "PATCH", { status });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The review failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy} onClick={() => review("operator_approved_for_demo")}>Approve</Button>
      <Button disabled={busy} onClick={() => review("rejected")}>Reject</Button>
      {error ? <span className="w-full text-sm text-danger">{error}</span> : null}
    </div>
  );
}

export function BootstrapLifecycleActions(props: {
  id: string;
  status: string;
  availableNumbers: Array<{ id: string; e164: string; preflightReady: boolean }>;
  quarantinedAssignments: Array<{ id: string; e164: string; quarantineUntil?: string; eligible: boolean }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [approvedUrls, setApprovedUrls] = useState("");
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [activationAcknowledged, setActivationAcknowledged] = useState(false);
  async function run(path: string, body?: unknown) {
    setBusy(true);
    setError(undefined);
    try { await request(path, "POST", body); router.refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The operation failed."); }
    finally { setBusy(false); }
  }
  return (
    <div className="grid gap-3">
      {(props.status === "draft" || props.status === "review_required" || props.status === "failed") ? (
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="approved-same-site-urls">Approved same-site URLs (one per line, optional)</label>
          <textarea
            id="approved-same-site-urls"
            className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm"
            placeholder="https://business.example/services"
            value={approvedUrls}
            onChange={(event) => setApprovedUrls(event.target.value)}
          />
          <div><Button disabled={busy} onClick={() => run(`/api/admin/prospect-bootstraps/${props.id}/ingest`, {
            approvedSameSiteUrls: approvedUrls.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
          })}>Acquire approved website pages</Button></div>
        </div>
      ) : null}
      {props.status === "review_required" ? (
        <label className="flex items-start gap-2 rounded-md border border-line p-3 text-sm">
          <input
            className="mt-1"
            type="checkbox"
            checked={reviewAcknowledged}
            onChange={(event) => setReviewAcknowledged(event.target.checked)}
          />
          <span>I reviewed the sources, facts, unknowns, conflicts, agent instructions, number state, and allowed/prohibited actions shown on this page.</span>
        </label>
      ) : null}
      {props.status === "ready" ? (
        <label className="flex items-start gap-2 rounded-md border border-line p-3 text-sm">
          <input
            className="mt-1"
            type="checkbox"
            checked={activationAcknowledged}
            onChange={(event) => setActivationAcknowledged(event.target.checked)}
          />
          <span>I reviewed the final assigned number, current provider attestation, approved snapshot, agent instructions, and allowed/prohibited actions shown on this page.</span>
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
      {props.status === "review_required" ? <Button disabled={busy || !reviewAcknowledged} onClick={() => run(`/api/admin/prospect-bootstraps/${props.id}/approve`, { reviewAcknowledged: true })}>Approve immutable snapshot</Button> : null}
      {props.status === "approved" ? props.availableNumbers.map((number) => (
        <Button key={number.id} disabled={busy || !number.preflightReady} onClick={() => run(`/api/admin/prospect-bootstraps/${props.id}/assign-number`, { telephonyNumberId: number.id })}>Assign {number.e164}</Button>
      )) : null}
      {props.status === "ready" ? <Button disabled={busy || !activationAcknowledged} onClick={() => run(`/api/admin/prospect-bootstraps/${props.id}/activate`, { activationAcknowledged: true })}>Activate 14-day demo</Button> : null}
      {props.status === "active" ? <Button disabled={busy} onClick={() => run(`/api/admin/prospect-bootstraps/${props.id}/complete`)}>Complete demo</Button> : null}
      {props.status === "completed" ? <Button disabled={busy} onClick={() => run(`/api/admin/prospect-bootstraps/${props.id}/promotion`)}>Export promotion package</Button> : null}
      {props.quarantinedAssignments.map((assignment) => (
        <Button key={assignment.id} disabled={busy || !assignment.eligible} onClick={() => run(`/api/admin/telephony-number-assignments/${assignment.id}/approve-reuse`)}>
          Approve reuse {assignment.e164} {assignment.quarantineUntil ? `(after ${assignment.quarantineUntil.slice(0, 10)})` : ""}
        </Button>
      ))}
      {error ? <span className="text-sm text-danger">{error}</span> : null}
      </div>
    </div>
  );
}

export function ManualFactForm(props: {
  bootstrapId: string;
  sources: Array<{ id: string; url: string }>;
  enabled: boolean;
}) {
  const router = useRouter();
  const [sourceId, setSourceId] = useState(props.sources[0]?.id ?? "");
  const [factKey, setFactKey] = useState("");
  const [value, setValue] = useState("");
  const [evidenceExcerpt, setEvidenceExcerpt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!props.enabled || props.sources.length === 0) return null;
  return (
    <form
      className="mt-4 grid gap-3 rounded-md border border-line p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(undefined);
        try {
          await request(`/api/admin/prospect-bootstraps/${props.bootstrapId}/facts`, "POST", {
            sourceId,
            factKey,
            value,
            evidenceExcerpt,
          });
          setFactKey("");
          setValue("");
          setEvidenceExcerpt("");
          router.refresh();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "The fact could not be created.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-sm font-medium">Add a source-backed correction</p>
      <select className="rounded-md border border-line bg-white px-3 py-2 text-sm" aria-label="Evidence source" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
        {props.sources.map((source) => <option key={source.id} value={source.id}>{source.url}</option>)}
      </select>
      <input className="rounded-md border border-line bg-white px-3 py-2 text-sm" aria-label="Fact key" placeholder="service.statement" value={factKey} onChange={(event) => setFactKey(event.target.value)} required />
      <input className="rounded-md border border-line bg-white px-3 py-2 text-sm" aria-label="Fact value" placeholder="Exact reviewed value" value={value} onChange={(event) => setValue(event.target.value)} maxLength={2000} required />
      <textarea className="min-h-20 rounded-md border border-line bg-white px-3 py-2 text-sm" aria-label="Exact evidence excerpt" placeholder="Paste an exact excerpt from the selected acquired source" value={evidenceExcerpt} onChange={(event) => setEvidenceExcerpt(event.target.value)} maxLength={500} required />
      <p className="text-xs text-muted">The excerpt must exactly match acquired source text. The new fact remains unapproved until separately reviewed.</p>
      <div><Button disabled={busy} type="submit">{busy ? "Adding…" : "Add reviewable fact"}</Button></div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}

export function PromotionAcknowledgmentForm(props: {
  correlationId: string;
  manifestHash: string;
}) {
  const router = useRouter();
  const [importedAccountRef, setImportedAccountRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <form className="grid gap-2" onSubmit={async (event) => {
      event.preventDefault();
      setBusy(true);
      setError(undefined);
      try {
        await request(`/api/admin/bootstrap-promotions/${props.correlationId}/acknowledge`, "POST", {
          manifestHash: props.manifestHash,
          importedAccountRef,
        });
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The import could not be acknowledged.");
      } finally {
        setBusy(false);
      }
    }}>
      <input className="rounded-md border border-line bg-white px-3 py-2 text-sm" aria-label="Imported customer account reference" placeholder="Imported disabled customer account ID" value={importedAccountRef} onChange={(event) => setImportedAccountRef(event.target.value)} maxLength={200} required />
      <div><Button disabled={busy} type="submit">{busy ? "Acknowledging…" : "Acknowledge exact import"}</Button></div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}
