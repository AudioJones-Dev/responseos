import { Card } from "@/components/ui";
import { AtmosphereBackground } from "@/components/layout/AtmosphereBackground";

export const metadata = {
  title: "Trust & security",
  description:
    "How ResponseOS is architected for tenant isolation, auditability, and a clean payment boundary — which controls are in place, which are planned, and an honest read on where the build is today.",
};

const CONTROLS = [
  {
    title: "Tenant isolation by construction",
    body: "Every read and write your team makes is scoped to your account, derived from the authenticated session — never from client input. It's enforced in the data layer and covered by cross-tenant tests. One tenant can't reach another's data.",
  },
  {
    title: "Audit trail",
    body: "Some security and workflow actions — removing a user, reviewing an assessment request, setting up a demo — are written once to an audit log, and every verified call-event and identity webhook is recorded on receipt. Covering every account-access change, call, lead, booking, quote, and admin action — and locking the trail at the database level — is planned, not built.",
  },
  {
    title: "Webhook signatures verified",
    body: "Every inbound provider webhook must pass signature validation before it can change anything in your account. That's enforced today on the call-event and identity webhooks; the other provider endpoints accept nothing until their integration ships with verification. An unverified event mutates nothing.",
  },
  {
    title: "Clean payment boundary",
    body: "Billing is designed to run through Stripe hosted pages and Payment Intents only, so card data never touches our systems. Billing isn't live yet, and no payment details are collected today.",
  },
  {
    title: "Data minimization & retention",
    body: "Call transcripts carry a retention lane — full, redacted, or metadata-only — and raw payloads from personalized-demo calls carry an expiry. Per-tenant retention settings, an expiry on every stored payload, and automatic enforcement of each lane are planned.",
  },
  {
    title: "Deletion & export",
    body: "Tenant-scoped export and deletion workflows are planned so your data stays yours — you can take it with you or have it removed. They aren't built yet.",
  },
];

export default function TrustPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
      <section className="relative isolate overflow-hidden">
        <AtmosphereBackground
          family="noise-glass"
          size="1600x900"
          intensity={0.6}
        />
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Trust &amp; security
        </p>
        <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-[1.1] text-ink sm:text-4xl">
          Built for trust before scale
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
          ResponseOS handles the calls, leads, and revenue at the center of your
          business. The security model is foundational, not bolted on — here is
          how it works, and an honest read on where the build is today.
        </p>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold text-ink">
          How it&apos;s architected
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {CONTROLS.map((c) => (
            <Card key={c.title} interactive>
              <h3 className="text-lg font-semibold text-ink">{c.title}</h3>
              <p className="mt-2 text-sm text-ink-secondary">{c.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold text-ink">
          On compliance — the straight version
        </h2>
        <Card className="mt-6 border-line-strong">
          <p className="text-sm text-ink-secondary">
            <span className="font-semibold text-ink">
              ResponseOS is not HIPAA-certified or HIPAA-compliant out of the
              box.
            </span>{" "}
            Compliance is a per-deployment property, not a product property. An
            optional HIPAA-ready deployment lane (AWS-hosted, BAA-backed across
            the vendor chain) is an architectural pattern available only after
            independent compliance review and per-tenant BAA verification — it
            is not a default and not implied by use of this product.
          </p>
        </Card>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Where the build is today
        </h2>
        <Card className="mt-6">
          <p className="text-sm text-ink-secondary">
            This is an internal-first product in active development. Tenant
            isolation is in place and tested; the audit trail is partial, and
            the payment boundary is a design rule because billing isn&apos;t
            live. Live provider integrations — and the signature verification
            that secures each one — activate in a later release. Today the app
            runs on mock adapters with no live customer data. We&apos;d rather
            tell you that than imply otherwise.
          </p>
        </Card>
      </section>
    </main>
  );
}
