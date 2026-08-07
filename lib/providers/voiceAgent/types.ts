export type VoiceAgentProviderId = "mock" | "vapi" | "retell"

export interface VoiceAgentSessionContext {
  accountId: string
  sessionId: string
  callId: string
}

export interface VoiceAgentSession {
  providerSessionId: string
  accountId: string
  sessionId: string
  callId: string
  startedAt: string
}

export interface VoiceAgentTurn {
  turnId: string
  speaker: "agent" | "caller"
  text: string
}

export interface VoiceAgentSummary {
  providerSessionId: string
  accountId: string
  sessionId: string
  callId: string
  endedAt: string
  transcript: string
  intent: string
  qualificationStatus: "qualified" | "unqualified" | "unknown"
}

export interface VoiceAgentProvider {
  readonly providerId: VoiceAgentProviderId
  startSession(ctx: VoiceAgentSessionContext): Promise<VoiceAgentSession>
  appendTurn(session: VoiceAgentSession, turn: VoiceAgentTurn): Promise<void>
  endSession(session: VoiceAgentSession): Promise<VoiceAgentSummary>
}
