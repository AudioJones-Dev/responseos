import type {
  VoiceAgentProvider,
  VoiceAgentSession,
} from "@/lib/providers/voiceAgent/types";

const FIXED_STARTED = "2026-01-01T00:00:00.000Z";
const FIXED_ENDED = "2026-01-01T00:00:05.000Z";

export class MockVoiceAgentProvider implements VoiceAgentProvider {
  readonly id = "vapi" as const;

  async startSession(input: {
    accountId: string;
    callSessionId: string;
  }): Promise<VoiceAgentSession> {
    return {
      agentSessionId: `${input.accountId}:${input.callSessionId}`,
      provider: "vapi",
      startedAt: FIXED_STARTED,
    };
  }

  async endSession(
    session: VoiceAgentSession,
  ): Promise<{ endedAt: string }> {
    void session;
    return { endedAt: FIXED_ENDED };
  }
}
