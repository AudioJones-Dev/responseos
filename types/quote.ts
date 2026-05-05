import { Cents, ISODate, UUID, newId, nowIso } from "./common";

export type QuoteStatus =
  | "requested"
  | "reviewing"
  | "sent"
  | "accepted"
  | "declined";

export interface QuoteRequest {
  id: UUID;
  organization_id: UUID;
  contact_id: UUID;
  lead_event_id?: UUID;
  service_type: string;
  description?: string;
  photos?: string[];
  property_address?: string;
  estimated_value?: Cents;
  status: QuoteStatus;
  created_at: ISODate;
  updated_at: ISODate;
}

export function MockQuoteRequest(
  overrides: Partial<QuoteRequest> = {},
): QuoteRequest {
  const now = nowIso();
  return {
    id: newId(),
    organization_id: "org_mock_1",
    contact_id: "contact_mock_1",
    lead_event_id: "lead_mock_1",
    service_type: "Roof inspection",
    description: "Recent storm damage on north slope.",
    photos: [],
    property_address: "123 Main St, Tampa, FL 33601",
    estimated_value: 125_000,
    status: "requested",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}
