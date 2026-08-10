import { Contact, MockContact } from "@/types/contact";

export const mockContacts: Contact[] = [
  MockContact({
    id: "contact_mock_1",
    account_id: "org_mock_1",
    first_name: "Jordan",
    last_name: "Reyes",
    phone: "+15555550199",
    email: "jordan.reyes@example.com",
    city: "Tampa",
    state: "FL",
    zip: "33601",
    source: "call",
  }),
  MockContact({
    id: "contact_mock_2",
    account_id: "org_mock_1",
    first_name: "Avery",
    last_name: "Klein",
    phone: "+15555550288",
    email: "avery.klein@example.com",
    city: "St. Petersburg",
    state: "FL",
    zip: "33701",
    source: "form",
  }),
  MockContact({
    id: "contact_mock_3",
    account_id: "org_mock_2",
    first_name: "Sam",
    last_name: "Patel",
    phone: "+15555550377",
    email: "sam.patel@example.com",
    city: "Clearwater",
    state: "FL",
    zip: "33755",
    source: "sms",
  }),
  MockContact({
    id: "contact_tyrone_demo_recruiter",
    account_id: "acct_internal_demo_tyrone",
    first_name: "Jane",
    last_name: "Smith",
    phone: "+15555550499",
    email: "jane.smith@example.com",
    address: undefined,
    city: undefined,
    state: undefined,
    zip: undefined,
    source: "manual",
  }),
];

export function getMockContacts(): Contact[] {
  return mockContacts;
}
