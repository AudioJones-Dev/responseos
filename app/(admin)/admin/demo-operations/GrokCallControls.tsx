"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GrokCallControls({ captureId, accountId, providerCallId, generation, stopped, commands }: {
  captureId: string; accountId: string; providerCallId: string; generation: number; stopped: boolean;
  commands: Array<{ kind: string; status: string }>;
}) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const router = useRouter();
  async function end() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/call-capture/${captureId}/end-call`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedAccountId: accountId, expectedProviderCallId: providerCallId, generation }) });
      setMessage(response.ok ? "Termination requested. Disconnection remains unconfirmed; repeated requests do not resend consumed commands." : "Termination request unavailable. Use the separately approved carrier fallback or halt the demo.");
    } catch { setMessage("Termination result uncertain. Do not assume the call ended."); }
    finally { setBusy(false); router.refresh(); }
  }
  return <section aria-label="Grok call control">
    <p>Grok Voice 3.0 · exact call {providerCallId} · generation {generation}.</p>
    <p>{stopped ? "Admission closed; consent cannot reopen." : "Handoff attempt consumed; do not retry or reset."}</p>
    <p>Disconnection unconfirmed. Authenticated Grok terminal evidence is not qualified. Command acceptance and socket closure are not proof.</p>
    {commands.map(command => <p key={command.kind}>{command.kind}: {command.status}</p>)}
    <button disabled={busy} onClick={end}>End Grok call</button>
    <button onClick={() => router.refresh()}>Refresh Grok evidence</button>
    <p role="status">{message}</p>
  </section>;
}
