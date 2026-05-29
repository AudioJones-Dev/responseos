import type { ProviderConnection } from "@/types/providerConnection";

// Stable anchor matches prisma/seed.ts BASE_TIME so parity tests are deterministic.
const LAST_VERIFIED_AT = "2026-05-04T14:30:00.000Z";

export const mockProviderConnections: ProviderConnection[] = [
  {
    id: "pconn_mock_1",
    account_id: "org_mock_1",
    provider: "twilio",
    status: "connected",
    scopes: [],
    connected_by: "user_acme_owner_1",
    last_verified_at: LAST_VERIFIED_AT,
    created_at: LAST_VERIFIED_AT,
    updated_at: LAST_VERIFIED_AT,
  },
  {
    id: "pconn_mock_2",
    account_id: "org_mock_1",
    provider: "hubspot",
    status: "connected",
    scopes: [
      "crm.objects.contacts.read",
      "crm.objects.contacts.write",
      "crm.objects.deals.read",
      "crm.objects.deals.write",
    ],
    connected_by: "user_acme_owner_1",
    last_verified_at: LAST_VERIFIED_AT,
    created_at: LAST_VERIFIED_AT,
    updated_at: LAST_VERIFIED_AT,
  },
];

export function getMockProviderConnections(): ProviderConnection[] {
  return mockProviderConnections;
}
