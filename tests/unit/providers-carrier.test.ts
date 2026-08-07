import { describe, expect, it } from "vitest"

import {
  getCarrierProvider,
  MockCarrierProvider,
  type CarrierProvider,
} from "@/lib/providers/carrier"

describe("CarrierProvider mock", () => {
  it("resolves to mock when TELNYX_API_KEY is absent", () => {
    delete process.env.TELNYX_API_KEY
    const provider = getCarrierProvider()
    expect(provider).toBeInstanceOf(MockCarrierProvider)
    expect(provider.providerId).toBe("mock")
  })

  it("returns deterministic outbound call fixtures", async () => {
    const run = async () => {
      const provider: CarrierProvider = new MockCarrierProvider()
      const call = await provider.placeOutboundCall({
        accountId: "org-1",
        callId: "call-1",
        to: "+15550101",
        from: "+15550100",
      })
      const status = await provider.getCallStatus(call)
      const result = await provider.hangupCall(call)
      return { call, status, result }
    }

    const first = await run()
    const second = await run()

    expect(first).toEqual(second)
    expect(first.call).toMatchObject({
      providerCallId: "mock-call:org-1:call-1",
      status: "in_progress",
      startedAt: "2026-01-01T00:00:00.000Z",
    })
    expect(first.status).toBe("in_progress")
    expect(first.result).toMatchObject({
      status: "completed",
      durationSeconds: 45,
      endedAt: "2026-01-01T00:00:45.000Z",
    })
  })
})
