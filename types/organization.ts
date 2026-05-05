import { ISODate, UUID, newId, nowIso } from "./common";

export type OrganizationStatus = "lead" | "active" | "paused" | "cancelled";

export interface Organization {
  id: UUID;
  name: string;
  slug: string;
  industry: string;
  website_url?: string;
  primary_phone?: string;
  timezone: string;
  status: OrganizationStatus;
  created_at: ISODate;
  updated_at: ISODate;
}

export function MockOrganization(overrides: Partial<Organization> = {}): Organization {
  const now = nowIso();
  return {
    id: newId(),
    name: "Acme Home Services",
    slug: "acme-home-services",
    industry: "home-services",
    website_url: "https://example.com",
    primary_phone: "+15555550100",
    timezone: "America/New_York",
    status: "active",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}
