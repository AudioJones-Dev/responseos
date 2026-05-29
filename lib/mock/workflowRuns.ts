import type { WorkflowRun } from "@/types/workflowRun";

// Stable anchors mirror prisma/seed.ts so parity tests stay deterministic.
const RUN_1_STARTED = "2026-05-04T15:18:30.000Z";
const RUN_1_ENDED = "2026-05-04T15:18:33.000Z";
const RUN_2_STARTED = "2026-05-04T17:30:00.000Z";
const RUN_2_ENDED = "2026-05-04T17:30:04.000Z";

export const mockWorkflowRuns: WorkflowRun[] = [
  {
    id: "wfr_mock_1",
    account_id: "org_mock_1",
    workflow_run_id: "n8n_run_mock_1",
    workflow_id: "missed_call_recovery",
    provider: "n8n",
    trigger_event_id: "call_mock_1",
    status: "completed",
    started_at: RUN_1_STARTED,
    ended_at: RUN_1_ENDED,
    created_at: RUN_1_STARTED,
  },
  {
    id: "wfr_mock_2",
    account_id: "org_mock_2",
    workflow_run_id: "n8n_run_mock_2",
    workflow_id: "new_lead_followup",
    provider: "n8n",
    trigger_event_id: "lead_mock_5",
    status: "failed",
    started_at: RUN_2_STARTED,
    ended_at: RUN_2_ENDED,
    error_message: "vendor_unavailable",
    created_at: RUN_2_STARTED,
  },
];

export function getMockWorkflowRuns(): WorkflowRun[] {
  return mockWorkflowRuns;
}
