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
   * The owner's salary floor, carried only on a `compensation`
   * escalation so that a consumer, when one exists, receives the figure
   * rather than having to look it up. Nothing consumes this event today
   * — the handoff adapter is a no-op that returns `delivered: false`
   * (ADR-0046 decision 10) — so this describes what the contract
   * carries, not a figure anyone currently receives.
   *
   * The field is **absent**, not `undefined`, on every other category:
   * a references or consulting-rates escalation has no use for an
   * annual salary minimum, and a payload carrying a figure it does not
   * need is a figure in one more place than it has to be.
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
