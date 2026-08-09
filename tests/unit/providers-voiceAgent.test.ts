import { describe, expect, it } from "vitest"

import {
  getVoiceAgentProvider,
  MockVoiceAgentProvider,
  type VoiceAgentProvider,
} from "@/lib/providers/voiceAgent"

describe("VoiceAgentProvider mock", () => {
  it("resolves to mock when VAPI_API_KEY is absent", () => {
    delete process.env.VAPI_API_KEY
    const provider = getVoiceAgentProvider()
    expect(provider).toBeInstanceOf(MockVoiceAgentProvider)
    expect(provider.providerId).toBe("mock")
  })

  it("returns deterministic session summary fixtures", async () => {
    const run = async () => {
      const provider: VoiceAgentProvider = new MockVoiceAgentProvider()
      const session = await provider.startSession({
        accountId: "org-1",
        sessionId: "session-1",
        callId: "call-1",
      })
      await provider.appendTurn(session, {
        turnId: "turn-1",
        speaker: "caller",
        text: "i missed a call about a quote",
      })
      const summary = await provider.endSession(session)
      return { session, summary }
    }

    const first = await run()
    const second = await run()

    expect(first).toEqual(second)
    expect(first.session).toMatchObject({
      providerSessionId: "mock-agent:org-1:session-1",
      startedAt: "2026-01-01T00:00:00.000Z",
    })
    expect(first.summary).toMatchObject({
      intent: "schedule_callback",
      qualificationStatus: "qualified",
      transcript:
        "caller: i missed a call about a quote\nagent: i can help schedule a callback",
      endedAt: "2026-01-01T00:00:30.000Z",
    })
  })
})
