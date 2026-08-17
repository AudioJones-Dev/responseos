import { PageHeader, Card, StatusBadge, AlertBanner, ButtonLink } from "@/components/ui";
import { connection } from "next/server";
import type { Tone } from "@/components/ui";
import { DemoDataBanner } from "../../../_components/DemoDataBanner";
import { getWalkthroughScenario } from "../../../_data/getWalkthroughScenario";
import type { IntegrationState } from "../../../_data/scenario";

const STATE: Record<IntegrationState, { label: string; tone: Tone }> = {
  synced: { label: "Synced", tone: "success" },
  mock: { label: "Mock", tone: "warning" },
  disabled: { label: "Disabled", tone: "neutral" },
  captured: { label: "Captured", tone: "accent" },
};

export default async function IntegrationStatus() {
  await connection();
  const { source, error, integrations } = await getWalkthroughScenario();
  return (
    <>
      <PageHeader
        eyebrow="Step 6 · Integration Status"
        title="Everything you just saw ran on mock data"
        description="No live providers are connected in this walkthrough"
      />

      <DemoDataBanner source={source} error={error} />

      <AlertBanner variant="warning" className="mb-6">
        Demo mode — provider integrations are mocked or disabled. No Telnyx, Vapi, HubSpot, SMS, or
        live calls were used.
      </AlertBanner>

      <div className="grid gap-4 sm:grid-cols-2">
        {integrations.map((it) => {
          const s = STATE[it.state];
          return (
            <Card key={it.name}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{it.name}</p>
                <StatusBadge label={s.label} tone={s.tone} />
              </div>
              <p className="mt-2 text-sm text-ink-secondary">{it.detail}</p>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/demo/walkthrough">Restart walkthrough</ButtonLink>
        <ButtonLink href="/demo" variant="secondary">Back to demo overview</ButtonLink>
      </div>
    </>
  );
}
