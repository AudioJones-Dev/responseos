import { getCurrentAccount } from "@/lib/auth/session";
import { Leads } from "@/lib/data";

const FALLBACK_ACCOUNT_ID = "org_mock_1";

export default async function ClientLeadsPage() {
  const org = await getCurrentAccount();
  const result = await Leads.listLeads({
    accountId: org?.id ?? FALLBACK_ACCOUNT_ID,
  });
  const leads = result.ok ? result.data : [];
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
