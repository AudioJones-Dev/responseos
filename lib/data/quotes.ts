import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockQuoteRequests } from "@/lib/mock/quotes";
import type { QuoteRequest, QuoteStatus } from "@/types/quote";
import { err, errFromThrown, ok, type Result } from "./result";
import {
  assertRowInScope,
  isCrossTenantRole,
  withTenantScope,
} from "./session-helpers";

interface QuoteRow {
  id: string;
  account_id: string;
  contact_id: string;
  lead_event_id: string | null;
  service_type: string;
  description: string | null;
  photos: string[];
  property_address: string | null;
  estimated_value: number | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

function rowToQuote(row: QuoteRow): QuoteRequest {
  return {
    id: row.id,
    account_id: row.account_id,
    contact_id: row.contact_id,
    lead_event_id: row.lead_event_id ?? undefined,
    service_type: row.service_type,
    description: row.description ?? undefined,
    photos: row.photos,
    property_address: row.property_address ?? undefined,
    estimated_value: row.estimated_value ?? undefined,
    status: row.status as QuoteStatus,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listQuoteRequests(params: {
  accountId?: string;
}): Promise<Result<QuoteRequest[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const all = getMockQuoteRequests();
    if (scope.effectiveAccountId) {
      return ok(all.filter((q) => q.account_id === scope.effectiveAccountId));
    }
    return ok(all);
  }

  try {
    const rows = await db.quoteRequest.findMany({
      where: scope.effectiveAccountId
        ? { account_id: scope.effectiveAccountId }
        : undefined,
      orderBy: { created_at: "desc" },
    });
    return ok(rows.map(rowToQuote));
  } catch (e) {
    return errFromThrown<QuoteRequest[]>(e);
  }
}

export async function getQuoteRequestById(
  id: string,
): Promise<Result<QuoteRequest>> {
  const scope = await withTenantScope(undefined);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const found = getMockQuoteRequests().find((q) => q.id === id);
    if (!found) return err("not_found", `QuoteRequest ${id} not found.`);
    const scoped = assertRowInScope(
      found,
      scope.effectiveAccountId,
      isCrossTenantRole(scope.session),
    );
    return scoped.ok ? ok(found) : err(scoped.error.code, scoped.error.message);
  }

  try {
    const row = await db.quoteRequest.findUnique({ where: { id } });
    if (!row) return err("not_found", `QuoteRequest ${id} not found.`);
    const quote = rowToQuote(row);
    const scoped = assertRowInScope(
      quote,
      scope.effectiveAccountId,
      isCrossTenantRole(scope.session),
    );
    return scoped.ok ? ok(quote) : err(scoped.error.code, scoped.error.message);
  } catch (e) {
    return errFromThrown<QuoteRequest>(e);
  }
}
