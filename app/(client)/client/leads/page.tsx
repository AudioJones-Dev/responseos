import { getMockLeadEvents } from "@/lib/mock/leads";

export default function ClientLeadsPage() {
  const leads = getMockLeadEvents().filter((l) => l.organization_id === "org_mock_1");
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Leads</h1>
      <ul className="mt-6 divide-y divide-zinc-200">
        {leads.map((l) => (
          <li key={l.id} className="py-3 text-sm">
            <p className="font-medium text-zinc-900">
              {l.event_type} · {l.status}
            </p>
            <p className="text-xs text-zinc-500">
              source: {l.source} · urgency: {l.urgency}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
