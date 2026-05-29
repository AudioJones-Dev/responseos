import { getCurrentAccount } from "@/lib/auth/session";
import { RevenueMetrics } from "@/lib/data";

const FALLBACK_ACCOUNT_ID = "org_mock_1";

const formatUsd = (cents: number): string =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default async function ClientRevenuePage() {
  const org = await getCurrentAccount();
  const result = await RevenueMetrics.listRevenueMetrics({
    accountId: org?.id ?? FALLBACK_ACCOUNT_ID,
  });
  const trend = result.ok ? result.data : [];
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Revenue Recovered</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Trend by month. Estimated vs verified recovered revenue.
      </p>
      <ul className="mt-6 divide-y divide-zinc-200">
        {trend.map((m) => (
          <li key={m.id} className="flex items-center justify-between py-3 text-sm">
            <div>
              <p className="font-medium text-zinc-900">{m.period_start.slice(0, 7)}</p>
              <p className="text-xs text-zinc-500">
                {m.qualified_leads} qualified · {m.appointments_booked} booked ·{" "}
                {m.jobs_won} won
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium text-emerald-700">
                {formatUsd(m.estimated_recovered_revenue)}
              </p>
              <p className="text-xs text-zinc-500">
                verified {formatUsd(m.verified_recovered_revenue)} ·{" "}
                {m.roi_multiple ? `${m.roi_multiple.toFixed(1)}x` : "—"}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
