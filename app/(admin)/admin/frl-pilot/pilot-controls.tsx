"use client";

import { useEffect, useState } from "react";
type Run = { id: string; stage: string; incident?: string; digits: string[]; terminalObserved: boolean; pending: null | { caller: string; arrivedAt: number; expiresAt: number } };
type Status = { exercise: string; deletionPending: number; runs: Run[] };

export default function PilotControls() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionResult, setActionResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const response = await fetch("/api/admin/frl-pilot", { cache: "no-store" });
        if (!response.ok) throw new Error("Pilot controls unavailable. Calls must remain disabled.");
        const next = await response.json();
        if (!stopped) { setStatus(next); setNow(Date.now()); setError(""); }
      } catch { if (!stopped) { setStatus(null); setError("Pilot controls unavailable. Check configuration and sign-in."); } }
    };
    void poll(); const timer = setInterval(() => { void poll(); }, 1000);
    return () => { stopped = true; clearInterval(timer); };
  }, []);
  async function act(action?: "approve" | "reject", runId?: string) {
    setBusy(true);
    setActionError("");
    setActionResult("");
    try {
      const response = await fetch("/api/admin/frl-pilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: action ? JSON.stringify({ action, runId }) : undefined });
      if (!response.ok) throw new Error();
      setActionResult(action === "approve"
        ? "Approval accepted. Watch the call status for the answer and keypad events."
        : action === "reject" ? "Rejection accepted. Watch for the call to end." : "Stop accepted. Watch for all calls to end.");
    } catch { setActionError("Action was not confirmed. Check the call status before trying another call."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4">
    <button className="rounded bg-red-700 px-4 py-2 text-white" disabled={busy} onClick={() => void act()}>Stop window and end calls</button>
    <p role="alert">{error}</p>
    <p role="alert">{actionError}</p>
    <p role="status">{actionResult}</p>
    {status && <><p>Exercise: {status.exercise}. Overdue cleanup tasks: {status.deletionPending}.</p>
      {status.runs.map(run => <article className="space-y-2 rounded border p-4" key={run.id}>
        <p>{run.stage}{run.incident ? ` — ${run.incident}` : ""}</p>
        {run.pending && <><p>Caller: {run.pending.caller}. Arrived: {new Date(run.pending.arrivedAt).toLocaleTimeString()}. Approval expires: {new Date(run.pending.expiresAt).toLocaleTimeString()}.</p>
          <button className="mr-3 rounded border px-3 py-2" disabled={busy || now >= run.pending.expiresAt} onClick={() => void act("approve", run.id)}>This is my Grok test — approve</button>
          <button className="rounded border px-3 py-2" disabled={busy} onClick={() => void act("reject", run.id)}>Reject</button></>}
        <p>Verified keypad events: {run.digits.join(", ") || "none"}. Terminal callbacks: {run.terminalObserved ? "observed" : "not complete"}.</p>
      </article>)}</>}
  </section>;
}
