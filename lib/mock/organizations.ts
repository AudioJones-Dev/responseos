import { MockOrganization, Organization } from "@/types/organization";

export const mockOrganizations: Organization[] = [
  MockOrganization({
    id: "org_mock_1",
    name: "Sunshine HVAC",
    slug: "sunshine-hvac",
    industry: "home-services",
    website_url: "https://sunshine-hvac.example",
    primary_phone: "+15555550100",
    timezone: "America/New_York",
    status: "active",
  }),
  MockOrganization({
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

export function getMockOrganizations(): Organization[] {
  return mockOrganizations;
}
