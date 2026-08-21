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
  async function run(path: string, body?: unknown) {
    setBusy(true);
    setError(undefined);
    try { await request(path, "POST", body); router.refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The operation failed."); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(props.status === "draft" || props.status === "review_required" || props.status === "failed") ? <Button disabled={busy} onClick={() => run(`/api/admin/prospect-bootstraps/${props.id}/ingest`)}>Acquire website</Button> : null}
      {props.status === "review_required" ? <Button disabled={busy} onClick={() => run(`/api/admin/prospect-bootstraps/${props.id}/approve`)}>Approve snapshot</Button> : null}
      {props.status === "approved" ? props.availableNumbers.map((number) => (
        <Button key={number.id} disabled={busy || !number.preflightReady} onClick={() => run(`/api/admin/prospect-bootstraps/${props.id}/assign-number`, { telephonyNumberId: number.id })}>Assign {number.e164}</Button>
      )) : null}
      {props.status === "ready" ? <Button disabled={busy} onClick={() => run(`/api/admin/prospect-bootstraps/${props.id}/activate`)}>Activate 14-day demo</Button> : null}
      {props.status === "active" ? <Button disabled={busy} onClick={() => run(`/api/admin/prospect-bootstraps/${props.id}/complete`)}>Complete demo</Button> : null}
      {props.status === "completed" ? <Button disabled={busy} onClick={() => run(`/api/admin/prospect-bootstraps/${props.id}/promotion`)}>Export promotion package</Button> : null}
      {props.quarantinedAssignments.map((assignment) => (
        <Button key={assignment.id} disabled={busy || !assignment.eligible} onClick={() => run(`/api/admin/telephony-number-assignments/${assignment.id}/approve-reuse`)}>
          Approve reuse {assignment.e164} {assignment.quarantineUntil ? `(after ${assignment.quarantineUntil.slice(0, 10)})` : ""}
        </Button>
      ))}
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </div>
  );
}
