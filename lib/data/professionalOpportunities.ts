import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockProfessionalOpportunities } from "@/lib/mock/professionalOpportunities";
import { getAppointmentById } from "./appointments";
import type {
  ProfessionalInterestLevel,
  ProfessionalOpportunity,
  ProfessionalOpportunityStatus,
  ProfessionalOpportunityType,
} from "@/types/professionalOpportunity";
import { err, errFromThrown, ok, type Result } from "./result";
import { isCrossTenantRole, withTenantScope } from "./session-helpers";

interface ProfessionalOpportunityRow {
  id: string;
  account_id: string;
  contact_id: string | null;
  agent_profile_id: string | null;
  opportunity_type: string;
  company: string | null;
  role_title: string | null;
  recruiter_name: string | null;
  recruiter_email: string | null;
  recruiter_phone: string | null;
  interest_level: string | null;
  status: string;
  source_call_id: string | null;
  source_conversation_id: string | null;
  appointment_id: string | null;
  questions_asked: unknown;
  summary: string | null;
  recommended_preparation: unknown;
  next_action: string | null;
  created_at: Date;
  updated_at: Date;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is string => typeof entry === "string");
}

function rowToOpportunity(
  row: ProfessionalOpportunityRow,
): ProfessionalOpportunity {
  return {
    id: row.id,
    account_id: row.account_id,
    contact_id: row.contact_id ?? undefined,
    agent_profile_id: row.agent_profile_id ?? undefined,
    opportunity_type: row.opportunity_type as ProfessionalOpportunityType,
    company: row.company ?? undefined,
    role_title: row.role_title ?? undefined,
    recruiter_name: row.recruiter_name ?? undefined,
    recruiter_email: row.recruiter_email ?? undefined,
    recruiter_phone: row.recruiter_phone ?? undefined,
    interest_level:
      (row.interest_level as ProfessionalInterestLevel | null) ?? undefined,
    status: row.status as ProfessionalOpportunityStatus,
    source_call_id: row.source_call_id ?? undefined,
    source_conversation_id: row.source_conversation_id ?? undefined,
    appointment_id: row.appointment_id ?? undefined,
    questions_asked: stringArray(row.questions_asked),
    summary: row.summary ?? undefined,
    recommended_preparation: stringArray(row.recommended_preparation),
    next_action: row.next_action ?? undefined,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listProfessionalOpportunities(params: {
  accountId?: string;
  status?: ProfessionalOpportunityStatus;
}): Promise<Result<ProfessionalOpportunity[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    let filtered = getMockProfessionalOpportunities();
    if (scope.effectiveAccountId) {
      filtered = filtered.filter(
        (row) => row.account_id === scope.effectiveAccountId,
      );
    }
    if (params.status) {
      filtered = filtered.filter((row) => row.status === params.status);
    }
    return ok(filtered);
  }

  try {
    const rows = await db.professionalOpportunity.findMany({
      where: {
        ...(scope.effectiveAccountId
          ? { account_id: scope.effectiveAccountId }
          : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { created_at: "desc" },
    });
    return ok(rows.map(rowToOpportunity));
  } catch (e) {
    return errFromThrown<ProfessionalOpportunity[]>(e);
  }
}

export async function getProfessionalOpportunityById(
  id: string,
): Promise<Result<ProfessionalOpportunity>> {
  const scope = await withTenantScope(undefined);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const found = getMockProfessionalOpportunities().find(
      (row) => row.id === id,
    );
    if (!found) {
      return err("not_found", `ProfessionalOpportunity ${id} not found.`);
    }
    if (
      !isCrossTenantRole(scope.session) &&
      found.account_id !== scope.effectiveAccountId
    ) {
      return err(
        "tenant_scope_denied",
        "Caller is not in the resource's tenant scope.",
      );
    }
    return ok(found);
  }

  try {
    const row = await db.professionalOpportunity.findUnique({ where: { id } });
    if (!row) {
      return err("not_found", `ProfessionalOpportunity ${id} not found.`);
    }
    if (
      !isCrossTenantRole(scope.session) &&
      row.account_id !== scope.effectiveAccountId
    ) {
      return err(
        "tenant_scope_denied",
        "Caller is not in the resource's tenant scope.",
      );
    }
    return ok(rowToOpportunity(row));
  } catch (e) {
    return errFromThrown<ProfessionalOpportunity>(e);
  }
}

/**
 * Writes the structured record a professional interaction produced.
 *
 * The account written to is the session's effective scope, never the
 * caller's claim: a tenant user cannot file an opportunity against
 * another tenant, and a cross-tenant operator must name the account
 * explicitly.
 */
export async function createProfessionalOpportunity(entry: {
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
  status?: ProfessionalOpportunityStatus;
  sourceCallId?: string;
  sourceConversationId?: string;
  appointmentId?: string;
  questionsAsked?: string[];
  summary?: string;
  recommendedPreparation?: string[];
  nextAction?: string;
}): Promise<Result<ProfessionalOpportunity>> {
  const scope = await withTenantScope(entry.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);
  if (!scope.effectiveAccountId) {
    return err("invalid_input", "An account id is required.");
  }

  if (db === null) {
    return err(
      "not_available",
      "createProfessionalOpportunity requires a database connection.",
    );
  }

  try {
    const row = await db.professionalOpportunity.create({
      data: {
        account_id: scope.effectiveAccountId,
        contact_id: entry.contactId ?? null,
        agent_profile_id: entry.agentProfileId ?? null,
        opportunity_type: entry.opportunityType,
        company: entry.company ?? null,
        role_title: entry.roleTitle ?? null,
        recruiter_name: entry.recruiterName ?? null,
        recruiter_email: entry.recruiterEmail ?? null,
        recruiter_phone: entry.recruiterPhone ?? null,
        interest_level: entry.interestLevel ?? null,
        status: entry.status ?? "new",
        source_call_id: entry.sourceCallId ?? null,
        source_conversation_id: entry.sourceConversationId ?? null,
        appointment_id: entry.appointmentId ?? null,
        questions_asked: (entry.questionsAsked ?? null) as never,
        summary: entry.summary ?? null,
        recommended_preparation: (entry.recommendedPreparation ?? null) as never,
        next_action: entry.nextAction ?? null,
      },
    });
    return ok(rowToOpportunity(row));
  } catch (e) {
    return errFromThrown<ProfessionalOpportunity>(e);
  }
}

/**
 * Links a booked appointment back to its opportunity and moves the row
 * to `scheduled`.
 *
 * Both sides are authorized, not just the opportunity: a cross-tenant
 * caller passes the opportunity check on any row, so the appointment's
 * account is compared explicitly. Otherwise an appointment from tenant
 * A could be linked onto an opportunity in tenant B.
 */
export async function attachAppointmentToOpportunity(entry: {
  opportunityId: string;
  appointmentId: string;
}): Promise<Result<ProfessionalOpportunity>> {
  const existing = await getProfessionalOpportunityById(entry.opportunityId);
  if (!existing.ok) return existing;

  const appointment = await getAppointmentById(entry.appointmentId);
  if (!appointment.ok) return appointment;

  if (appointment.data.account_id !== existing.data.account_id) {
    return err(
      "tenant_scope_denied",
      "Appointment and opportunity belong to different tenants.",
    );
  }

  if (db === null) {
    return err(
      "not_available",
      "attachAppointmentToOpportunity requires a database connection.",
    );
  }

  try {
    const row = await db.professionalOpportunity.update({
      where: { id: entry.opportunityId },
      data: { appointment_id: entry.appointmentId, status: "scheduled" },
    });
    return ok(rowToOpportunity(row));
  } catch (e) {
    return errFromThrown<ProfessionalOpportunity>(e);
  }
}
