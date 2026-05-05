import { ISODate, UUID, newId, nowIso } from "./common";

export type ContactSource = "call" | "sms" | "form" | "manual" | "crm_sync";

export interface Contact {
  id: UUID;
  organization_id: UUID;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  source: ContactSource;
  created_at: ISODate;
  updated_at: ISODate;
}

export function MockContact(overrides: Partial<Contact> = {}): Contact {
  const now = nowIso();
  return {
    id: newId(),
    organization_id: "org_mock_1",
    first_name: "Pat",
    last_name: "Customer",
    phone: "+15555550199",
    email: "pat@example.com",
    address: "123 Main St",
    city: "Tampa",
    state: "FL",
    zip: "33601",
    source: "call",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}
