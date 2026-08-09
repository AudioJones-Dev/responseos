import { resolveProvider } from "@/lib/providers/resolve"
import { MockVoiceAgentProvider } from "@/lib/providers/voiceAgent/mock"
import type { VoiceAgentProvider } from "@/lib/providers/voiceAgent/types"

export * from "@/lib/providers/voiceAgent/types"
export * from "@/lib/providers/voiceAgent/mock"

export function getVoiceAgentProvider(): VoiceAgentProvider {
  return resolveProvider({
    envVarName: "VAPI_API_KEY",
    createMock: () => new MockVoiceAgentProvider(),
  })
}
