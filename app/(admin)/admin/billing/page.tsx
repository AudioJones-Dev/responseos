import {
  PageHeader,
  Card,
  CardHeading,
  StatusBadge,
  AlertBanner,
  Table,
  THead,
  TBody,
  TR,
  TD,
} from "@/components/ui";

const formatUsd = (cents: number): string =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const invoices = [
  { id: "inv_preview_0003", period: "2026-05", amountCents: 49900, status: "Pending", tone: "neutral" as const },
  { id: "inv_preview_0002", period: "2026-04", amountCents: 49900, status: "Paid", tone: "success" as const },
  { id: "inv_preview_0001", period: "2026-03", amountCents: 29900, status: "Paid", tone: "success" as const },
];

export default function AdminBillingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Operator Console"
        title="Billing"
        description="Per-workspace billing and outcome-based pricing tiers. Preview only — no live payment processor is connected."
      />

      <AlertBanner className="mb-6">
        Billing is a preview with mock figures. Live Stripe-backed billing
        connects in v0.3.
      </AlertBanner>

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeading>Starter</CardHeading>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-ink">
            {formatUsd(29900)}
            <span className="ml-1 text-sm font-medium text-ink-muted">/mo</span>
          </p>
          <p className="mt-2 text-sm text-ink-secondary">
            Single workspace, core recovery automations.
          </p>
        </Card>
        <Card className="border-accent/40">
          <div className="flex items-center justify-between gap-3">
            <CardHeading>Growth</CardHeading>
            <StatusBadge label="Current" tone="accent" />
          </div>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-accent">
            {formatUsd(49900)}
            <span className="ml-1 text-sm font-medium text-ink-muted">/mo</span>
          </p>
          <p className="mt-2 text-sm text-ink-secondary">
            Multi-workspace, playbooks, and priority follow-up.
          </p>
        </Card>
        <Card>
          <CardHeading>Outcome</CardHeading>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-ink">
            Custom
          </p>
          <p className="mt-2 text-sm text-ink-secondary">
            Pricing tied to verified recovered revenue.
          </p>
        </Card>
      </section>

      <Card className="p-0">
        <div className="border-b border-line px-5 py-4">
          <CardHeading>Invoice History</CardHeading>
        </div>
        <Table>
          <THead columns={["Invoice", "Period", "Amount", "Status"]} />
          <TBody>
            {invoices.map((inv) => (
              <TR key={inv.id}>
                <TD mono>{inv.id}</TD>
                <TD mono>{inv.period}</TD>
                <TD className="font-mono text-ink">
                  {formatUsd(inv.amountCents)}
                </TD>
                <TD>
                  <StatusBadge label={inv.status} tone={inv.tone} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
