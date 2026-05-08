import { getCurrentOrganization } from "@/lib/auth/session";
import { Calls } from "@/lib/data";

const FALLBACK_ORG_ID = "org_mock_1";

export default async function ClientCallsPage() {
  const org = await getCurrentOrganization();
  const result = await Calls.listCalls({
    organizationId: org?.id ?? FALLBACK_ORG_ID,
  });
  const calls = result.ok ? result.data : [];
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Calls</h1>
      <ul className="mt-6 divide-y divide-zinc-200">
        {calls.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-3 text-sm">
            <div>
              <p className="font-medium text-zinc-900">
                {c.direction === "inbound" ? "Inbound" : "Outbound"} — {c.status}
              </p>
              <p className="text-xs text-zinc-500">
                {c.started_at.slice(0, 16).replace("T", " ")} · {c.from_number} → {c.to_number}
              </p>
            </div>
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              {c.provider}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
