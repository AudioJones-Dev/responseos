import { MockCarrierProvider } from "@/lib/providers/carrier/mock"
import type { CarrierProvider } from "@/lib/providers/carrier/types"
import { resolveProvider } from "@/lib/providers/resolve"

export * from "@/lib/providers/carrier/types"
export * from "@/lib/providers/carrier/mock"

export function getCarrierProvider(): CarrierProvider {
  return resolveProvider({
    envVarName: "TELNYX_API_KEY",
    createMock: () => new MockCarrierProvider(),
  })
}
