import { Booking, MockBooking } from "@/types/booking";

// Fixed anchors mirror prisma/seed.ts so parity tests stay deterministic.
const BOOKING_1_START = "2026-05-08T15:00:00.000Z";
const BOOKING_1_END = "2026-05-08T16:30:00.000Z";
const BOOKING_2_START = "2026-05-09T17:00:00.000Z";
const BOOKING_2_END = "2026-05-09T18:00:00.000Z";

export const mockBookings: Booking[] = [
  MockBooking({
    id: "booking_mock_1",
    account_id: "org_mock_1",
    contact_id: "contact_mock_2",
    lead_event_id: "lead_mock_3",
    calendar_provider: "google",
    title: "AC repair estimate — Avery Klein",
    start_time: BOOKING_1_START,
    end_time: BOOKING_1_END,
    status: "confirmed",
    location: "1500 Bay St, St. Petersburg, FL 33701",
  }),
  MockBooking({
    id: "booking_mock_2",
    account_id: "org_mock_2",
    contact_id: "contact_mock_3",
    lead_event_id: "lead_mock_5",
    calendar_provider: "calcom",
    title: "Roof inspection — Sam Patel",
    start_time: BOOKING_2_START,
    end_time: BOOKING_2_END,
    status: "scheduled",
    location: "880 Gulf Blvd, Clearwater, FL 33755",
  }),
];

export function getMockBookings(): Booking[] {
  return mockBookings;
}
