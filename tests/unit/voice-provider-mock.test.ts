import { describe, expect, it } from "vitest"

import {
  MockVoiceProvider,
  type PartialTranscript,
  type Turn,
  type VoiceProvider,
} from "@/lib/providers/voice"

describe("MockVoiceProvider", () => {
  it("implements VoiceProvider and produces deterministic fixtures", async () => {
    const run = async () => {
      const provider: VoiceProvider = new MockVoiceProvider()
      const partials: PartialTranscript[] = []
      const turns: Turn[] = []

      provider.onPartialTranscript((partial) => {
        partials.push(partial)
      })

      provider.onTurnComplete((turn) => {
        turns.push(turn)
      })

      provider.onToolCall(async (call) => ({
        output: `${call.name}:${call.arguments.requestedWindow}`,
      }))

      const session = await provider.startSession({
        organizationId: "org-1",
        sessionId: "session-1",
      })

      provider.streamAudio(session, { sequence: 1, payload: "frame-1" })
      const summary = await provider.endSession(session)

      return { session, partials, turns, summary }
    }

    const first = await run()
    const second = await run()

    expect(first).toEqual(second)
    expect(first.partials).toEqual([
      { sequence: 1, text: "hello", isFinal: false },
      { sequence: 2, text: "hello i need help", isFinal: true },
    ])
    expect(first.turns).toEqual([
      { turnId: "turn-1", speaker: "caller", text: "hello i need help" },
      { turnId: "turn-2", speaker: "agent", text: "i can help with that" },
    ])
    expect(first.summary).toMatchObject({
      turnCount: 2,
      partialCount: 2,
      summaryText: "caller requested help and agent acknowledged",
      eventType: "voice.session_ended",
    })
  })
})
