import type { Prisma } from "@prisma/client";
import { nextTestId } from "./ids";

export function makeAppointment(
  params: { accountId: string; leadId?: string | null; contactId?: string },
  overrides: Partial<Prisma.AppointmentCreateInput> = {},
): Prisma.AppointmentCreateInput {
  const base: Prisma.AppointmentCreateInput = {
    id: overrides.id ?? nextTestId("booking"),
    account_id: params.accountId,
    contact_id: params.contactId ?? "contact_mock_1",
    lead_event_id: params.leadId ?? null,
    calendar_provider: "google",
    external_event_id: "external_test_001",
    title: "Factory appointment",
    start_time: new Date("2026-05-09T14:00:00.000Z"),
    end_time: new Date("2026-05-09T15:00:00.000Z"),
    status: "scheduled",
    location: "123 Test St",
    notes: "Factory appointment note",
  };
  return { ...base, ...overrides };
}
