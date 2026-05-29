import type { Prisma } from "@prisma/client";
import { nextTestId } from "./ids";

export function makeAccount(
  overrides: Partial<Prisma.AccountCreateInput> = {},
): Prisma.AccountCreateInput {
  const id = overrides.id ?? nextTestId("org");
  const base: Prisma.AccountCreateInput = {
    id,
    name: `Test Account ${id}`,
    slug: `test-account-${id}`,
    industry: "home-services",
    website_url: `https://${id}.example`,
    primary_phone: "+15555559999",
    timezone: "America/New_York",
    status: "active",
  };
  return { ...base, ...overrides };
}
