import { ISODate, UUID, newId, nowIso } from "./common";

export type OpportunityType =
  | "service"
  | "employment"
  | "contract"
  | "consulting"
  | "partnership"
  | "media"
  | "demo"
  | "other";

export type OpportunityStatus =
  | "new"
  | "qualified"
  | "scheduled"
  | "escalated"
  | "closed_won"
  | "closed_lost"
  | "archived";

export interface Opportunity {
  id: UUID;
  account_id: UUID;
  contact_id?: UUID;
  source_call_id?: UUID;
  source_conversation_id?: UUID;
  appointment_id?: UUID;
  opportunity_type: OpportunityType;
  status: OpportunityStatus;
  interest_level?: string;
  summary?: string;
  details_json?: unknown;
  questions_asked?: unknown;
  recommended_preparation?: unknown;
  next_action?: string;
  created_at: ISODate;
  updated_at: ISODate;
}

export function MockOpportunity(
  overrides: Partial<Opportunity> = {},
): Opportunity {
  const now = nowIso();
  return {
    id: newId(),
    account_id: "acct_internal_demo_tyrone",
    opportunity_type: "employment",
    status: "new",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}
