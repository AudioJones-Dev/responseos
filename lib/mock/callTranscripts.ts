import type { CallTranscript } from "@/types/callTranscript";
import { DEMO_CALL_ENDED, DEMO_CALL_SUMMARY_TEXT } from "@/lib/mock/calls";

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
  {
    id: "xcr_tyrone_1",
    account_id: "org_tyrone_1",
    call_id: "call_tyrone_1",
    inline_text: DEMO_CALL_SUMMARY_TEXT,
    language: "en",
    retention_lane: "full",
    created_at: DEMO_CALL_ENDED,
  },
];

export function getMockCallTranscripts(): CallTranscript[] {
  return mockCallTranscripts;
}
