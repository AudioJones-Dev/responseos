export type ProfessionalHandoffProviderId = "noop" | "career_os"

/**
 * Events ResponseOS emits across the Career OS boundary. ResponseOS
 * owns the interaction, the opportunity record, and the audit trail;
 * whatever consumes these events owns company research, role matching,
 * and interview preparation. Neither side imports the other's data
 * model — the payload below is the whole contract.
 */
export type ProfessionalHandoffEventName =
  | "professional.opportunity.created"
  | "professional.escalation.requested"

export interface ProfessionalOpportunityCreatedPayload {
  accountId: string
  opportunityId: string
  contactId?: string
  company?: string
  roleTitle?: string
  opportunityType: string
  summary?: string
  appointmentId?: string
  nextAction?: string
}

export interface ProfessionalEscalationRequestedPayload {
  accountId: string
  reason: string
  category: string
  contactId?: string
  opportunityId?: string
  question?: string
}

export type ProfessionalHandoffEvent =
  | {
      name: "professional.opportunity.created"
      payload: ProfessionalOpportunityCreatedPayload
    }
  | {
      name: "professional.escalation.requested"
      payload: ProfessionalEscalationRequestedPayload
    }

export interface ProfessionalHandoffReceipt {
  providerId: ProfessionalHandoffProviderId
  event: ProfessionalHandoffEventName
  /** `false` while no live consumer exists — the event is contract-only. */
  delivered: boolean
}

export interface ProfessionalHandoffProvider {
  readonly providerId: ProfessionalHandoffProviderId
  emit(event: ProfessionalHandoffEvent): Promise<ProfessionalHandoffReceipt>
}
