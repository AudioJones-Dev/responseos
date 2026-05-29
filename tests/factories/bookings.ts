import type { Prisma } from "@prisma/client";
import { nextTestId } from "./ids";

export function makeBooking(
  params: { accountId: string; leadId?: string | null; contactId?: string },
  overrides: Partial<Prisma.BookingCreateInput> = {},
): Prisma.BookingCreateInput {
  const base: Prisma.BookingCreateInput = {
    id: overrides.id ?? nextTestId("booking"),
    account_id: params.accountId,
    contact_id: params.contactId ?? "contact_mock_1",
    lead_event_id: params.leadId ?? null,
    calendar_provider: "google",
    external_event_id: "external_test_001",
    title: "Factory booking",
    start_time: new Date("2026-05-09T14:00:00.000Z"),
    end_time: new Date("2026-05-09T15:00:00.000Z"),
    status: "scheduled",
    location: "123 Test St",
    notes: "Factory booking note",
  };
  return { ...base, ...overrides };
}
