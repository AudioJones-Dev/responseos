"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Action = "grant" | "refuse" | "withdraw";

export function ConsentControls({ id, callReference }: { id: string; callReference: string }) {
  const [disclosure, setDisclosure] = useState("");
  const [evidence, setEvidence] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [sourceTime, setSourceTime] = useState("");
  const [witnessed, setWitnessed] = useState(false);
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
      const response = await fetch(`/api/admin/call-capture/${id}/consent`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, disclosureRef: disclosure, evidenceRef: evidence, jurisdictionBasis: jurisdiction, eventKey, ...(action === "withdraw" ? { withdrawalSourceTime: { occurredAt: sourceTime, attestation: witnessed ? "operator_witness" : "unverified" } } : {}) }) });
      const result = await response.json();
      if (result.ok) {
        pending.current = null;
        setStatus(action === "withdraw" ? `Withdrawal received at ${result.data.recordedAt}. Source time: ${result.data.sourceTimeStatus}. Activity requires review.` : `Recorded ${result.data.action} at ${result.data.occurredAt}.`);
      } else if (result.error === "consent_effect_incomplete") {
        setStatus(`Withdrawal/consent recorded; source status ${result.data.sourceTimeStatus ?? "recorded"}. Provider command incomplete. Processing is fenced for withdrawal; retry the same decision.`);
      } else if (result.error === "withdrawal_recording_incomplete") {
        setStatus("Withdrawal result uncertain. A processing fence may already be recorded. Retry the same decision and review the activity evidence.");
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
    <label className="block">Withdrawal source time (UTC, YYYY-MM-DDTHH:mm:ss.sssZ)<input className="m-2 rounded border p-2" value={sourceTime} onChange={event => setSourceTime(event.target.value)} /></label><label className="block"><input type="checkbox" checked={witnessed} onChange={event => setWitnessed(event.target.checked)} /> I personally witnessed this withdrawal at the stated time; the evidence reference supports it.</label><p>Unknown or disputed time still stops processing and requires review. Activity before receipt may already have occurred.</p><div className="flex gap-3">{(["grant", "refuse", "withdraw"] as const).map((action) => <button key={action} className="rounded border px-3 py-2" disabled={busy || (action !== "withdraw" && (!disclosure.trim() || !evidence.trim() || !jurisdiction.trim()))} onClick={() => record(action)}>Record {action}</button>)}</div>
    <p role="status">{status}</p>
  </details>;
}
