"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Turn = { sequence: number; speaker: string; text: string; occurred_at: string };

export function PilotTranscript({ captureId }: { captureId: string }) {
  const [turns, setTurns] = useState<Turn[]>([]), [stopped, setStopped] = useState(false), [message, setMessage] = useState("");
  const router = useRouter();
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const response = await fetch(`/api/admin/call-capture/${captureId}/pilot-review`, { cache: "no-store" });
        const result = await response.json();
        if (live && response.ok) { setTurns(result.data.turns); setStopped(result.data.stopped); }
      } catch { if (live) setMessage("Transcript refresh failed. Watch the call state and use End Grok call if unsure."); }
    }
    void load();
    const timer = setInterval(() => { if (!stopped) void load(); }, 2000);
    return () => { live = false; clearInterval(timer); };
  }, [captureId, stopped]);
  async function draft() {
    const response = await fetch(`/api/admin/call-capture/${captureId}/pilot-review`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Review drafted below." : `No draft: ${result.data?.status ?? result.error ?? "unavailable"}.`);
    router.refresh();
  }
  return <section aria-label="Live pilot transcript">
    <p><strong>Live transcript (pilot).</strong> If the caller asks to stop, end the call now. A spoken stop does not end the call by itself.</p>
    <ol className="whitespace-pre-wrap">{turns.map(turn => <li key={turn.sequence}>{turn.speaker === "caller" ? "Caller" : "Sam"}: {turn.text}</li>)}</ol>
    {turns.length === 0 && <p>No consented transcript yet.</p>}
    {stopped && <button onClick={draft}>Draft review from transcript</button>}
    <p role="status">{message}</p>
  </section>;
}
