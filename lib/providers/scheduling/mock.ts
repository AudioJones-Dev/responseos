import type {
  SchedulingBooking,
  SchedulingBookingRequest,
  SchedulingProvider,
  SchedulingSlot,
  SchedulingSlotQuery,
} from "@/lib/providers/scheduling/types"

const FIXED_SLOT_START = "2026-01-02T15:00:00.000Z"
const FIXED_SLOT_END = "2026-01-02T15:30:00.000Z"
const FIXED_CREATED_AT = "2026-01-01T00:00:00.000Z"

const FIXED_SLOTS: SchedulingSlot[] = [
  {
    slotId: "slot-1",
    eventTypeId: "evt-callback",
    startsAt: FIXED_SLOT_START,
    endsAt: FIXED_SLOT_END,
  },
]

export class MockSchedulingProvider implements SchedulingProvider {
  readonly providerId = "mock" as const

  async listAvailableSlots(query: SchedulingSlotQuery): Promise<SchedulingSlot[]> {
    void query
    return FIXED_SLOTS.map((slot) => ({ ...slot, eventTypeId: query.eventTypeId }))
  }

  async bookSlot(request: SchedulingBookingRequest): Promise<SchedulingBooking> {
    return {
      providerBookingId: `mock-booking:${request.accountId}:${request.bookingId}`,
      accountId: request.accountId,
      bookingId: request.bookingId,
      eventTypeId: request.eventTypeId,
      startsAt: FIXED_SLOT_START,
      endsAt: FIXED_SLOT_END,
      inviteeEmail: request.inviteeEmail,
      inviteeName: request.inviteeName,
      status: "confirmed",
      createdAt: FIXED_CREATED_AT,
    }
  }

  async cancelBooking(booking: SchedulingBooking): Promise<SchedulingBooking> {
    return {
      ...booking,
      status: "canceled",
    }
  }
}
