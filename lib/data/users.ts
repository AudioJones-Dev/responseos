import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import type { User, UserRole } from "@/types/user";
import { err, errFromThrown, ok, type Result } from "./result";
import { isCrossTenantRole, withTenantScope } from "./session-helpers";

interface UserRow {
  id: string;
  organization_id: string | null;
  role: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: Date;
  updated_at: Date;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    organization_id: row.organization_id ?? undefined,
    role: row.role as UserRole,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/**
 * No mock fixture exists for users in lib/mock/* (Phase A seed is the source
 * of truth). Mock fallback returns an empty list so callers degrade safely.
 */
export async function listUsers(params: {
  organizationId?: string;
}): Promise<Result<User[]>> {
  const scope = await withTenantScope(params.organizationId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    return ok([]);
  }

  try {
    const rows = await db.user.findMany({
      where: scope.effectiveOrgId
        ? { organization_id: scope.effectiveOrgId }
        : undefined,
      orderBy: { created_at: "asc" },
    });
    return ok(rows.map(rowToUser));
  } catch (e) {
    return errFromThrown<User[]>(e);
  }
}

export async function getUserById(id: string): Promise<Result<User>> {
  const scope = await withTenantScope(undefined);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    return err("not_found", `User ${id} not found.`);
  }

  try {
    const row = await db.user.findUnique({ where: { id } });
    if (!row) return err("not_found", `User ${id} not found.`);
    if (
      !isCrossTenantRole(scope.session) &&
      row.organization_id !== scope.effectiveOrgId
    ) {
      return err(
        "tenant_scope_denied",
        "Caller is not in the resource's tenant scope.",
      );
    }
    return ok(rowToUser(row));
  } catch (e) {
    return errFromThrown<User>(e);
  }
}
