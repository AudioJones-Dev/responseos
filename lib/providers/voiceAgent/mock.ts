import type {
  VoiceAgentProvider,
  VoiceAgentSession,
  VoiceAgentSessionContext,
  VoiceAgentSummary,
  VoiceAgentTurn,
} from "@/lib/providers/voiceAgent/types"

const FIXED_STARTED_AT = "2026-01-01T00:00:00.000Z"
const FIXED_ENDED_AT = "2026-01-01T00:00:30.000Z"
const FIXED_TRANSCRIPT =
  "caller: i missed a call about a quote\nagent: i can help schedule a callback"
const FIXED_INTENT = "schedule_callback"
const FIXED_QUALIFICATION = "qualified" as const

export class MockVoiceAgentProvider implements VoiceAgentProvider {
  readonly providerId = "mock" as const
  private turns: VoiceAgentTurn[] = []

  async startSession(ctx: VoiceAgentSessionContext): Promise<VoiceAgentSession> {
    this.turns = []
    return {
      providerSessionId: `mock-agent:${ctx.accountId}:${ctx.sessionId}`,
      accountId: ctx.accountId,
      sessionId: ctx.sessionId,
      callId: ctx.callId,
      startedAt: FIXED_STARTED_AT,
    }
  }

  async appendTurn(session: VoiceAgentSession, turn: VoiceAgentTurn): Promise<void> {
    void session
    this.turns.push(turn)
  }

  async endSession(session: VoiceAgentSession): Promise<VoiceAgentSummary> {
    void this.turns
    return {
      providerSessionId: session.providerSessionId,
      accountId: session.accountId,
      sessionId: session.sessionId,
      callId: session.callId,
      endedAt: FIXED_ENDED_AT,
      transcript: FIXED_TRANSCRIPT,
      intent: FIXED_INTENT,
      qualificationStatus: FIXED_QUALIFICATION,
    }
  }
}
