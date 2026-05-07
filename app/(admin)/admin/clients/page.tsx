import { Organizations } from "@/lib/data";

export default async function AdminClientsPage() {
  const result = await Organizations.listOrganizations();
  const orgs = result.ok ? result.data : [];
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Clients</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Workspaces ResponseOS is operating for. Tenant isolation enforced
        per organization.
      </p>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="border-b border-zinc-200 py-2 pr-3">Name</th>
            <th className="border-b border-zinc-200 py-2 pr-3">Slug</th>
            <th className="border-b border-zinc-200 py-2 pr-3">Industry</th>
            <th className="border-b border-zinc-200 py-2 pr-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {orgs.map((o) => (
            <tr key={o.id} className="text-zinc-800">
              <td className="border-b border-zinc-100 py-2 pr-3">{o.name}</td>
              <td className="border-b border-zinc-100 py-2 pr-3 font-mono text-xs">
                {o.slug}
              </td>
              <td className="border-b border-zinc-100 py-2 pr-3">{o.industry}</td>
              <td className="border-b border-zinc-100 py-2 pr-3">{o.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
