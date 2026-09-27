"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Action = "grant" | "refuse" | "withdraw";

export function ConsentControls({ id, callReference }: { id: string; callReference: string }) {
  const [disclosure, setDisclosure] = useState("");
  const [evidence, setEvidence] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  // A decision keeps its key until it completes, so a retry reaches the
  // server's idempotent branch instead of attempting a second event.
  const pending = useRef<{ action: Action; eventKey: string } | null>(null);
  const router = useRouter();
  async function record(action: Action) {
    setBusy(true);
    if (pending.current?.action !== action) pending.current = { action, eventKey: crypto.randomUUID() };
    const { eventKey } = pending.current;
    try {
      const response = await fetch(`/api/admin/call-capture/${id}/consent`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, disclosureRef: disclosure, evidenceRef: evidence, jurisdictionBasis: jurisdiction, eventKey }) });
      const result = await response.json();
      if (result.ok) {
        pending.current = null;
        setStatus(`Recorded ${result.data.action} at ${result.data.occurredAt}.`);
      } else if (result.error === "consent_effect_incomplete") {
        setStatus(`Recorded ${result.data.action} at ${result.data.occurredAt}, but the provider command did not complete. Record ${action} again to retry it.`);
      } else {
        pending.current = null;
        setStatus(result.error === "idempotency_conflict" ? "This decision was already recorded with different references." : "Consent event was not recorded.");
      }
      router.refresh();
    } catch { setStatus(`Result uncertain. Record ${action} again to retry the same decision safely.`); }
    finally { setBusy(false); }
  }
  return <details className="my-3 rounded border p-4">
    <summary>Capture consent · {callReference}</summary>
    <p className="my-2">Record only the DTMF decision you witnessed for this exact active call after the approved disclosure. Grant starts the governed AI command; refusal starts no AI; withdrawal closes content admission before provider stop. Recording remains off.</p>
    <label className="block">Disclosure version/reference<input className="m-2 rounded border p-2" value={disclosure} onChange={(event) => setDisclosure(event.target.value)} /></label>
    <label className="block">Evidence reference<input className="m-2 rounded border p-2" value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label>
    <label className="block">Jurisdiction basis<input className="m-2 rounded border p-2" value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)} /></label>
    <div className="flex gap-3">{(["grant", "refuse", "withdraw"] as const).map((action) => <button key={action} className="rounded border px-3 py-2" disabled={busy || !disclosure.trim() || !evidence.trim() || !jurisdiction.trim()} onClick={() => record(action)}>Record {action}</button>)}</div>
    <p role="status">{status}</p>
  </details>;
}
