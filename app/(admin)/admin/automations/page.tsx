export default function AdminAutomationsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Automations</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Trigger-driven workflows: missed call, after-hours, new lead,
        quote requested, booking created, no response, job completed.
        Backed by n8n / Make / internal runner.
      </p>
    </main>
  );
}
