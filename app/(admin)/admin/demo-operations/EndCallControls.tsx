"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EndCallTarget } from "@/lib/callControl/endCall";

export function EndCallControls({ target, confirmed }: { target: EndCallTarget; confirmed: boolean }) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const router = useRouter();
  async function end() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const { captureId, ...body } = target;
      const response = await fetch(`/api/admin/call-capture/${encodeURIComponent(captureId)}/end-call`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      setStatus(result.data?.disconnection.confirmed ? "Authenticated disconnection confirmed." : result.ok ? `End command: ${result.data.commandStatus ?? "unknown"}. Disconnection not confirmed. Repeated requests do not resend.` : "End call result unavailable or uncertain. Refresh evidence; do not assume disconnection.");
    } catch { setStatus("End call result uncertain. Refresh evidence; do not assume disconnection."); }
    finally { pending.current = false; setBusy(false); router.refresh(); }
  }
  return <div className="my-3"><button className="rounded border px-3 py-2" disabled={busy || confirmed} onClick={end}>End call</button><button className="ml-3 rounded border px-3 py-2" onClick={() => router.refresh()}>Refresh disconnection evidence</button><p role="status">{status}</p><p>Command acceptance is not confirmed disconnection. Consent is never reopened.</p></div>;
}
