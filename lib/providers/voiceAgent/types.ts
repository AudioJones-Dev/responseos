/** VoiceAgentProvider — Vapi primary / Retell secondary (mock-only). */

export type VoiceAgentId = "vapi" | "retell";

export interface VoiceAgentSession {
  agentSessionId: string;
  provider: VoiceAgentId;
  startedAt: string;
}

export interface VoiceAgentProvider {
  readonly id: VoiceAgentId;
  startSession(input: {
    accountId: string;
    callSessionId: string;
  }): Promise<VoiceAgentSession>;
  endSession(session: VoiceAgentSession): Promise<{ endedAt: string }>;
}
