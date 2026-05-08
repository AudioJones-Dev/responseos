import type { Prisma } from "@prisma/client";

let contactCounter = 0;
let leadCounter = 0;

export function makeContact(
  params: { organizationId: string },
  overrides: Partial<Prisma.ContactCreateInput> = {},
): Prisma.ContactCreateInput {
  contactCounter += 1;
  const suffix = contactCounter.toString().padStart(3, "0");

  return {
    id: `contact_test_${suffix}`,
    organization_id: params.organizationId,
    first_name: "Test",
    last_name: `Contact ${suffix}`,
    phone: `+1555300${suffix}`,
    email: `contact-test-${suffix}@example.com`,
    source: "manual",
    ...overrides,
  };
}

export function makeLead(
  params: { organizationId: string; contactId?: string },
  overrides: Partial<Prisma.LeadEventCreateInput> = {},
): Prisma.LeadEventCreateInput {
  leadCounter += 1;
  const suffix = leadCounter.toString().padStart(3, "0");

  return {
    id: `lead_test_${suffix}`,
    organization_id: params.organizationId,
    contact_id: params.contactId,
    source: "manual",
    event_type: "qualified_lead",
    status: "qualified",
    urgency: "medium",
    estimated_value: 100_000,
    notes: "Factory lead",
    ...overrides,
  };
}
