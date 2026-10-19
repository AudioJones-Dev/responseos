"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Action = "grant" | "refuse" | "withdraw";

export function ConsentControls({ id, callReference, terminal = false }: { id: string; callReference: string; terminal?: boolean }) {
  const [disclosure, setDisclosure] = useState("");
  const [evidence, setEvidence] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [sourceTime, setSourceTime] = useState("");
  const [witnessed, setWitnessed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [withdrawalAttempted, setWithdrawalAttempted] = useState(false);
  // A decision keeps its key until it completes, so a retry reaches the
  // server's idempotent branch instead of attempting a second event.
  const pending = useRef<{ action: Action; eventKey: string } | null>(null);
  const router = useRouter();
  async function record(action: Action) {
    setBusy(true);
    if (action === "withdraw") setWithdrawalAttempted(true);
    if (pending.current?.action !== action) pending.current = { action, eventKey: crypto.randomUUID() };
    const { eventKey } = pending.current;
    try {
      const response = await fetch(`/api/admin/call-capture/${id}/consent`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, disclosureRef: disclosure, evidenceRef: evidence, jurisdictionBasis: jurisdiction, eventKey, ...(action === "withdraw" ? { withdrawalSourceTime: { occurredAt: sourceTime, attestation: witnessed ? "operator_witness" : "unverified" } } : {}) }) });
      const result = await response.json();
      if (action === "withdraw" && result.withdrawal) {
        const progress = result.withdrawal;
        setStatus(`Withdrawal receipt: ${progress.receipt.replaceAll("_", " ")}${progress.receivedAt ? ` at ${progress.receivedAt}` : ""}. Content drain: ${progress.drain}. AI stop command: ${progress.aiStop.replaceAll("_", " ")}; provider cessation unconfirmed. Already-authorized content may finish before drain confirms; retained content remains stored. ${result.ok ? "Evidence recorded; review actual activity." : "Retry this same withdrawal to continue or resolve uncertainty."}`);
        if (result.ok) pending.current = null;
      } else if (result.ok) {
        pending.current = null;
        setStatus(action === "withdraw" ? `Withdrawal received at ${result.data.recordedAt}. Source time: ${result.data.sourceTimeStatus}. Activity requires review.` : `Recorded ${result.data.action} at ${result.data.occurredAt}.`);
      } else if (result.error === "consent_effect_incomplete") {
        setStatus(`Consent recorded. Provider command incomplete; retry the same decision. This is not provider cessation proof.`);
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
    <p className="my-2">Record only the DTMF decision you witnessed for this exact active call after the approved disclosure. A saved withdrawal receipt blocks new authorizations; already-authorized raw history, caller data and transcripts may finish before drain confirms and remain stored afterward. AI stop follows drain and is reported separately. Recording remains off.</p>
    <label className="block">Disclosure version/reference<input className="m-2 rounded border p-2" value={disclosure} onChange={(event) => setDisclosure(event.target.value)} /></label>
    <label className="block">Evidence reference<input className="m-2 rounded border p-2" value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label>
    <label className="block">Jurisdiction basis<input className="m-2 rounded border p-2" value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)} /></label>
    <label className="block">Withdrawal source time (UTC, YYYY-MM-DDTHH:mm:ss.sssZ)<input className="m-2 rounded border p-2" value={sourceTime} onChange={event => setSourceTime(event.target.value)} /></label><label className="block"><input type="checkbox" checked={witnessed} onChange={event => setWitnessed(event.target.checked)} /> I personally witnessed this withdrawal at the stated time; the evidence reference supports it.</label><p>Unknown or disputed source time requires review. Receipt, content drain and AI stop are separate; in-flight activity may finish after receipt.</p><div className="flex gap-3">{(["grant", "refuse", "withdraw"] as const).map((action) => <button key={action} className="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40" disabled={busy || ((terminal || withdrawalAttempted) && action !== "withdraw") || (action !== "withdraw" && (!disclosure.trim() || !evidence.trim() || !jurisdiction.trim()))} onClick={() => record(action)}>Record {action}</button>)}</div>
    <p role="status">{status}</p>
  </details>;
}
