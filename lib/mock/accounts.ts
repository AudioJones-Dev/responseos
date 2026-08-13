import { MockAccount, Account } from "@/types/account";

export const mockAccounts: Account[] = [
  MockAccount({
    id: "org_mock_1",
    name: "Sunshine HVAC",
    slug: "sunshine-hvac",
    industry: "home-services",
    website_url: "https://sunshine-hvac.example",
    primary_phone: "+15555550100",
    timezone: "America/New_York",
    status: "active",
    account_type: "customer",
  }),
  MockAccount({
    id: "org_mock_2",
    name: "Coastal Roofing Co.",
    slug: "coastal-roofing",
    industry: "home-services",
    website_url: "https://coastalroofing.example",
    primary_phone: "+15555550200",
    timezone: "America/New_York",
    status: "active",
    account_type: "customer",
  }),
  MockAccount({
    id: "acct_internal_demo_tyrone",
    name: "Tyrone Nelms",
    slug: "tyrone-nelms",
    industry: "professional-services",
    website_url: undefined,
    primary_phone: "+15555550400",
    timezone: "America/New_York",
    status: "active",
    account_type: "internal_demo",
  }),
  MockAccount({
    id: "acct_responseos_demo",
    name: "ResponseOS Demo",
    slug: "responseos-demo",
    industry: "demo",
    website_url: undefined,
    primary_phone: "+15555550500",
    timezone: "America/New_York",
    status: "active",
    account_type: "sandbox",
  }),
];

export function getMockAccounts(): Account[] {
  return mockAccounts;
}
