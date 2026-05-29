import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import type {
  Automation,
  AutomationStatus,
  AutomationTriggerType,
  WorkflowProvider,
} from "@/types/automation";
import { err, errFromThrown, ok, type Result } from "./result";
import { withTenantScope } from "./session-helpers";

interface AutomationRow {
  id: string;
  account_id: string;
  name: string;
  trigger_type: string;
  status: string;
  workflow_provider: string;
  webhook_url: string | null;
  config_json: unknown;
  created_at: Date;
  updated_at: Date;
}

function rowToAutomation(row: AutomationRow): Automation {
  return {
    id: row.id,
    account_id: row.account_id,
    name: row.name,
    trigger_type: row.trigger_type as AutomationTriggerType,
    status: row.status as AutomationStatus,
    workflow_provider: row.workflow_provider as WorkflowProvider,
    webhook_url: row.webhook_url ?? undefined,
    config_json: (row.config_json ?? {}) as Automation["config_json"],
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listAutomations(params: {
  accountId?: string;
}): Promise<Result<Automation[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    // No mock fixture exists for automations; degrade to empty list.
    return ok([]);
  }

  try {
    const rows = await db.automation.findMany({
      where: scope.effectiveAccountId
        ? { account_id: scope.effectiveAccountId }
        : undefined,
      orderBy: { created_at: "desc" },
    });
    return ok(rows.map(rowToAutomation));
  } catch (e) {
    return errFromThrown<Automation[]>(e);
  }
}
