"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { WithdrawalRecoveryTarget } from "@/lib/callReview/withdrawalRecovery";

type Action = "grant" | "refuse" | "withdraw";

export function ConsentControls({ id, callReference, terminal = false, databaseRecoveryTarget }: { id: string; callReference: string; terminal?: boolean; databaseRecoveryTarget?: WithdrawalRecoveryTarget }) {
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
        setStatus(`Withdrawal receipt: ${progress.receipt.replaceAll("_", " ")}${progress.receivedAt ? ` at ${progress.receivedAt}` : ""}. Content drain: ${progress.drain}. AI stop command: ${progress.aiStop.replaceAll("_", " ")}; provider cessation unconfirmed. Already-authorized content may finish before drain confirms; retained content remains stored. ${result.ok ? "Evidence recorded; review actual activity." : "Retry withdrawal may send AI stop. Continue database processing makes no provider call."}`);
        if (result.ok) pending.current = null;
      } else if (result.ok) {
        pending.current = null;
        setStatus(action === "withdraw" ? `Withdrawal received at ${result.data.recordedAt}. Source time: ${result.data.sourceTimeStatus}. Activity requires review.` : `Recorded ${result.data.action} at ${result.data.occurredAt}.`);
      } else if (result.error === "consent_effect_incomplete") {
        setStatus(`Consent recorded. Provider command incomplete; retry the same decision. This is not provider cessation proof.`);
      } else if (result.error === "withdrawal_recording_incomplete") {
        setStatus("Withdrawal result uncertain. A processing fence may already be recorded. Retry withdrawal may send AI stop; review the activity evidence.");
      } else {
        pending.current = null;
        setStatus(result.error === "idempotency_conflict" ? "This decision was already recorded with different references." : "Consent event was not recorded.");
      }
      router.refresh();
    } catch { setStatus(`Result uncertain. Repeating ${action} may send a provider command; review the recorded state.`); }
    finally { setBusy(false); }
  }
  async function continueDatabase() {
    if (!databaseRecoveryTarget) return;
    setBusy(true);
    try {
      const { captureId, ...target } = databaseRecoveryTarget;
      const response = await fetch(`/api/admin/call-capture/${encodeURIComponent(captureId)}/withdrawal-recovery`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...target, original: { disclosureRef: disclosure, evidenceRef: evidence, jurisdictionBasis: jurisdiction, withdrawalSourceTime: { occurredAt: sourceTime, attestation: witnessed ? "operator_witness" : "unverified" } } }) });
      const result = await response.json();
      setStatus(result.ok ? `Withdrawal receipt: ${result.data.withdrawal.receipt}. Content drain: ${result.data.withdrawal.drain}. Withdrawal evidence: ${result.data.evidence.state.replaceAll("_", " ")}${result.data.evidence.reason ? ` (${result.data.evidence.reason.replaceAll("_", " ")})` : ""}. No provider action from this continuation. Provider cessation is unconfirmed.` : `Database continuation unavailable: ${result.error}. Refresh the recorded state; this action makes no provider call.`);
      router.refresh();
    } catch { setStatus("Database continuation acknowledgement unavailable. Refresh or repeat database continuation to resolve database state; it makes no provider call."); }
    finally { setBusy(false); }
  }
  return <details className="my-3 rounded border p-4">
    <summary>Capture consent · {callReference}</summary>
    <p className="my-2">Record only the DTMF decision you witnessed for this exact active call after the approved disclosure. A saved withdrawal receipt blocks new authorizations; already-authorized raw history, caller data and transcripts may finish before drain confirms and remain stored afterward. AI stop follows drain and is reported separately. Recording remains off.</p>
    <label className="block">Disclosure version/reference<input className="m-2 rounded border p-2" value={disclosure} onChange={(event) => setDisclosure(event.target.value)} /></label>
    <label className="block">Evidence reference<input className="m-2 rounded border p-2" value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label>
    <label className="block">Jurisdiction basis<input className="m-2 rounded border p-2" value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)} /></label>
    <label className="block">Withdrawal source time (UTC, YYYY-MM-DDTHH:mm:ss.sssZ)<input className="m-2 rounded border p-2" value={sourceTime} onChange={event => setSourceTime(event.target.value)} /></label><label className="block"><input type="checkbox" checked={witnessed} onChange={event => setWitnessed(event.target.checked)} /> I personally witnessed this withdrawal at the stated time; the evidence reference supports it.</label><p>Unknown or disputed source time requires review. Receipt, content drain and AI stop are separate; in-flight activity may finish after receipt.</p><div className="flex gap-3">{(["grant", "refuse", "withdraw"] as const).map((action) => <button key={action} className="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40" disabled={busy || ((terminal || withdrawalAttempted) && action !== "withdraw") || (action !== "withdraw" && (!disclosure.trim() || !evidence.trim() || !jurisdiction.trim()))} onClick={() => record(action)}>{action === "withdraw" ? terminal || withdrawalAttempted ? "Retry withdrawal (may send AI stop)" : "Record withdraw (may send AI stop)" : `Record ${action}`}</button>)}</div>
    {databaseRecoveryTarget && <><button className="mt-3 rounded border px-3 py-2 disabled:opacity-40" disabled={busy} onClick={continueDatabase}>Continue database processing (no provider action)</button><p>Use the original form inputs above. The event key comes from the saved receipt. Missing or mismatched inputs require review; a valid drain can still complete. New evidence is classified using the current call state; existing evidence is preserved. Another withdrawal request may independently send AI stop.</p></>}
    <p role="status">{status}</p>
  </details>;
}
