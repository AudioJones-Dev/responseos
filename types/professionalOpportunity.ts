import { ISODate, UUID } from "./common";

export type ProfessionalOpportunityType =
  | "employment"
  | "contract"
  | "consulting"
  | "partnership"
  | "media";

export type ProfessionalOpportunityStatus =
  | "new"
  | "qualifying"
  | "scheduled"
  | "escalated"
  | "closed";

export type ProfessionalInterestLevel = "low" | "medium" | "high";

/**
 * Structured record produced by a recruiter / professional interaction
 * with the receptionist. The service-business `LeadEvent` chain is not
 * reused here: its event and qualification vocabulary is home-services
 * shaped (quote requests, property type, service-area match) and does
 * not describe a hiring conversation. See ADR-0046.
 */
export interface ProfessionalOpportunity {
  id: UUID;
  account_id: UUID;
  contact_id?: UUID;
  agent_profile_id?: UUID;
  opportunity_type: ProfessionalOpportunityType;
  company?: string;
  role_title?: string;
  recruiter_name?: string;
  recruiter_email?: string;
  recruiter_phone?: string;
  interest_level?: ProfessionalInterestLevel;
  status: ProfessionalOpportunityStatus;
  source_call_id?: UUID;
  source_conversation_id?: UUID;
  appointment_id?: UUID;
  questions_asked?: string[];
  summary?: string;
  recommended_preparation?: string[];
  next_action?: string;
  created_at: ISODate;
  updated_at: ISODate;
}
