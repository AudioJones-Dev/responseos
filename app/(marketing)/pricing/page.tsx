const tiers = [
  {
    name: "Recovery Core",
    price: "TBD",
    bullets: [
      "Missed-call recovery",
      "AI inbound answering (mock)",
      "Lead qualification scoring",
      "Monthly ROI report",
    ],
  },
  {
    name: "Recovery Pro",
    price: "TBD",
    bullets: [
      "Everything in Core",
      "Quote + booking flows",
      "Outbound recovery campaigns",
      "Client portal access",
    ],
  },
  {
    name: "Recovery Performance",
    price: "ROI-aligned",
    bullets: [
      "Everything in Pro",
      "Earn-on-outcomes structure",
      "AJ Digital operator support",
      "Quarterly business reviews",
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold">Pricing</h1>
      <p className="mt-2 text-zinc-600">
        ROI-aligned partnerships. Front the work, earn on outcomes.
      </p>
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {tiers.map((tier) => (
          <article
            key={tier.name}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-lg font-semibold">{tier.name}</h2>
            <p className="mt-2 text-2xl font-semibold text-emerald-700">
              {tier.price}
            </p>
            <ul className="mt-4 space-y-1 text-sm text-zinc-700">
              {tier.bullets.map((b) => (
                <li key={b}>- {b}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </main>
  );
}
