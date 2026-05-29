import { ISODate, UUID } from "./common";
import type { WorkflowProvider } from "./automation";

export type WorkflowRunStatus =
  | "started"
  | "completed"
  | "failed"
  | "cancelled"
  | "dead_letter";

export interface WorkflowRun {
  id: UUID;
  account_id: UUID;
  /** Provider-stable idempotency / dedupe spine per EVENT_SCHEMA §4. */
  workflow_run_id: string;
  /** Workflow definition label (e.g. `missed_call_recovery`). Not a FK. */
  workflow_id: string;
  provider: WorkflowProvider;
  /** Forward-compat hook for a future link into the events ledger. */
  trigger_event_id?: string;
  status: WorkflowRunStatus;
  started_at: ISODate;
  ended_at?: ISODate;
  error_message?: string;
  payload_json?: unknown;
  created_at: ISODate;
}
