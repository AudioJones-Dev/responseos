import type { CallSegment } from "@/types/callSegment";

// Anchors mirror prisma/seed.ts BASE_TIME so parity tests stay deterministic.
// call_mock_2 is the seeded "answered" call (the only one with a transcript).
const SEG_1_START = "2026-05-04T15:15:00.000Z";
const SEG_1_END = "2026-05-04T15:15:08.000Z";
const SEG_2_START = "2026-05-04T15:15:08.000Z";
const SEG_2_END = "2026-05-04T15:15:18.000Z";

// Internal demo tenant turns, offset from call_tyrone_1's start.
const DEMO_CALL_STARTED_MS = new Date("2026-08-03T14:15:00.000Z").getTime();
const demoSegmentAt = (offsetSeconds: number): string =>
  new Date(DEMO_CALL_STARTED_MS + offsetSeconds * 1_000).toISOString();

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
  {
    id: "seg_tyrone_1",
    account_id: "org_tyrone_1",
    call_id: "call_tyrone_1",
    sequence: 1,
    speaker: "caller",
    text: "Hi — I'm a recruiter at Northwind Systems. Can you tell me about Tyrone's business systems experience?",
    confidence: 0.94,
    started_at: demoSegmentAt(0),
    ended_at: demoSegmentAt(10),
    created_at: demoSegmentAt(10),
  },
  {
    id: "seg_tyrone_2",
    account_id: "org_tyrone_1",
    call_id: "call_tyrone_1",
    sequence: 2,
    speaker: "agent",
    text: "Business systems is on his verified skill list, and he is Operations & Marketing Consultant at Florida Ramp & Lift since July 2023 and founder and operations / business systems consultant at AJ Digital since April 2020.",
    confidence: 0.97,
    started_at: demoSegmentAt(12),
    ended_at: demoSegmentAt(22),
    created_at: demoSegmentAt(22),
  },
  {
    id: "seg_tyrone_3",
    account_id: "org_tyrone_1",
    call_id: "call_tyrone_1",
    sequence: 3,
    speaker: "caller",
    text: "Can you point me at a project he has built? What's his target compensation? And let's get a recruiter screen booked.",
    confidence: 0.95,
    started_at: demoSegmentAt(24),
    ended_at: demoSegmentAt(34),
    created_at: demoSegmentAt(34),
  },
  {
    id: "seg_tyrone_4",
    account_id: "org_tyrone_1",
    call_id: "call_tyrone_1",
    sequence: 4,
    speaker: "agent",
    text: "Florida Ramp & Lift FieldOps is an active engagement — a contractor portal covering jobs, safety steps, field evidence and approvals; it's on his site at tyronenelms.com/work. Compensation is Tyrone's to answer directly, so I've noted it for him. Your recruiter screen is booked for Aug 13 at 2:00pm ET.",
    confidence: 0.96,
    started_at: demoSegmentAt(36),
    ended_at: demoSegmentAt(46),
    created_at: demoSegmentAt(46),
  },
];

export function getMockCallSegments(): CallSegment[] {
  return mockCallSegments;
}
