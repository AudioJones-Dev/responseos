import { MockCrmProvider } from "@/lib/providers/crm/mock"
import { HubSpotCrmProvider } from "@/lib/providers/crm/hubspot"
import type { CrmProvider } from "@/lib/providers/crm/types"

export * from "@/lib/providers/crm/types"
export * from "@/lib/providers/crm/mock"
export * from "@/lib/providers/crm/hubspot"

export function getCrmProvider(): CrmProvider {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (
    process.env.RESPONSEOS_LIVE_HUBSPOT_ENABLED === "true" &&
    token
  ) {
    return new HubSpotCrmProvider(token)
  }
  return new MockCrmProvider()
}
