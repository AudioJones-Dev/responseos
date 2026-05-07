import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockCalls } from "@/lib/mock/calls";
import type {
  Call,
  CallDirection,
  CallProvider,
  CallSentiment,
  CallStatus,
} from "@/types/call";
import { err, errFromThrown, ok, type Result } from "./result";
import {
  assertRowInScope,
  isCrossTenantRole,
  withTenantScope,
} from "./session-helpers";

interface CallRow {
  id: string;
  organization_id: string;
  contact_id: string | null;
  provider: string;
  provider_call_id: string | null;
  direction: string;
  status: string;
  from_number: string;
  to_number: string;
  started_at: Date;
  ended_at: Date | null;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  sentiment: string | null;
  spam_score: number | null;
  lead_score: number | null;
  created_at: Date;
}

function rowToCall(row: CallRow): Call {
  return {
    id: row.id,
    organization_id: row.organization_id,
    contact_id: row.contact_id ?? undefined,
    provider: row.provider as CallProvider,
    provider_call_id: row.provider_call_id ?? undefined,
    direction: row.direction as CallDirection,
    status: row.status as CallStatus,
    from_number: row.from_number,
    to_number: row.to_number,
    started_at: row.started_at.toISOString(),
    ended_at: row.ended_at ? row.ended_at.toISOString() : undefined,
    duration_seconds: row.duration_seconds ?? undefined,
    recording_url: row.recording_url ?? undefined,
    transcript: row.transcript ?? undefined,
    summary: row.summary ?? undefined,
    sentiment: (row.sentiment as CallSentiment) ?? undefined,
    spam_score: row.spam_score ?? undefined,
    lead_score: row.lead_score ?? undefined,
    created_at: row.created_at.toISOString(),
  };
}

export async function listCalls(params: {
  organizationId?: string;
}): Promise<Result<Call[]>> {
  const scope = await withTenantScope(params.organizationId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const all = getMockCalls();
    if (scope.effectiveOrgId) {
      return ok(all.filter((c) => c.organization_id === scope.effectiveOrgId));
    }
    return ok(all);
  }

  try {
    const rows = await db.call.findMany({
      where: scope.effectiveOrgId
        ? { organization_id: scope.effectiveOrgId }
        : undefined,
      orderBy: { started_at: "desc" },
    });
    return ok(rows.map(rowToCall));
  } catch (e) {
    return errFromThrown<Call[]>(e);
  }
}

export async function getCallById(id: string): Promise<Result<Call>> {
  const scope = await withTenantScope(undefined);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const found = getMockCalls().find((c) => c.id === id);
    if (!found) return err("not_found", `Call ${id} not found.`);
    const scoped = assertRowInScope(
      found,
      scope.effectiveOrgId,
      isCrossTenantRole(scope.session),
    );
    return scoped.ok ? ok(found) : err(scoped.error.code, scoped.error.message);
  }

  try {
    const row = await db.call.findUnique({ where: { id } });
    if (!row) return err("not_found", `Call ${id} not found.`);
    const call = rowToCall(row);
    const scoped = assertRowInScope(
      call,
      scope.effectiveOrgId,
      isCrossTenantRole(scope.session),
    );
    return scoped.ok ? ok(call) : err(scoped.error.code, scoped.error.message);
  } catch (e) {
    return errFromThrown<Call>(e);
  }
}
