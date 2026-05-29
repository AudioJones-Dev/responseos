import { getCurrentAccount } from "@/lib/auth/session";
import { Appointments } from "@/lib/data";

const FALLBACK_ACCOUNT_ID = "org_mock_1";

export default async function ClientAppointmentsPage() {
  const org = await getCurrentAccount();
  const result = await Appointments.listAppointments({
    accountId: org?.id ?? FALLBACK_ACCOUNT_ID,
  });
  const appointments = result.ok ? result.data : [];
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Appointments</h1>
      <ul className="mt-6 divide-y divide-zinc-200">
        {appointments.map((b) => (
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
