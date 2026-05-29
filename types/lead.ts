import { Cents, ISODate, UUID, newId, nowIso } from "./common";

export type LeadEventSource =
  | "phone"
  | "sms"
  | "website"
  | "manual"
  | "outbound";

export type LeadEventType =
  | "missed_call"
  | "answered_call"
  | "quote_request"
  | "booking_request"
  | "qualified_lead"
  | "spam"
  | "follow_up_needed"
  | "appointment_booked"
  | "quote_sent"
  | "job_won"
  | "job_lost";

export type LeadEventStatus =
  | "new"
  | "qualified"
  | "unqualified"
  | "booked"
  | "quoted"
  | "won"
  | "lost"
  | "archived";

export type LeadUrgency = "low" | "medium" | "high";

export interface LeadEvent {
  id: UUID;
  account_id: UUID;
  contact_id?: UUID;
  call_id?: UUID;
  source: LeadEventSource;
  event_type: LeadEventType;
  status: LeadEventStatus;
  urgency: LeadUrgency;
  estimated_value?: Cents;
  recovered_value?: Cents;
  notes?: string;
  created_at: ISODate;
  updated_at: ISODate;
}

export function MockLeadEvent(overrides: Partial<LeadEvent> = {}): LeadEvent {
  const now = nowIso();
  return {
    id: newId(),
    account_id: "org_mock_1",
    contact_id: "contact_mock_1",
    call_id: undefined,
    source: "phone",
    event_type: "missed_call",
    status: "new",
    urgency: "medium",
    estimated_value: 75_000,
    recovered_value: undefined,
    notes: undefined,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}
