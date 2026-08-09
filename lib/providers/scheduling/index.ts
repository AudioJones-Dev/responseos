import { resolveProvider } from "@/lib/providers/resolve"
import { MockSchedulingProvider } from "@/lib/providers/scheduling/mock"
import type { SchedulingProvider } from "@/lib/providers/scheduling/types"

export * from "@/lib/providers/scheduling/types"
export * from "@/lib/providers/scheduling/mock"

export function getSchedulingProvider(): SchedulingProvider {
  return resolveProvider({
    envVarName: "CALENDLY_API_KEY",
    createMock: () => new MockSchedulingProvider(),
  })
}
