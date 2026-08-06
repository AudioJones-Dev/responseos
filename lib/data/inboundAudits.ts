/**
 * Inbound marketing audit capture (public `/audit` form).
 *
 * System boundary: unauthenticated prospects have no session. Writes land on
 * the dedicated inbound pool account (`org_inbound_prospects`) as draft
 * AssessmentReport rows (ADR-0040). When DATABASE_URL is absent, falls back to
 * an in-memory ring buffer so mock-first boot still acknowledges capture.
 */

import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import type { AuditRequest } from "@/lib/validation/audit-request";
import { err, errFromThrown, ok, type Result } from "./result";
import { isCrossTenantRole, withTenantScope } from "./session-helpers";

/** Stable inbound pool account — seeded in prisma/seed.ts. */
export const INBOUND_PROSPECT_ACCOUNT_ID = "org_inbound_prospects";

export interface InboundAuditRecord {
  id: string;
  account_id: string;
  reference: string;
  status: "received" | "draft";
  inputs: AuditRequest;
  created_at: string;
  persisted: boolean;
}

const MEMORY_CAP = 100;
const memoryStore: InboundAuditRecord[] = [];

function referenceFromId(id: string): string {
  return `audit_${id.replace(/[^a-zA-Z0-9]/g, "").slice(-10) || Date.now().toString(36)}`;
}

export async function createInboundAudit(
  input: AuditRequest,
): Promise<Result<InboundAuditRecord>> {
  if (db === null) {
    const id = `mem_${Date.now().toString(36)}_${memoryStore.length}`;
    const record: InboundAuditRecord = {
      id,
      account_id: INBOUND_PROSPECT_ACCOUNT_ID,
      reference: referenceFromId(id),
      status: "received",
      inputs: input,
      created_at: new Date().toISOString(),
      persisted: false,
    };
    memoryStore.unshift(record);
    if (memoryStore.length > MEMORY_CAP) memoryStore.length = MEMORY_CAP;
    return ok(record);
  }

  try {
    const row = await db.assessmentReport.create({
      data: {
        account_id: INBOUND_PROSPECT_ACCOUNT_ID,
        status: "draft",
        inputs_json: {
          channel: "marketing_audit",
          ...input,
        },
      },
    });
    return ok({
      id: row.id,
      account_id: row.account_id,
      reference: referenceFromId(row.id),
      status: "draft",
      inputs: input,
      created_at: row.created_at.toISOString(),
      persisted: true,
    });
  } catch (e) {
    return errFromThrown<InboundAuditRecord>(e);
  }
}

/** Operator/aj_admin only — list recent inbound audit captures. */
export async function listInboundAudits(params?: {
  limit?: number;
}): Promise<Result<InboundAuditRecord[]>> {
  const scope = await withTenantScope(undefined);
  if (!scope.ok) return err(scope.error.code, scope.error.message);
  if (!isCrossTenantRole(scope.session)) {
    return err("forbidden", "Inbound audits are operator-only.");
  }

  const limit = Math.min(Math.max(params?.limit ?? 50, 1), 200);

  if (db === null) {
    return ok(memoryStore.slice(0, limit));
  }

  try {
    const rows = await db.assessmentReport.findMany({
      where: { account_id: INBOUND_PROSPECT_ACCOUNT_ID },
      orderBy: { created_at: "desc" },
      take: limit,
    });
    return ok(
      rows.map((row) => {
        const inputs = row.inputs_json as AuditRequest & { channel?: string };
        return {
          id: row.id,
          account_id: row.account_id,
          reference: referenceFromId(row.id),
          status: "draft" as const,
          inputs: {
            name: inputs.name,
            email: inputs.email,
            business_name: inputs.business_name,
            phone: inputs.phone,
            industry: inputs.industry,
            monthly_missed_calls: inputs.monthly_missed_calls,
            avg_job_value_usd: inputs.avg_job_value_usd,
            notes: inputs.notes,
          },
          created_at: row.created_at.toISOString(),
          persisted: true,
        };
      }),
    );
  } catch (e) {
    return errFromThrown<InboundAuditRecord[]>(e);
  }
}

/** Test helper — clear in-memory fallback. */
export function __resetInboundAuditMemoryForTests(): void {
  memoryStore.length = 0;
}
