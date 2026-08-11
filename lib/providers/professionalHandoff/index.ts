import { NoopProfessionalHandoffProvider } from "@/lib/providers/professionalHandoff/mock"
import type { ProfessionalHandoffProvider } from "@/lib/providers/professionalHandoff/types"
import { resolveProvider } from "@/lib/providers/resolve"

export * from "@/lib/providers/professionalHandoff/types"
export * from "@/lib/providers/professionalHandoff/mock"

/**
 * No live factory is wired (ADR-0001, ADR-0046), so this always
 * resolves to the no-op adapter — including when
 * `CAREER_OS_WEBHOOK_URL` is set.
 */
export function getProfessionalHandoffProvider(): ProfessionalHandoffProvider {
  return resolveProvider({
    envVarName: "CAREER_OS_WEBHOOK_URL",
    createMock: () => new NoopProfessionalHandoffProvider(),
  })
}
