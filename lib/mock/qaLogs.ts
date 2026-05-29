import type { QaLog } from "@/types/qaLog";

const REVIEWED_AT = "2026-05-04T16:00:00.000Z";

export const mockQaLogs: QaLog[] = [
  {
    id: "qa_mock_1",
    account_id: "org_mock_1",
    call_id: "call_mock_2",
    rubric_version: "v1",
    reviewer_type: "system",
    score: 84,
    findings_json: {
      greeting: "pass",
      qualification: "pass",
      next_step: "pass",
    },
    notes: "Caller qualified; estimate visit scheduled.",
    reviewed_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
  },
];

export function getMockQaLogs(): QaLog[] {
  return mockQaLogs;
}
