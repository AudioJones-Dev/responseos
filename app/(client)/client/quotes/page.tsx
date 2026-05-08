import { getCurrentOrganization } from "@/lib/auth/session";
import { Quotes } from "@/lib/data";

const FALLBACK_ORG_ID = "org_mock_1";

const formatUsd = (cents?: number): string =>
  typeof cents === "number"
    ? (cents / 100).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })
    : "—";

export default async function ClientQuotesPage() {
  const org = await getCurrentOrganization();
  const result = await Quotes.listQuoteRequests({
    organizationId: org?.id ?? FALLBACK_ORG_ID,
  });
  const quotes = result.ok ? result.data : [];
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Quote Requests</h1>
      <ul className="mt-6 divide-y divide-zinc-200">
        {quotes.map((q) => (
          <li key={q.id} className="py-3 text-sm">
            <p className="font-medium text-zinc-900">{q.service_type}</p>
            <p className="text-xs text-zinc-500">
              {q.status} · {formatUsd(q.estimated_value)}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
