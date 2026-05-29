import { ISODate, UUID, newId, nowIso } from "./common";

export type CalendarProvider = "google" | "calcom" | "ghl" | "manual";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Appointment {
  id: UUID;
  account_id: UUID;
  contact_id: UUID;
  lead_event_id?: UUID;
  calendar_provider: CalendarProvider;
  external_event_id?: string;
  title: string;
  start_time: ISODate;
  end_time: ISODate;
  status: AppointmentStatus;
  location?: string;
  notes?: string;
  created_at: ISODate;
  updated_at: ISODate;
}

export function MockAppointment(overrides: Partial<Appointment> = {}): Appointment {
  const now = nowIso();
  const start = new Date(Date.now() + 86_400_000).toISOString();
  const end = new Date(Date.now() + 86_400_000 + 60 * 60_000).toISOString();
  return {
    id: newId(),
    account_id: "org_mock_1",
    contact_id: "contact_mock_1",
    lead_event_id: "lead_mock_1",
    calendar_provider: "manual",
    external_event_id: undefined,
    title: "On-site estimate",
    start_time: start,
    end_time: end,
    status: "scheduled",
    location: "123 Main St, Tampa, FL 33601",
    notes: undefined,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}
