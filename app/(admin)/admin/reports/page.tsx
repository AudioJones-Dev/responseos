import { getMockRevenueMetrics } from "@/lib/mock/revenueMetrics";

const formatUsd = (cents: number): string =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default function AdminReportsPage() {
  const metrics = getMockRevenueMetrics();
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Trended revenue recovery metrics by period.
      </p>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="border-b border-zinc-200 py-2 pr-3">Period</th>
            <th className="border-b border-zinc-200 py-2 pr-3">Calls</th>
            <th className="border-b border-zinc-200 py-2 pr-3">Missed</th>
            <th className="border-b border-zinc-200 py-2 pr-3">Qualified</th>
            <th className="border-b border-zinc-200 py-2 pr-3">Booked</th>
            <th className="border-b border-zinc-200 py-2 pr-3">Recovered</th>
            <th className="border-b border-zinc-200 py-2 pr-3">ROI</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.id} className="text-zinc-800">
              <td className="border-b border-zinc-100 py-2 pr-3 font-mono text-xs">
                {m.period_start.slice(0, 7)}
              </td>
              <td className="border-b border-zinc-100 py-2 pr-3">{m.total_calls}</td>
              <td className="border-b border-zinc-100 py-2 pr-3">{m.missed_calls}</td>
              <td className="border-b border-zinc-100 py-2 pr-3">{m.qualified_leads}</td>
              <td className="border-b border-zinc-100 py-2 pr-3">{m.appointments_booked}</td>
              <td className="border-b border-zinc-100 py-2 pr-3">
                {formatUsd(m.estimated_recovered_revenue)}
              </td>
              <td className="border-b border-zinc-100 py-2 pr-3">
                {m.roi_multiple ? `${m.roi_multiple.toFixed(1)}x` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
