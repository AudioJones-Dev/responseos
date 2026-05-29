import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { err, errFromThrown, ok, type Result } from "./result";
import { isCrossTenantRole, withTenantScope } from "./session-helpers";

export type ActorType = "user" | "system" | "webhook";

export interface AuditLog {
  id: string;
  account_id?: string;
  actor_user_id?: string;
  actor_type: ActorType;
  action: string;
  target_type?: string;
  target_id?: string;
  metadata_json?: unknown;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

interface AuditLogRow {
  id: string;
  account_id: string | null;
  actor_user_id: string | null;
  actor_type: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata_json: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

function rowToAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    account_id: row.account_id ?? undefined,
    actor_user_id: row.actor_user_id ?? undefined,
    actor_type: row.actor_type as ActorType,
    action: row.action,
    target_type: row.target_type ?? undefined,
    target_id: row.target_id ?? undefined,
    metadata_json: row.metadata_json ?? undefined,
    ip_address: row.ip_address ?? undefined,
    user_agent: row.user_agent ?? undefined,
    created_at: row.created_at.toISOString(),
  };
}

/**
 * Append-only writer for audit-log entries. Phase B exposes the writer for
 * use by Phase C consumers (status transitions, role changes, exports).
 *
 * The writer never throws back to the caller — failure to log must not
 * block the underlying mutation.
 */
export async function recordAuditLog(entry: {
  account_id?: string;
  actor_user_id?: string;
  actor_type: ActorType;
  action: string;
  target_type?: string;
  target_id?: string;
  metadata_json?: unknown;
  ip_address?: string;
  user_agent?: string;
}): Promise<Result<{ recorded: boolean }>> {
  if (db === null) {
    // No-op in mock mode; consumers continue.
    return ok({ recorded: false });
  }

  try {
    await db.auditLog.create({
      data: {
        account_id: entry.account_id ?? null,
        actor_user_id: entry.actor_user_id ?? null,
        actor_type: entry.actor_type,
        action: entry.action,
        target_type: entry.target_type ?? null,
        target_id: entry.target_id ?? null,
        metadata_json: (entry.metadata_json ?? null) as never,
        ip_address: entry.ip_address ?? null,
        user_agent: entry.user_agent ?? null,
      },
    });
    return ok({ recorded: true });
  } catch (e) {
    return errFromThrown<{ recorded: boolean }>(e);
  }
}

export async function listAuditLogs(params: {
  accountId?: string;
  action?: string;
  limit?: number;
}): Promise<Result<AuditLog[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    return ok([]);
  }

  try {
    const rows = await db.auditLog.findMany({
      where: {
        ...(scope.effectiveAccountId
          ? { account_id: scope.effectiveAccountId }
          : {}),
        ...(params.action ? { action: params.action } : {}),
      },
      orderBy: { created_at: "desc" },
      take: params.limit ?? 100,
    });

    // Cross-tenant readers see system rows (account_id null);
    // tenant readers do not.
    const filtered = isCrossTenantRole(scope.session)
      ? rows
      : rows.filter((r) => r.account_id !== null);

    return ok(filtered.map(rowToAuditLog));
  } catch (e) {
    return errFromThrown<AuditLog[]>(e);
  }
}
