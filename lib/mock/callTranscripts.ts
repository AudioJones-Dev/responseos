import type { CallTranscript } from "@/types/callTranscript";

// Anchored to call_mock_2's ended_at + a small normalizer delay.
const CREATED_AT = "2026-05-04T15:18:30.000Z";

export const mockCallTranscripts: CallTranscript[] = [
  {
    id: "xcr_mock_1",
    account_id: "org_mock_1",
    call_id: "call_mock_2",
    inline_text:
      "Caller asked for AC quote on a 1,800 sq ft single-family home. Wants service this week.",
    language: "en",
    retention_lane: "full",
    created_at: CREATED_AT,
  },
];

export function getMockCallTranscripts(): CallTranscript[] {
  return mockCallTranscripts;
}
