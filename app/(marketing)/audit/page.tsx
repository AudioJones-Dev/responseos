export default function AuditPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold">Revenue Recovery Audit</h1>
      <p className="mt-3 text-zinc-600">
        We map your missed-demand surface area: missed calls, after-hours
        traffic, unanswered SMS, lost quote requests, and slow follow-up.
        You walk away with an estimated recovered-revenue number for the
        next 30 days.
      </p>
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-zinc-700">
        <li>Connect your phone log + CRM (mock for now).</li>
        <li>We run the OFFER framework against your current funnel.</li>
        <li>You receive a RECOVER deployment plan with ROI estimate.</li>
      </ol>
    </main>
  );
}
