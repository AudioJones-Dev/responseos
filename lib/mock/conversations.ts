import type { Conversation } from "@/types/conversation";

// Fixed anchors mirror prisma/seed.ts so parity tests stay deterministic.
const CONV_1_LAST = "2026-05-04T15:45:00.000Z";
const CONV_2_LAST = "2026-05-04T17:30:00.000Z";

export const mockConversations: Conversation[] = [
  {
    id: "conv_mock_1",
    account_id: "org_mock_1",
    contact_id: "contact_mock_1",
    business_number: "+15555550100",
    peer_number: "+15555550199",
    status: "open",
    last_message_at: CONV_1_LAST,
    created_at: CONV_1_LAST,
    updated_at: CONV_1_LAST,
  },
  {
    id: "conv_mock_2",
    account_id: "org_mock_2",
    contact_id: "contact_mock_3",
    business_number: "+15555550200",
    peer_number: "+15555550377",
    status: "open",
    last_message_at: CONV_2_LAST,
    created_at: CONV_2_LAST,
    updated_at: CONV_2_LAST,
  },
];

export function getMockConversations(): Conversation[] {
  return mockConversations;
}
