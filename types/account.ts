import { ISODate, UUID, newId, nowIso } from "./common";

export type AccountStatus = "lead" | "active" | "paused" | "cancelled";

export interface Account {
  id: UUID;
  name: string;
  slug: string;
  industry: string;
  website_url?: string;
  primary_phone?: string;
  timezone: string;
  status: AccountStatus;
  created_at: ISODate;
  updated_at: ISODate;
}

export function MockAccount(overrides: Partial<Account> = {}): Account {
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
