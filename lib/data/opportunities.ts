import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockOpportunities } from "@/lib/mock/opportunities";
import type {
  Opportunity,
  OpportunityStatus,
  OpportunityType,
} from "@/types/opportunity";
import { err, errFromThrown, ok, type Result } from "./result";
import { withTenantScope } from "./session-helpers";

function rowToOpportunity(row: {
  id: string;
  account_id: string;
  contact_id: string | null;
  source_call_id: string | null;
  source_conversation_id: string | null;
  appointment_id: string | null;
  opportunity_type: string;
  status: string;
  interest_level: string | null;
  summary: string | null;
  details_json: unknown;
  questions_asked: unknown;
  recommended_preparation: unknown;
  next_action: string | null;
  created_at: Date;
  updated_at: Date;
}): Opportunity {
  return {
    id: row.id,
    account_id: row.account_id,
    contact_id: row.contact_id ?? undefined,
    source_call_id: row.source_call_id ?? undefined,
    source_conversation_id: row.source_conversation_id ?? undefined,
    appointment_id: row.appointment_id ?? undefined,
    opportunity_type: row.opportunity_type as OpportunityType,
    status: row.status as OpportunityStatus,
    interest_level: row.interest_level ?? undefined,
    summary: row.summary ?? undefined,
    details_json: row.details_json ?? undefined,
    questions_asked: row.questions_asked ?? undefined,
    recommended_preparation: row.recommended_preparation ?? undefined,
    next_action: row.next_action ?? undefined,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listOpportunities(params: {
  accountId?: string;
  status?: OpportunityStatus;
}): Promise<Result<Opportunity[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    return ok(
      getMockOpportunities().filter(
        (opportunity) =>
          (!scope.effectiveAccountId ||
            opportunity.account_id === scope.effectiveAccountId) &&
          (!params.status || opportunity.status === params.status),
      ),
    );
  }

  try {
    const rows = await db.opportunity.findMany({
      where: {
        ...(scope.effectiveAccountId
          ? { account_id: scope.effectiveAccountId }
          : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { created_at: "desc" },
    });
    return ok(rows.map(rowToOpportunity));
  } catch (error) {
    return errFromThrown<Opportunity[]>(error);
  }
}
