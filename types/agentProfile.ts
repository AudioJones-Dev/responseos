import { ISODate, UUID } from "./common";

export type AgentProfileType =
  | "recruiter_receptionist"
  | "consulting_receptionist"
  | "professional_assistant"
  | "demo_mode";

export interface AgentProfile {
  id: UUID;
  account_id: UUID;
  name: string;
  slug: string;
  type: AgentProfileType;
  enabled: boolean;
  /** Profile the receptionist answers with when none is selected. */
  is_default: boolean;
  /** Parsed as `AgentProfilePolicy` in lib/professional/policy.ts. */
  system_policy_json?: unknown;
  metadata_json?: unknown;
  created_at: ISODate;
  updated_at: ISODate;
}
