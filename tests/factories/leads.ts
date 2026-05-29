import type { Prisma } from "@prisma/client";
import { nextTestId } from "./ids";

export function makeLead(
  params: { accountId: string },
  overrides: Partial<Prisma.LeadEventCreateInput> = {},
): Prisma.LeadEventCreateInput {
  const base: Prisma.LeadEventCreateInput = {
    id: overrides.id ?? nextTestId("lead"),
    account_id: params.accountId,
    source: "phone",
    event_type: "qualified_lead",
    status: "qualified",
    urgency: "high",
    estimated_value: 120_000,
    recovered_value: null,
    notes: "Factory lead",
  };
  return { ...base, ...overrides };
}
