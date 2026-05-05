import { Call, MockCall } from "@/types/call";

const baseTime = new Date("2026-05-04T14:30:00.000Z").getTime();
const at = (offsetMinutes: number): string =>
  new Date(baseTime + offsetMinutes * 60_000).toISOString();

export const mockCalls: Call[] = [
  MockCall({
    id: "call_mock_1",
    organization_id: "org_mock_1",
    contact_id: "contact_mock_1",
    provider: "twilio",
    direction: "inbound",
    status: "missed",
    from_number: "+15555550199",
    to_number: "+15555550100",
    started_at: at(0),
    ended_at: at(0),
    duration_seconds: 0,
    sentiment: "neutral",
    spam_score: 0.04,
    lead_score: 65,
  }),
  MockCall({
    id: "call_mock_2",
    organization_id: "org_mock_1",
    contact_id: "contact_mock_2",
    provider: "retell",
    direction: "inbound",
    status: "answered",
    from_number: "+15555550288",
    to_number: "+15555550100",
    started_at: at(45),
    ended_at: at(48),
    duration_seconds: 178,
    transcript:
      "Caller asked for AC quote on a 1,800 sq ft single-family home. Wants service this week.",
    summary: "AC quote request, single-family, this week timeline.",
    sentiment: "positive",
    spam_score: 0.02,
    lead_score: 84,
  }),
  MockCall({
    id: "call_mock_3",
    organization_id: "org_mock_1",
    contact_id: undefined,
    provider: "twilio",
    direction: "inbound",
    status: "spam",
    from_number: "+18005550000",
    to_number: "+15555550100",
    started_at: at(90),
    ended_at: at(90),
    duration_seconds: 4,
    sentiment: "neutral",
    spam_score: 0.94,
    lead_score: 5,
  }),
  MockCall({
    id: "call_mock_4",
    organization_id: "org_mock_2",
    contact_id: "contact_mock_3",
    provider: "vapi",
    direction: "outbound",
    status: "completed",
    from_number: "+15555550200",
    to_number: "+15555550377",
    started_at: at(120),
    ended_at: at(123),
    duration_seconds: 145,
    transcript: "Outbound recovery call after missed inbound. Booked an estimate.",
    summary: "Recovery success: estimate booked.",
    sentiment: "positive",
    spam_score: 0,
    lead_score: 79,
  }),
];

export function getMockCalls(): Call[] {
  return mockCalls;
}
