import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockLeadEvents } from "@/lib/mock/leads";
import type {
  LeadEvent,
  LeadEventSource,
  LeadEventStatus,
  LeadEventType,
  LeadUrgency,
} from "@/types/lead";
import { err, errFromThrown, ok, type Result } from "./result";
import {
  assertRowInScope,
  isCrossTenantRole,
  withTenantScope,
} from "./session-helpers";

interface LeadEventRow {
  id: string;
  account_id: string;
  contact_id: string | null;
  call_id: string | null;
  source: string;
  event_type: string;
  status: string;
  urgency: string;
  estimated_value: number | null;
  recovered_value: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

function rowToLeadEvent(row: LeadEventRow): LeadEvent {
  return {
    id: row.id,
    account_id: row.account_id,
    contact_id: row.contact_id ?? undefined,
    call_id: row.call_id ?? undefined,
    source: row.source as LeadEventSource,
    event_type: row.event_type as LeadEventType,
    status: row.status as LeadEventStatus,
    urgency: row.urgency as LeadUrgency,
    estimated_value: row.estimated_value ?? undefined,
    recovered_value: row.recovered_value ?? undefined,
    notes: row.notes ?? undefined,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listLeads(params: {
  accountId?: string;
  status?: LeadEventStatus;
}): Promise<Result<LeadEvent[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    let all = getMockLeadEvents();
    if (scope.effectiveAccountId) {
      all = all.filter((l) => l.account_id === scope.effectiveAccountId);
    }
    if (params.status) {
      all = all.filter((l) => l.status === params.status);
    }
    return ok(all);
  }

  try {
    const rows = await db.leadEvent.findMany({
      where: {
        ...(scope.effectiveAccountId
          ? { account_id: scope.effectiveAccountId }
          : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { created_at: "desc" },
    });
    return ok(rows.map(rowToLeadEvent));
  } catch (e) {
    return errFromThrown<LeadEvent[]>(e);
  }
}

export async function getLeadById(id: string): Promise<Result<LeadEvent>> {
  const scope = await withTenantScope(undefined);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const found = getMockLeadEvents().find((l) => l.id === id);
    if (!found) return err("not_found", `LeadEvent ${id} not found.`);
    const scoped = assertRowInScope(
      found,
      scope.effectiveAccountId,
      isCrossTenantRole(scope.session),
    );
    return scoped.ok ? ok(found) : err(scoped.error.code, scoped.error.message);
  }

  try {
    const row = await db.leadEvent.findUnique({ where: { id } });
    if (!row) return err("not_found", `LeadEvent ${id} not found.`);
    const lead = rowToLeadEvent(row);
    const scoped = assertRowInScope(
      lead,
      scope.effectiveAccountId,
      isCrossTenantRole(scope.session),
    );
    return scoped.ok ? ok(lead) : err(scoped.error.code, scoped.error.message);
  } catch (e) {
    return errFromThrown<LeadEvent>(e);
  }
}
