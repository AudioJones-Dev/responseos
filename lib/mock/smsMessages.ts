import type { SmsMessage } from "@/types/smsMessage";

// Fixed anchors mirror prisma/seed.ts so parity tests stay deterministic.
const SMS_1_AT = "2026-05-04T15:43:00.000Z";
const SMS_2_AT = "2026-05-04T15:45:00.000Z";
const SMS_3_AT = "2026-05-04T17:25:00.000Z";
const SMS_4_AT = "2026-05-04T17:30:00.000Z";

export const mockSmsMessages: SmsMessage[] = [
  {
    id: "sms_mock_1",
    account_id: "org_mock_1",
    conversation_id: "conv_mock_1",
    provider: "twilio",
    provider_message_id: "SM_mock_1",
    direction: "inbound",
    from_number: "+15555550199",
    to_number: "+15555550100",
    body: "Hi — looking for an AC tune-up quote this week.",
    status: "received",
    segment_count: 1,
    created_at: SMS_1_AT,
  },
  {
    id: "sms_mock_2",
    account_id: "org_mock_1",
    conversation_id: "conv_mock_1",
    provider: "twilio",
    provider_message_id: "SM_mock_2",
    direction: "outbound",
    from_number: "+15555550100",
    to_number: "+15555550199",
    body: "Thanks for reaching out. We can be on-site Thursday at 3pm.",
    status: "delivered",
    segment_count: 1,
    sent_at: SMS_2_AT,
    delivered_at: SMS_2_AT,
    created_at: SMS_2_AT,
  },
  {
    id: "sms_mock_3",
    account_id: "org_mock_2",
    conversation_id: "conv_mock_2",
    provider: "twilio",
    provider_message_id: "SM_mock_3",
    direction: "inbound",
    from_number: "+15555550377",
    to_number: "+15555550200",
    body: "Need a roof inspection — any availability this week?",
    status: "received",
    segment_count: 1,
    created_at: SMS_3_AT,
  },
  {
    id: "sms_mock_4",
    account_id: "org_mock_2",
    conversation_id: "conv_mock_2",
    provider: "twilio",
    provider_message_id: "SM_mock_4",
    direction: "outbound",
    from_number: "+15555550200",
    to_number: "+15555550377",
    body: "We can stop by Friday at 10am — confirming via email shortly.",
    status: "delivered",
    segment_count: 1,
    sent_at: SMS_4_AT,
    delivered_at: SMS_4_AT,
    created_at: SMS_4_AT,
  },
];

export function getMockSmsMessages(): SmsMessage[] {
  return mockSmsMessages;
}
