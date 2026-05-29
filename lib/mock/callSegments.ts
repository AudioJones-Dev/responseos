import type { CallSegment } from "@/types/callSegment";

// Anchors mirror prisma/seed.ts BASE_TIME so parity tests stay deterministic.
// call_mock_2 is the seeded "answered" call (the only one with a transcript).
const SEG_1_START = "2026-05-04T15:15:00.000Z";
const SEG_1_END = "2026-05-04T15:15:08.000Z";
const SEG_2_START = "2026-05-04T15:15:08.000Z";
const SEG_2_END = "2026-05-04T15:15:18.000Z";

export const mockCallSegments: CallSegment[] = [
  {
    id: "seg_mock_1",
    account_id: "org_mock_1",
    call_id: "call_mock_2",
    sequence: 1,
    speaker: "caller",
    text: "Hi, I'm looking for an AC tune-up quote for my single-family home in Tampa.",
    confidence: 0.92,
    started_at: SEG_1_START,
    ended_at: SEG_1_END,
    created_at: SEG_1_END,
  },
  {
    id: "seg_mock_2",
    account_id: "org_mock_1",
    call_id: "call_mock_2",
    sequence: 2,
    speaker: "agent",
    text: "Happy to help. About what year was the unit installed, and what's the square footage?",
    confidence: 0.95,
    started_at: SEG_2_START,
    ended_at: SEG_2_END,
    created_at: SEG_2_END,
  },
];

export function getMockCallSegments(): CallSegment[] {
  return mockCallSegments;
}
