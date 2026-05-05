import Link from "next/link";

export default function MarketingHome() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-16">
      <header className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
          ResponseOS — AJ Digital LLC
        </p>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          AI Revenue Recovery Platform for service businesses.
        </h1>
        <p className="max-w-2xl text-lg text-zinc-600">
          ResponseOS captures missed calls, qualifies leads, automates
          follow-up, books opportunities, and reports the revenue you
          recovered. OFFER is the philosophy. RECOVER is how we ship it.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            title: "Capture",
            body: "Every missed call, SMS reply, web form, and AI-answered call is logged as a lead event.",
          },
          {
            title: "Qualify",
            body: "Service-area, urgency, decision-maker, budget timeline. Each lead gets a 0-100 score.",
          },
          {
            title: "Recover",
            body: "Automated follow-up, booking, and quote flows turn missed demand into recovered revenue.",
          },
          {
            title: "Report",
            body: "Recovered revenue, ROI multiple, response time, and admin hours saved every month.",
          },
          {
            title: "Operator-friendly",
            body: "Internal AJ Digital console first. Client portal next. Mock adapters now, real providers later.",
          },
          {
            title: "Framework-driven",
            body: "Built on the OFFER + RECOVER frameworks so every workflow ties back to outcomes.",
          },
        ].map((card) => (
          <article
            key={card.title}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm text-zinc-600">{card.body}</p>
          </article>
        ))}
      </section>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/audit"
          className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800"
        >
          Run a Revenue Audit
        </Link>
        <Link
          href="/demo"
          className="rounded-lg border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100"
        >
          Watch Demo
        </Link>
        <Link
          href="/pricing"
          className="rounded-lg border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100"
        >
          Pricing
        </Link>
        <Link
          href="/admin"
          className="rounded-lg border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100"
        >
          Operator Console
        </Link>
        <Link
          href="/client/dashboard"
          className="rounded-lg border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100"
        >
          Client Dashboard
        </Link>
      </nav>

      <footer className="border-t border-zinc-200 pt-6 text-xs text-zinc-500">
        <p>
          (c) {new Date().getFullYear()} AJ Digital LLC. ResponseOS is an
          internal-first product. This is a local development scaffold; no
          real integrations are wired.
        </p>
      </footer>
    </main>
  );
}
