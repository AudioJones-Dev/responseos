import { getMockLeadEvents } from "@/lib/mock/leads";

const formatUsd = (cents?: number): string =>
  typeof cents === "number"
    ? (cents / 100).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })
    : "—";

export default function AdminLeadsPage() {
  const leads = getMockLeadEvents();
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Lead Events</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Central revenue recovery object. Every captured demand signal
        becomes a lead_event.
      </p>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="border-b border-zinc-200 py-2 pr-3">Source</th>
            <th className="border-b border-zinc-200 py-2 pr-3">Event</th>
            <th className="border-b border-zinc-200 py-2 pr-3">Status</th>
            <th className="border-b border-zinc-200 py-2 pr-3">Urgency</th>
            <th className="border-b border-zinc-200 py-2 pr-3">Estimated</th>
            <th className="border-b border-zinc-200 py-2 pr-3">Recovered</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="text-zinc-800">
              <td className="border-b border-zinc-100 py-2 pr-3">{l.source}</td>
              <td className="border-b border-zinc-100 py-2 pr-3">{l.event_type}</td>
              <td className="border-b border-zinc-100 py-2 pr-3">{l.status}</td>
              <td className="border-b border-zinc-100 py-2 pr-3">{l.urgency}</td>
              <td className="border-b border-zinc-100 py-2 pr-3">
                {formatUsd(l.estimated_value)}
              </td>
              <td className="border-b border-zinc-100 py-2 pr-3">
                {formatUsd(l.recovered_value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
