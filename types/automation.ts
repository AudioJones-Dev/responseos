import { ISODate, Json, UUID, newId, nowIso } from "./common";

export type AutomationTriggerType =
  | "missed_call"
  | "after_hours_call"
  | "new_lead"
  | "quote_requested"
  | "booking_created"
  | "no_response"
  | "job_completed";

export type AutomationStatus = "active" | "paused" | "draft";

export type WorkflowProvider = "n8n" | "make" | "internal";

export interface Automation {
  id: UUID;
  organization_id: UUID;
  name: string;
  trigger_type: AutomationTriggerType;
  status: AutomationStatus;
  workflow_provider: WorkflowProvider;
  webhook_url?: string;
  config_json: Json;
  created_at: ISODate;
  updated_at: ISODate;
}

export function MockAutomation(overrides: Partial<Automation> = {}): Automation {
  const now = nowIso();
  return {
    id: newId(),
    organization_id: "org_mock_1",
    name: "Missed Call Recovery",
    trigger_type: "missed_call",
    status: "active",
    workflow_provider: "n8n",
    webhook_url: undefined,
    config_json: { delay_seconds: 30, sms_template: "default" },
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}
