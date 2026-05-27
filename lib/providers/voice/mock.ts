import type {
  AudioFrame,
  PartialTranscript,
  ProviderSession,
  SessionContext,
  SessionSummary,
  ToolCall,
  ToolResult,
  Turn,
  VoiceProvider,
} from "@/lib/providers/voice/types"

const FIXED_STARTED_AT = "2026-01-01T00:00:00.000Z"
const FIXED_ENDED_AT = "2026-01-01T00:00:05.000Z"

const FIXED_PARTIALS: PartialTranscript[] = [
  { sequence: 1, text: "hello", isFinal: false },
  { sequence: 2, text: "hello i need help", isFinal: true },
]

const FIXED_TURNS: Turn[] = [
  { turnId: "turn-1", speaker: "caller", text: "hello i need help" },
  { turnId: "turn-2", speaker: "agent", text: "i can help with that" },
]

const FIXED_TOOL_CALL: ToolCall = {
  name: "capture_callback",
  arguments: { requestedWindow: "today" },
}

export class MockVoiceProvider implements VoiceProvider {
  private partialTranscriptCb: ((t: PartialTranscript) => void) | null = null
  private toolCallCb: ((call: ToolCall) => Promise<ToolResult>) | null = null
  private turnCompleteCb: ((turn: Turn) => void) | null = null

  async startSession(ctx: SessionContext): Promise<ProviderSession> {
    return {
      providerSessionId: `${ctx.accountId}:${ctx.sessionId}`,
      accountId: ctx.accountId,
      sessionId: ctx.sessionId,
      startedAt: FIXED_STARTED_AT,
      eventType: "voice.session_started",
    }
  }

  streamAudio(session: ProviderSession, frame: AudioFrame): void {
    void session
    void frame
    for (const partial of FIXED_PARTIALS) {
      this.partialTranscriptCb?.(partial)
    }

    for (const turn of FIXED_TURNS) {
      this.turnCompleteCb?.(turn)
    }

    if (this.toolCallCb) {
      void this.toolCallCb(FIXED_TOOL_CALL)
    }
  }

  onPartialTranscript(cb: (t: PartialTranscript) => void): void {
    this.partialTranscriptCb = cb
  }

  onToolCall(cb: (call: ToolCall) => Promise<ToolResult>): void {
    this.toolCallCb = cb
  }

  onTurnComplete(cb: (turn: Turn) => void): void {
    this.turnCompleteCb = cb
  }

  async endSession(session: ProviderSession): Promise<SessionSummary> {
    return {
      providerSessionId: session.providerSessionId,
      accountId: session.accountId,
      sessionId: session.sessionId,
      endedAt: FIXED_ENDED_AT,
      turnCount: FIXED_TURNS.length,
      partialCount: FIXED_PARTIALS.length,
      summaryText: "caller requested help and agent acknowledged",
      eventType: "voice.session_ended",
    }
  }
}
