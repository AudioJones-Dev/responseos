import type { Prisma } from "@prisma/client";
import { nextTestId } from "./ids";

export function makeWorkflowRun(
  params: { accountId: string },
  overrides: Partial<Prisma.WorkflowRunCreateInput> = {},
): Prisma.WorkflowRunCreateInput {
  const id = overrides.id ?? nextTestId("wfr");
  const base: Prisma.WorkflowRunCreateInput = {
    id,
    account_id: params.accountId,
    workflow_run_id: `n8n_run_test_${id}`,
    workflow_id: "test_workflow",
    provider: "n8n",
    status: "started",
    started_at: new Date("2026-05-04T15:18:30.000Z"),
  };
  return { ...base, ...overrides };
}
