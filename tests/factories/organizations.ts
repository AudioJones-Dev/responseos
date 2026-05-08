import type { Prisma } from "@prisma/client";

let organizationCounter = 0;

export function makeOrganization(
  overrides: Partial<Prisma.OrganizationCreateInput> = {},
): Prisma.OrganizationCreateInput {
  organizationCounter += 1;
  const suffix = organizationCounter.toString().padStart(3, "0");

  return {
    id: `org_test_${suffix}`,
    name: `Test Organization ${suffix}`,
    slug: `test-organization-${suffix}`,
    industry: "home-services",
    website_url: `https://org-test-${suffix}.example`,
    primary_phone: `+1555100${suffix}`,
    timezone: "America/New_York",
    status: "active",
    ...overrides,
  };
}
