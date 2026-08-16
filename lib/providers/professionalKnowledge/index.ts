import { MockProfessionalKnowledgeProvider } from "@/lib/providers/professionalKnowledge/mock"
import type { ProfessionalKnowledgeProvider } from "@/lib/providers/professionalKnowledge/types"
import { resolveProvider } from "@/lib/providers/resolve"

export * from "@/lib/providers/professionalKnowledge/types"
export * from "@/lib/providers/professionalKnowledge/mock"
export { INTERNAL_DEMO_ACCOUNT_ID } from "@/lib/providers/professionalKnowledge/fixture"

/**
 * Career OS is the future source of professional truth. No live
 * adapter is wired (ADR-0001, ADR-0046) — `createLive` is omitted, so
 * this always resolves to the fixture-backed mock even when
 * `CAREER_OS_API_KEY` is present.
 */
export function getProfessionalKnowledgeProvider(): ProfessionalKnowledgeProvider {
  return resolveProvider({
    envVarName: "CAREER_OS_API_KEY",
    createMock: () => new MockProfessionalKnowledgeProvider(),
  })
}
