import { getMockCalls } from "@/lib/mock/calls";

export default function AdminCallsPage() {
  const calls = getMockCalls();
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Calls</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Inbound and outbound call events across providers (Twilio, Retell,
        Vapi, Bland, manual).
      </p>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="border-b border-zinc-200 py-2 pr-3">Time</th>
            <th className="border-b border-zinc-200 py-2 pr-3">Direction</th>
            <th className="border-b border-zinc-200 py-2 pr-3">Status</th>
            <th className="border-b border-zinc-200 py-2 pr-3">Provider</th>
            <th className="border-b border-zinc-200 py-2 pr-3">From</th>
            <th className="border-b border-zinc-200 py-2 pr-3">To</th>
            <th className="border-b border-zinc-200 py-2 pr-3">Duration</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => (
            <tr key={c.id} className="text-zinc-800">
              <td className="border-b border-zinc-100 py-2 pr-3 font-mono text-xs">
                {c.started_at.slice(0, 16).replace("T", " ")}
              </td>
              <td className="border-b border-zinc-100 py-2 pr-3">{c.direction}</td>
              <td className="border-b border-zinc-100 py-2 pr-3">{c.status}</td>
              <td className="border-b border-zinc-100 py-2 pr-3">{c.provider}</td>
              <td className="border-b border-zinc-100 py-2 pr-3 font-mono text-xs">
                {c.from_number}
              </td>
              <td className="border-b border-zinc-100 py-2 pr-3 font-mono text-xs">
                {c.to_number}
              </td>
              <td className="border-b border-zinc-100 py-2 pr-3">
                {c.duration_seconds ?? 0}s
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
