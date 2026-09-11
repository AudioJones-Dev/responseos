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
  /**
   * The owner's salary floor, attached only to a `compensation`
   * escalation so the owner has the figure when the handoff reaches
   * them. This is the one direction the number travels: toward the
   * owner, never toward the caller.
   *
   * Absent on every other category. A references or consulting-rates
   * escalation has no use for an annual salary minimum, and a payload
   * that carries a figure it does not need is a figure in one more
   * place than it has to be.
   */
  compensationFloor?: {
    amount: number
    currency: string
    period: "year" | "hour"
  }
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
