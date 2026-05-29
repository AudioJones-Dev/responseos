import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockWorkflowRuns } from "@/lib/mock/workflowRuns";
import type { WorkflowProvider } from "@/types/automation";
import type { WorkflowRun, WorkflowRunStatus } from "@/types/workflowRun";
import { err, errFromThrown, ok, type Result } from "./result";
import { isCrossTenantRole, withTenantScope } from "./session-helpers";

interface WorkflowRunRow {
  id: string;
  account_id: string;
  workflow_run_id: string;
  workflow_id: string;
  provider: string;
  trigger_event_id: string | null;
  status: string;
  started_at: Date;
  ended_at: Date | null;
  error_message: string | null;
  payload_json: unknown;
  created_at: Date;
}

function rowToWorkflowRun(row: WorkflowRunRow): WorkflowRun {
  return {
    id: row.id,
    account_id: row.account_id,
    workflow_run_id: row.workflow_run_id,
    workflow_id: row.workflow_id,
    provider: row.provider as WorkflowProvider,
    trigger_event_id: row.trigger_event_id ?? undefined,
    status: row.status as WorkflowRunStatus,
    started_at: row.started_at.toISOString(),
    ended_at: row.ended_at?.toISOString(),
    error_message: row.error_message ?? undefined,
    payload_json: row.payload_json ?? undefined,
    created_at: row.created_at.toISOString(),
  };
}

export async function listWorkflowRuns(params: {
  accountId?: string;
  status?: WorkflowRunStatus;
  workflowId?: string;
}): Promise<Result<WorkflowRun[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const all = getMockWorkflowRuns();
    let filtered = all;
    if (scope.effectiveAccountId) {
      filtered = filtered.filter((r) => r.account_id === scope.effectiveAccountId);
    }
    if (params.status) filtered = filtered.filter((r) => r.status === params.status);
    if (params.workflowId) {
      filtered = filtered.filter((r) => r.workflow_id === params.workflowId);
    }
    return ok(filtered);
  }

  try {
    const rows = await db.workflowRun.findMany({
      where: {
        ...(scope.effectiveAccountId
          ? { account_id: scope.effectiveAccountId }
          : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.workflowId ? { workflow_id: params.workflowId } : {}),
      },
      orderBy: { started_at: "desc" },
    });
    return ok(rows.map(rowToWorkflowRun));
  } catch (e) {
    return errFromThrown<WorkflowRun[]>(e);
  }
}

export async function getWorkflowRunByRunId(
  workflowRunId: string,
): Promise<Result<WorkflowRun | null>> {
  const scope = await withTenantScope(undefined);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const found = getMockWorkflowRuns().find((r) => r.workflow_run_id === workflowRunId);
    if (!found) return ok(null);
    if (
      !isCrossTenantRole(scope.session) &&
      found.account_id !== scope.effectiveAccountId
    ) {
      return err(
        "tenant_scope_denied",
        "Caller is not in the resource's tenant scope.",
      );
    }
    return ok(found);
  }

  try {
    const row = await db.workflowRun.findUnique({
      where: { workflow_run_id: workflowRunId },
    });
    if (!row) return ok(null);
    if (
      !isCrossTenantRole(scope.session) &&
      row.account_id !== scope.effectiveAccountId
    ) {
      return err(
        "tenant_scope_denied",
        "Caller is not in the resource's tenant scope.",
      );
    }
    return ok(rowToWorkflowRun(row));
  } catch (e) {
    return errFromThrown<WorkflowRun | null>(e);
  }
}

/**
 * Substrate writer for a workflow run. Idempotent on `workflow_run_id` —
 * a replay of the same provider-supplied id is a no-op and returns the
 * existing row, satisfying ADR-0009's replay-safety rule and the
 * EVENT_SCHEMA §4 dedupe contract.
 *
 * This is pure execution-state storage. It does NOT orchestrate the
 * workflow, schedule retries, or call n8n. The actual async writer
 * (the n8n callback handler) wires up in v0.3.
 */
export async function recordWorkflowRun(entry: {
  account_id: string;
  workflow_run_id: string;
  workflow_id: string;
  provider: WorkflowProvider;
  trigger_event_id?: string | null;
  status?: WorkflowRunStatus;
  started_at: Date;
  ended_at?: Date | null;
  error_message?: string | null;
  payload_json?: unknown;
}): Promise<Result<WorkflowRun>> {
  if (db === null) {
    return err(
      "not_available",
      "recordWorkflowRun requires a database connection.",
    );
  }

  try {
    const row = await db.workflowRun.upsert({
      where: { workflow_run_id: entry.workflow_run_id },
      update: { workflow_run_id: entry.workflow_run_id },
      create: {
        account_id: entry.account_id,
        workflow_run_id: entry.workflow_run_id,
        workflow_id: entry.workflow_id,
        provider: entry.provider,
        trigger_event_id: entry.trigger_event_id ?? null,
        status: entry.status ?? "started",
        started_at: entry.started_at,
        ended_at: entry.ended_at ?? null,
        error_message: entry.error_message ?? null,
        payload_json: (entry.payload_json ?? null) as never,
      },
    });
    return ok(rowToWorkflowRun(row));
  } catch (e) {
    return errFromThrown<WorkflowRun>(e);
  }
}

/**
 * Transition an existing run to a terminal state (`completed`, `failed`,
 * `cancelled`, or `dead_letter`). No-op when the run is already
 * terminal — substrate is monotonic on terminal transitions, matching
 * EVENT_SCHEMA §6's idempotency contract for async completion events.
 *
 * Throws no events, kicks no retries — pure state storage.
 */
export async function finalizeWorkflowRun(entry: {
  workflow_run_id: string;
  status: Exclude<WorkflowRunStatus, "started">;
  ended_at: Date;
  error_message?: string | null;
}): Promise<Result<WorkflowRun>> {
  if (db === null) {
    return err(
      "not_available",
      "finalizeWorkflowRun requires a database connection.",
    );
  }

  try {
    await db.workflowRun.updateMany({
      where: {
        workflow_run_id: entry.workflow_run_id,
        status: "started",
      },
      data: {
        status: entry.status,
        ended_at: entry.ended_at,
        error_message: entry.error_message ?? null,
      },
    });

    const row = await db.workflowRun.findUnique({
      where: { workflow_run_id: entry.workflow_run_id },
    });
    if (!row) {
      return err(
        "not_found",
        `WorkflowRun ${entry.workflow_run_id} not found.`,
      );
    }
    return ok(rowToWorkflowRun(row));
  } catch (e) {
    return errFromThrown<WorkflowRun>(e);
  }
}
