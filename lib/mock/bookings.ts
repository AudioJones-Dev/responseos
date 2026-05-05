import { Booking, MockBooking } from "@/types/booking";

const day = (offset: number): string =>
  new Date(Date.now() + offset * 86_400_000).toISOString();

export const mockBookings: Booking[] = [
  MockBooking({
    id: "booking_mock_1",
    organization_id: "org_mock_1",
    contact_id: "contact_mock_2",
    lead_event_id: "lead_mock_3",
    calendar_provider: "google",
    title: "AC repair estimate — Avery Klein",
    start_time: day(1),
    end_time: new Date(Date.now() + 86_400_000 + 90 * 60_000).toISOString(),
    status: "confirmed",
    location: "1500 Bay St, St. Petersburg, FL 33701",
  }),
  MockBooking({
    id: "booking_mock_2",
    organization_id: "org_mock_2",
    contact_id: "contact_mock_3",
    lead_event_id: "lead_mock_5",
    calendar_provider: "calcom",
    title: "Roof inspection — Sam Patel",
    start_time: day(2),
    end_time: new Date(Date.now() + 2 * 86_400_000 + 60 * 60_000).toISOString(),
    status: "scheduled",
    location: "880 Gulf Blvd, Clearwater, FL 33755",
  }),
];

export function getMockBookings(): Booking[] {
  return mockBookings;
}
