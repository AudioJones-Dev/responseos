export type VoiceEventType = "voice.session_started" | "voice.session_ended"

export interface SessionContext {
  accountId: string
  sessionId: string
}

export interface ProviderSession {
  providerSessionId: string
  accountId: string
  sessionId: string
  startedAt: string
  eventType: VoiceEventType
}

export interface AudioFrame {
  sequence: number
  payload: string
}

export interface PartialTranscript {
  sequence: number
  text: string
  isFinal: boolean
}

export interface ToolCall {
  name: string
  arguments: Record<string, string>
}

export interface ToolResult {
  output: string
}

export interface Turn {
  turnId: string
  speaker: "agent" | "caller"
  text: string
}

export interface SessionSummary {
  providerSessionId: string
  accountId: string
  sessionId: string
  endedAt: string
  turnCount: number
  partialCount: number
  summaryText: string
  eventType: VoiceEventType
}

export interface VoiceProvider {
  startSession(ctx: SessionContext): Promise<ProviderSession>
  streamAudio(session: ProviderSession, frame: AudioFrame): void
  onPartialTranscript(cb: (t: PartialTranscript) => void): void
  onToolCall(cb: (call: ToolCall) => Promise<ToolResult>): void
  onTurnComplete(cb: (turn: Turn) => void): void
  endSession(session: ProviderSession): Promise<SessionSummary>
}
