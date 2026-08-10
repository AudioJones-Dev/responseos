import { ISODate, UUID, newId, nowIso } from "./common";

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
  profile_type: AgentProfileType;
  enabled: boolean;
  is_default: boolean;
  policy_json?: unknown;
  metadata_json?: unknown;
  created_at: ISODate;
  updated_at: ISODate;
}

export function MockAgentProfile(
  overrides: Partial<AgentProfile> = {},
): AgentProfile {
  const now = nowIso();
  return {
    id: newId(),
    account_id: "acct_internal_demo_tyrone",
    name: "Recruiter Receptionist",
    slug: "recruiter-receptionist",
    profile_type: "recruiter_receptionist",
    enabled: true,
    is_default: false,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}
