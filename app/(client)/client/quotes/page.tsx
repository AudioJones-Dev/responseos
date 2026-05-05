import { getMockQuoteRequests } from "@/lib/mock/quotes";

const formatUsd = (cents?: number): string =>
  typeof cents === "number"
    ? (cents / 100).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })
    : "—";

export default function ClientQuotesPage() {
  const quotes = getMockQuoteRequests().filter(
    (q) => q.organization_id === "org_mock_1",
  );
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
