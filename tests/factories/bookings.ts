import type { Prisma } from "@prisma/client";

let bookingCounter = 0;

export function makeBooking(
  params: { organizationId: string; contactId: string; leadId?: string | null },
  overrides: Partial<Prisma.BookingCreateInput> = {},
): Prisma.BookingCreateInput {
  bookingCounter += 1;
  const suffix = bookingCounter.toString().padStart(3, "0");

  return {
    id: `booking_test_${suffix}`,
    organization_id: params.organizationId,
    contact_id: params.contactId,
    lead_event_id: params.leadId ?? null,
    calendar_provider: "google",
    external_event_id: `external_test_${suffix}`,
    title: `Test booking ${suffix}`,
    start_time: new Date("2026-05-10T15:00:00.000Z"),
    end_time: new Date("2026-05-10T16:00:00.000Z"),
    status: "scheduled",
    location: "Test Location",
    notes: "Factory booking",
    ...overrides,
  };
}
