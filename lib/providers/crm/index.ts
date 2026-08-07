import { MockCrmProvider } from "@/lib/providers/crm/mock"
import type { CrmProvider } from "@/lib/providers/crm/types"
import { resolveProvider } from "@/lib/providers/resolve"

export * from "@/lib/providers/crm/types"
export * from "@/lib/providers/crm/mock"

export function getCrmProvider(): CrmProvider {
  return resolveProvider({
    envVarName: "HUBSPOT_ACCESS_TOKEN",
    createMock: () => new MockCrmProvider(),
  })
}
