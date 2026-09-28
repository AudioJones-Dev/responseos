import { Card, StatusBadge, type Tone } from "@/components/ui";
import { AtmosphereBackground } from "@/components/layout/AtmosphereBackground";

export const metadata = {
  title: "Trust & security",
  description:
    "The key ResponseOS security, data, payment, and privacy controls, labeled implemented, partial, planned, or not claimed — plus the certifications we don't hold and an honest read on where the build is today.",
};

type Status = "Implemented" | "Partial" | "Planned" | "Not claimed";

// Maps onto doctrine §2.1: SHIPPED / PARTIALLY_SHIPPED / DOCUMENTED_ONLY–ROADMAP / PROHIBITED_CLAIM.
const STATUS: Record<Status, { tone: Tone; meaning: string }> = {
  Implemented: { tone: "success", meaning: "Built, in use, and covered by tests." },
  Partial: { tone: "warning", meaning: "Some of it is built; the rest is named below." },
  Planned: { tone: "neutral", meaning: "Designed, not built. Don't rely on it yet." },
  "Not claimed": { tone: "neutral", meaning: "We don't hold it and don't imply we do." },
};

type Control = { title: string; status: Status; body: string };

const GROUPS: { name: string; controls: Control[] }[] = [
  {
    name: "Security",
    controls: [
      {
        title: "Tenant isolation",
        status: "Implemented",
        body: "Every read and write your team makes is scoped to your account, derived from the authenticated session — never from client input. It's enforced in the data layer and covered by cross-tenant tests. One tenant can't reach another's data.",
      },
      {
        title: "Webhook signature verification",
        status: "Partial",
        body: "Enforced today on the call-event and identity webhooks: an event that fails verification changes nothing. The other provider endpoints accept nothing until their integration ships with verification.",
      },
      {
        title: "Audit trail",
        status: "Partial",
        body: "Some security and workflow actions — removing a user, reviewing an assessment request, setting up a demo — are written once to an audit log, and every verified call-event and identity webhook is recorded on receipt. Covering every account-access change, call, lead, booking, quote, and admin action, and locking the trail at the database level, is planned.",
      },
    ],
  },
  {
    name: "Data",
    controls: [
      {
        title: "Retention",
        status: "Partial",
        body: "Call transcripts carry a retention lane — full, redacted, or metadata-only — and raw payloads from personalized-demo calls carry an expiry. Per-tenant retention settings, an expiry on every stored payload, and automatic enforcement of each lane are planned.",
      },
      {
        title: "Export and deletion",
        status: "Planned",
        body: "Tenant-scoped export and deletion, so you can take your data with you or have it removed. Not built yet.",
      },
    ],
  },
  {
    name: "Payments",
    controls: [
      {
        title: "Payment boundary",
        status: "Planned",
        body: "Billing is designed to run through Stripe hosted pages and Payment Intents only, so card data never touches our systems. Billing isn't live, and no payment details are collected today.",
      },
    ],
  },
  {
    name: "Privacy",
    controls: [
      {
        title: "Fictional demo data",
        status: "Implemented",
        body: "The demo walkthrough, operator console, and client dashboard run on fictional records, and each of those screens says so.",
      },
      {
        title: "Privacy policy and terms",
        status: "Partial",
        body: "The privacy policy is published at /privacy and describes what the current build collects. Terms of service aren't published yet.",
      },
    ],
  },
];

const NOT_CLAIMED: Control[] = [
  {
    title: "HIPAA compliance",
    status: "Not claimed",
    body: "ResponseOS is not HIPAA-certified or HIPAA-compliant. Healthcare and other regulated workflows are excluded from first pilots.",
  },
  {
    title: "SOC 2, ISO 27001, PCI DSS",
    status: "Not claimed",
    body: "We hold none of these certifications and don't display their badges.",
  },
  {
    title: "Uptime commitment",
    status: "Not claimed",
    body: "ResponseOS doesn't yet run a live customer service, so there's no uptime figure or service-level agreement to offer.",
  },
];

function ControlCard({ control }: { control: Control }) {
  return (
    <Card className="h-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">{control.title}</h3>
        <StatusBadge label={control.status} tone={STATUS[control.status].tone} />
      </div>
      <p className="mt-2 text-sm text-ink-secondary">{control.body}</p>
    </Card>
  );
}

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
          ResponseOS is designed to handle the calls, leads, and revenue at the
          center of your business. Here are the key controls, each labeled by
          what is actually built — and an honest read on where the build is
          today.
        </p>
      </section>

      <section className="mt-12">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(STATUS) as Status[]).map((s) => (
            <div key={s} className="rounded-lg border border-line bg-surface p-4">
              <dt>
                <StatusBadge label={s} tone={STATUS[s].tone} />
              </dt>
              <dd className="mt-2 text-sm text-ink-secondary">
                {STATUS[s].meaning}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {GROUPS.map((group) => (
        <section key={group.name} className="mt-14">
          <h2 className="font-display text-2xl font-semibold text-ink">
            {group.name}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {group.controls.map((c) => (
              <ControlCard key={c.title} control={c} />
            ))}
          </div>
        </section>
      ))}

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold text-ink">
          What we don&apos;t claim
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
          Mature vendors show certification badges. We don&apos;t have them
          yet, so we list them here instead of implying them.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {NOT_CLAIMED.map((c) => (
            <ControlCard key={c.title} control={c} />
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Where the build is today
        </h2>
        <Card className="mt-6">
          <p className="text-sm text-ink-secondary">
            This is an internal-first product in active development. The
            public site and demo walkthrough run on mock adapters and
            fictional records. A separate, supervised prospect-demo lane can
            take calls on a designated demo number: those calls arrive
            signature-verified and are stored, but it isn&apos;t a live
            customer service and isn&apos;t approved for customer data. Other
            provider integrations activate in a later release. We&apos;d
            rather tell you that than imply otherwise.
          </p>
        </Card>
      </section>
    </main>
  );
}
