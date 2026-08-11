import "@/lib/serverOnlyGuard";
import { recordAuditLog } from "@/lib/data/auditLogs";
import { createAppointment } from "@/lib/data/appointments";
import {
  attachAppointmentToOpportunity,
  createProfessionalOpportunity,
} from "@/lib/data/professionalOpportunities";
import { err, ok, type Result } from "@/lib/data/result";
import { getProfessionalHandoffProvider } from "@/lib/providers/professionalHandoff";
import type { ProfessionalHandoffReceipt } from "@/lib/providers/professionalHandoff";
import { getSchedulingProvider } from "@/lib/providers/scheduling";
import type { Appointment } from "@/types/appointment";
import type {
  ProfessionalInterestLevel,
  ProfessionalOpportunity,
  ProfessionalOpportunityType,
} from "@/types/professionalOpportunity";
import {
  DEFAULT_AGENT_PROFILE_POLICY,
  type AgentProfilePolicy,
  type ProfessionalAppointmentType,
} from "./policy";

/**
 * Files the structured record a professional interaction produced,
 * records it in the audit trail, and emits the Career OS handoff event.
 *
 * The handoff is fire-and-return: the no-op adapter reports
 * `delivered: false`, and a failed handoff never invalidates the stored
 * opportunity — ResponseOS owns the record, whatever consumes the event
 * does not.
 */
export async function captureProfessionalOpportunity(input: {
  accountId: string;
  opportunityType: ProfessionalOpportunityType;
  contactId?: string;
  agentProfileId?: string;
  company?: string;
  roleTitle?: string;
  recruiterName?: string;
  recruiterEmail?: string;
  recruiterPhone?: string;
  interestLevel?: ProfessionalInterestLevel;
  sourceCallId?: string;
  sourceConversationId?: string;
  questionsAsked?: string[];
  summary?: string;
  recommendedPreparation?: string[];
  nextAction?: string;
}): Promise<
  Result<{
    opportunity: ProfessionalOpportunity;
    handoff: ProfessionalHandoffReceipt;
  }>
> {
  const created = await createProfessionalOpportunity(input);
  if (!created.ok) return created;

  const opportunity = created.data;

  await recordAuditLog({
    account_id: opportunity.account_id,
    actor_type: "system",
    action: "professional.opportunity.created",
    category: "workflow",
    target_type: "ProfessionalOpportunity",
    target_id: opportunity.id,
    metadata_json: {
      agent_profile_id: opportunity.agent_profile_id,
      opportunity_type: opportunity.opportunity_type,
    },
  });

  const handoff = await getProfessionalHandoffProvider().emit({
    name: "professional.opportunity.created",
    payload: {
      accountId: opportunity.account_id,
      opportunityId: opportunity.id,
      contactId: opportunity.contact_id,
      company: opportunity.company,
      roleTitle: opportunity.role_title,
      opportunityType: opportunity.opportunity_type,
      summary: opportunity.summary,
      appointmentId: opportunity.appointment_id,
      nextAction: opportunity.next_action,
    },
  });

  return ok({ opportunity, handoff });
}

/**
 * Routes a question the receptionist may not answer to the account
 * owner. Recorded in the audit trail and emitted across the Career OS
 * boundary; nothing about the caller's question is answered here.
 */
export async function requestProfessionalEscalation(input: {
  accountId: string;
  reason: string;
  category: string;
  contactId?: string;
  opportunityId?: string;
  question?: string;
}): Promise<ProfessionalHandoffReceipt> {
  await recordAuditLog({
    account_id: input.accountId,
    actor_type: "system",
    action: "professional.escalation.requested",
    category: "workflow",
    target_type: "ProfessionalOpportunity",
    target_id: input.opportunityId,
    reason: input.reason,
  });

  return getProfessionalHandoffProvider().emit({
    name: "professional.escalation.requested",
    payload: {
      accountId: input.accountId,
      reason: input.reason,
      category: input.category,
      contactId: input.contactId,
      opportunityId: input.opportunityId,
      question: input.question,
    },
  });
}

/**
 * Books an offered window through the scheduling provider, stores it as
 * an ordinary `Appointment`, and links it back to the opportunity.
 *
 * The appointment type must be one the answering profile allows —
 * a demo-mode profile cannot book a hiring-manager interview.
 */
export async function bookProfessionalAppointment(input: {
  accountId: string;
  contactId: string;
  opportunityId: string;
  appointmentType: ProfessionalAppointmentType;
  slotId: string;
  inviteeName: string;
  inviteeEmail: string;
  title: string;
  policy?: AgentProfilePolicy;
}): Promise<Result<{ appointment: Appointment }>> {
  const policy = input.policy ?? DEFAULT_AGENT_PROFILE_POLICY;
  if (!policy.allowedAppointmentTypes.includes(input.appointmentType)) {
    return err(
      "policy_denied",
      `Appointment type ${input.appointmentType} is not allowed for this agent profile.`,
    );
  }

  const booking = await getSchedulingProvider().bookSlot({
    accountId: input.accountId,
    eventTypeId: input.appointmentType,
    slotId: input.slotId,
    inviteeEmail: input.inviteeEmail,
    inviteeName: input.inviteeName,
    bookingId: input.opportunityId,
  });

  const appointment = await createAppointment({
    accountId: input.accountId,
    contactId: input.contactId,
    calendarProvider: "manual",
    externalEventId: booking.providerBookingId,
    title: input.title,
    startTime: new Date(booking.startsAt),
    endTime: new Date(booking.endsAt),
    status: "scheduled",
    notes: `Booked by the ResponseOS professional receptionist (${input.appointmentType}).`,
  });
  if (!appointment.ok) return appointment;

  const linked = await attachAppointmentToOpportunity({
    opportunityId: input.opportunityId,
    appointmentId: appointment.data.id,
  });
  if (!linked.ok) return linked;

  return ok({ appointment: appointment.data });
}
