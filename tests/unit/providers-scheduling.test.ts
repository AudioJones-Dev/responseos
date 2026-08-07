import { describe, expect, it } from "vitest"

import {
  getSchedulingProvider,
  MockSchedulingProvider,
  type SchedulingProvider,
} from "@/lib/providers/scheduling"

describe("SchedulingProvider mock", () => {
  it("resolves to mock when CALENDLY_API_KEY is absent", () => {
    delete process.env.CALENDLY_API_KEY
    const provider = getSchedulingProvider()
    expect(provider).toBeInstanceOf(MockSchedulingProvider)
    expect(provider.providerId).toBe("mock")
  })

  it("returns deterministic slot and booking fixtures", async () => {
    const run = async () => {
      const provider: SchedulingProvider = new MockSchedulingProvider()
      const slots = await provider.listAvailableSlots({
        accountId: "org-1",
        eventTypeId: "evt-callback",
        startsAfter: "2026-01-02T00:00:00.000Z",
        startsBefore: "2026-01-03T00:00:00.000Z",
      })
      const booking = await provider.bookSlot({
        accountId: "org-1",
        eventTypeId: "evt-callback",
        slotId: slots[0]!.slotId,
        inviteeEmail: "lead@example.com",
        inviteeName: "Alex Lee",
        bookingId: "booking-1",
      })
      const canceled = await provider.cancelBooking(booking)
      return { slots, booking, canceled }
    }

    const first = await run()
    const second = await run()

    expect(first).toEqual(second)
    expect(first.slots).toEqual([
      {
        slotId: "slot-1",
        eventTypeId: "evt-callback",
        startsAt: "2026-01-02T15:00:00.000Z",
        endsAt: "2026-01-02T15:30:00.000Z",
      },
    ])
    expect(first.booking).toMatchObject({
      providerBookingId: "mock-booking:org-1:booking-1",
      status: "confirmed",
      createdAt: "2026-01-01T00:00:00.000Z",
    })
    expect(first.canceled.status).toBe("canceled")
  })
})
