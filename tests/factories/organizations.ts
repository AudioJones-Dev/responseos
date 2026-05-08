import type { Prisma } from "@prisma/client";
import { nextTestId } from "./ids";

export function makeOrganization(
  overrides: Partial<Prisma.OrganizationCreateInput> = {},
): Prisma.OrganizationCreateInput {
  const id = overrides.id ?? nextTestId("org");
  const base: Prisma.OrganizationCreateInput = {
    id,
    name: `Test Organization ${id}`,
    slug: `test-organization-${id}`,
    industry: "home-services",
    website_url: `https://${id}.example`,
    primary_phone: "+15555559999",
    timezone: "America/New_York",
    status: "active",
  };
  return { ...base, ...overrides };
}
