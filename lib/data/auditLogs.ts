import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import type { UserRole } from "@/types/user";
import { err, errFromThrown, ok, type Result } from "./result";
import { isCrossTenantRole, withTenantScope } from "./session-helpers";

export type ActorType = "user" | "system" | "webhook";

/**
 * 31D-introduced category enum. `break_glass` is the value the future
 * privileged raw-transcript read accessor (deferred per planning Q7)
 * will write before serving any elevated read. The accessor itself
 * does NOT ship in this PR.
 */
export type AuditCategory =
  | "security"
  | "data_access"
  | "break_glass"
  | "integration"
  | "workflow"
  | "system";

export interface AuditLog {
  id: string;
  account_id?: string;
  actor_user_id?: string;
  actor_type: ActorType;
  actor_role?: UserRole;
  action: string;
  category?: AuditCategory;
  target_type?: string;
  target_id?: string;
  reason?: string;
  before_ref?: unknown;
  after_ref?: unknown;
  expires_at?: string;
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
  actor_role: string | null;
  action: string;
  category: string | null;
  target_type: string | null;
  target_id: string | null;
  reason: string | null;
  before_ref: unknown;
  after_ref: unknown;
  expires_at: Date | null;
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
    actor_role: (row.actor_role as UserRole | null) ?? undefined,
    action: row.action,
    category: (row.category as AuditCategory | null) ?? undefined,
    target_type: row.target_type ?? undefined,
    target_id: row.target_id ?? undefined,
    reason: row.reason ?? undefined,
    before_ref: row.before_ref ?? undefined,
    after_ref: row.after_ref ?? undefined,
    expires_at: row.expires_at?.toISOString(),
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
 *
 * 31D adds optional `actor_role`, `category`, `reason`, `before_ref`,
 * `after_ref`, and `expires_at` parameters. All preceding call sites
 * continue to work unchanged — the new fields default to `null` when
 * omitted.
 *
 * `category = "break_glass"` is the substrate the future privileged
 * raw-transcript read accessor will write before serving an elevated
 * read. That accessor is deferred to a post-31D PR (planning Q7 +
 * ADR-0019 step 2.3 operator authorization).
 */
export async function recordAuditLog(entry: {
  account_id?: string;
  actor_user_id?: string;
  actor_type: ActorType;
  actor_role?: UserRole;
  action: string;
  category?: AuditCategory;
  target_type?: string;
  target_id?: string;
  reason?: string;
  before_ref?: unknown;
  after_ref?: unknown;
  expires_at?: Date;
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
        actor_role: entry.actor_role ?? null,
        action: entry.action,
        category: entry.category ?? null,
        target_type: entry.target_type ?? null,
        target_id: entry.target_id ?? null,
        reason: entry.reason ?? null,
        before_ref: (entry.before_ref ?? null) as never,
        after_ref: (entry.after_ref ?? null) as never,
        expires_at: entry.expires_at ?? null,
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
  category?: AuditCategory;
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
        ...(params.category ? { category: params.category } : {}),
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
