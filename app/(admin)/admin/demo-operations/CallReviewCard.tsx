"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FRL_INTERACTIONS, FRL_OUTCOMES, reviewMessage, type ReviewPayload } from "@/lib/callReview/contracts";

export function CallReviewCard(props: {
  id: string; callId: string; revision: number; status: string; recipient: string;
  payload: ReviewPayload; transcript: string | null; crmStatus: string; emailStatus: string;
}) {
  const [draft, setDraft] = useState(props.payload);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [recovery, setRecovery] = useState<{ generation: number; status: string; effect: string; reviewId: string | null; destination: string; readback: { outcome: string; providerId?: string; candidateIds?: string[] } } | null>(null);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [workerStopped, setWorkerStopped] = useState(false);
  const router = useRouter();
  const preview = reviewMessage(draft, props.callId);
  async function act(action: "approve" | "reject" | "dispatch") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/call-reviews/${props.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(action === "dispatch" ? { action } : { action, revision: props.revision, ...(action === "approve" ? { payload: draft } : {}) }) });
      const result = await response.json();
      setMessage(result.ok ? "Action completed. Delivery status shown below." : result.error?.code ?? "Action failed.");
      router.refresh();
    } catch { setMessage("Request interrupted. Refresh before retrying."); }
    finally { setBusy(false); }
  }
  const locked = props.status !== "pending" || busy;
  async function reconcile(action: "crm_inspect" | "crm_adopt" | "crm_abandon") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/call-reviews/${props.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...(action === "crm_inspect" ? {} : { generation: recovery?.generation, reason, evidence, ...(action === "crm_adopt" ? { priorWorkerStopped: workerStopped, expectedProviderId: recovery?.readback.providerId } : {}) }) }) });
      const result = await response.json();
      if (result.ok) { setRecovery(result.data); setMessage(action === "crm_inspect" ? "Readback does not prove absence or stop an earlier worker." : "Resolution recorded. Inspect status before dispatching the original review."); }
      else setMessage(result.error?.code ?? "Reconciliation did not complete.");
      router.refresh();
    } catch { setMessage("Request interrupted. Inspect before taking another action."); }
    finally { setBusy(false); }
  }
  const field = (key: "caller" | "phone" | "location" | "summary" | "callbackWindow" | "nextAction", label: string) => (
    <label className="block text-sm" key={key}>{label}<textarea className="mt-1 block w-full rounded border p-2" value={draft[key]} disabled={locked} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>
  );
  return <article className="my-6 rounded border p-5">
    <h3 className="text-lg font-semibold">Call {props.callId} · Review {props.revision}</h3>
    <p>Status: {props.status} · CRM: {props.crmStatus} · Email: {props.emailStatus}</p>
    <details className="my-4"><summary>Review transcript</summary><pre className="whitespace-pre-wrap">{props.transcript || "No consented transcript available."}</pre></details>
    <div className="grid gap-3 md:grid-cols-2">
      {field("caller", "Caller")}{field("phone", "Callback number")}{field("location", "Location")}{field("callbackWindow", "Callback window")}
      <label>Interaction<select className="block w-full rounded border p-2" disabled={locked} value={draft.interaction} onChange={(event) => setDraft({ ...draft, interaction: event.target.value as ReviewPayload["interaction"] })}>{FRL_INTERACTIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Product<select className="block w-full rounded border p-2" disabled={locked} value={draft.product} onChange={(event) => setDraft({ ...draft, product: event.target.value as ReviewPayload["product"] })}>{["unknown", "vpl", "vehicle_lift", "ceiling_lift", "ramp"].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Qualification<select className="block w-full rounded border p-2" disabled={locked} value={draft.qualification} onChange={(event) => setDraft({ ...draft, qualification: event.target.value as ReviewPayload["qualification"] })}>{["maybe", "qualified", "unqualified", "spam"].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Urgency<select className="block w-full rounded border p-2" disabled={locked} value={draft.urgency} onChange={(event) => setDraft({ ...draft, urgency: event.target.value as ReviewPayload["urgency"] })}>{["low", "medium", "high"].map((item) => <option key={item}>{item}</option>)}</select></label>
      {field("summary", "Summary")}{field("nextAction", "Next action")}<label>Outcome<select className="block w-full rounded border p-2" disabled={locked} value={draft.outcome} onChange={(event) => setDraft({ ...draft, outcome: event.target.value as ReviewPayload["outcome"] })}>{FRL_OUTCOMES.map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>
    <label className="my-3 block">Review flags (one per line)<textarea className="block w-full rounded border p-2" disabled={locked} value={draft.flags.join("\n")} onChange={(event) => setDraft({ ...draft, flags: event.target.value.split("\n").filter(Boolean) })} /></label>
    <details className="my-4" open><summary>Email preview — {props.recipient || "Recipient not configured"}</summary><strong>{preview.subject}</strong><pre className="whitespace-pre-wrap">{preview.text}</pre></details>
    <p>The approved summary, qualification and next action become the CRM call activity. A follow-up task is created only when qualified.</p>
    {props.status === "approved" && <details className="my-4"><summary>CRM reconciliation</summary>
      <p>Email waits for durable CRM success. No automatic retry of an uncertain create is available.</p>
      <button className="rounded border px-4 py-2" disabled={busy} onClick={() => reconcile("crm_inspect")}>Inspect CRM evidence</button>
      {recovery && <><pre className="whitespace-pre-wrap">{JSON.stringify(recovery, null, 2)}</pre>
        <label className="block">Reason<textarea className="block w-full rounded border p-2" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <label className="block">Independent evidence (no secrets or caller content)<textarea className="block w-full rounded border p-2" maxLength={1000} value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label>
        <label className="block"><input type="checkbox" checked={workerStopped} onChange={(event) => setWorkerStopped(event.target.checked)} /> I verified the earlier worker cannot resume or submit another request; my evidence records how.</label>
        <button className="rounded border px-4 py-2" disabled={busy || recovery.status !== "review_required" || recovery.readback.outcome !== "verified_match" || !workerStopped || reason.trim().length < 10 || evidence.trim().length < 10} onClick={() => reconcile("crm_adopt")}>Adopt verified result</button>
        <button className="rounded border px-4 py-2" disabled={busy || !recovery.reviewId || recovery.status !== "review_required" || reason.trim().length < 10 || evidence.trim().length < 10} onClick={() => reconcile("crm_abandon")}>Abandon local operation</button>
        <p>Abandoning does not undo any HubSpot effect. Leave this panel without a decision to keep the operation unresolved.</p>
      </>}
    </details>}
    <div className="mt-4 flex gap-3">
      {props.status === "pending" && <><button className="rounded border px-4 py-2" disabled={busy || !props.recipient || !props.transcript} onClick={() => act("approve")}>Approve follow-up</button><button className="rounded border px-4 py-2" disabled={busy} onClick={() => act("reject")}>Reject</button></>}
      {props.status === "approved" && <button className="rounded border px-4 py-2" disabled={busy} onClick={() => act("dispatch")}>Send approved follow-up / retry</button>}
    </div>
    <p role="status" className="mt-3">{message}</p>
  </article>;
}
