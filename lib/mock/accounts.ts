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
  }),
];

export function getMockAccounts(): Account[] {
  return mockAccounts;
}
