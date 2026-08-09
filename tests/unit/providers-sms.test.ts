import { describe, expect, it } from "vitest"

import {
  getSmsProvider,
  MockSmsProvider,
  type SmsProvider,
} from "@/lib/providers/sms"

describe("SmsProvider mock", () => {
  it("resolves to mock when TWILIO_ACCOUNT_SID is absent", () => {
    delete process.env.TWILIO_ACCOUNT_SID
    const provider = getSmsProvider()
    expect(provider).toBeInstanceOf(MockSmsProvider)
    expect(provider.providerId).toBe("mock")
  })

  it("returns deterministic send and delivery fixtures", async () => {
    const run = async () => {
      const provider: SmsProvider = new MockSmsProvider()
      const message = await provider.send({
        accountId: "org-1",
        messageId: "msg-1",
        to: "+15550101",
        from: "+15550100",
        body: "Sorry we missed your call — reply YES to book a callback.",
      })
      const delivery = await provider.getDeliveryStatus(message)
      return { message, delivery }
    }

    const first = await run()
    const second = await run()

    expect(first).toEqual(second)
    expect(first.message).toMatchObject({
      providerMessageId: "mock-sms:org-1:msg-1",
      status: "sent",
      direction: "outbound",
      createdAt: "2026-01-01T00:00:00.000Z",
    })
    expect(first.delivery).toMatchObject({
      status: "delivered",
      updatedAt: "2026-01-01T00:00:02.000Z",
    })
  })
})
