export type SchedulingProviderId = "mock" | "calendly"

export interface SchedulingSlotQuery {
  accountId: string
  eventTypeId: string
  startsAfter: string
  startsBefore: string
}

export interface SchedulingSlot {
  slotId: string
  eventTypeId: string
  startsAt: string
  endsAt: string
}

export interface SchedulingBookingRequest {
  accountId: string
  eventTypeId: string
  slotId: string
  inviteeEmail: string
  inviteeName: string
  bookingId: string
}

export interface SchedulingBooking {
  providerBookingId: string
  accountId: string
  bookingId: string
  eventTypeId: string
  startsAt: string
  endsAt: string
  inviteeEmail: string
  inviteeName: string
  status: "confirmed" | "canceled"
  createdAt: string
}

export interface SchedulingProvider {
  readonly providerId: SchedulingProviderId
  listAvailableSlots(query: SchedulingSlotQuery): Promise<SchedulingSlot[]>
  bookSlot(request: SchedulingBookingRequest): Promise<SchedulingBooking>
  cancelBooking(booking: SchedulingBooking): Promise<SchedulingBooking>
}
