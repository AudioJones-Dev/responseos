import { getCurrentOrganization } from "@/lib/auth/session";
import { Bookings } from "@/lib/data";

const FALLBACK_ORG_ID = "org_mock_1";

export default async function ClientBookingsPage() {
  const org = await getCurrentOrganization();
  const result = await Bookings.listBookings({
    organizationId: org?.id ?? FALLBACK_ORG_ID,
  });
  const bookings = result.ok ? result.data : [];
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Bookings</h1>
      <ul className="mt-6 divide-y divide-zinc-200">
        {bookings.map((b) => (
          <li key={b.id} className="py-3 text-sm">
            <p className="font-medium text-zinc-900">{b.title}</p>
            <p className="text-xs text-zinc-500">
              {b.start_time.slice(0, 16).replace("T", " ")} · {b.status} ·{" "}
              {b.calendar_provider}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
