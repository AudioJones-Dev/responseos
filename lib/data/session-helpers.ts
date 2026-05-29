import "@/lib/serverOnlyGuard";
import {
  getCurrentSession,
  resolveTenantScope,
  TenantScopeError,
  type Session,
} from "@/lib/auth/session";
import { err, errFromThrown, type Result } from "./result";

/**
 * Reads the current session, resolves the effective tenant scope, and routes
 * non-tenant roles through their cross-tenant path. Used by every per-tenant
 * accessor in lib/data/*.
 *
 * - aj_admin / operator: returns `{ session, effectiveAccountId: callerSuppliedId }`.
 * - client_admin / client_viewer: returns `{ session, effectiveAccountId: session.org.id }`,
 *   ignoring caller-supplied input (per spec §3 + §4).
 *
 * Returns an error envelope when there is no session OR when a tenant user
 * supplies an org id that does not match their session.
 */
export async function withTenantScope(callerSuppliedId?: string): Promise<
  | { ok: true; session: Session; effectiveAccountId: string | undefined }
  | { ok: false; error: { code: string; message: string } }
> {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return {
        ok: false,
        error: { code: "no_session", message: "No active session." },
      };
    }
    const effectiveAccountId = await resolveTenantScope(callerSuppliedId);

    // Defense-in-depth: tenant users who pass a different organization id
    // than their session must not silently get scoped to their own org —
    // surface as tenant_scope_denied so the caller knows they over-asked.
    if (
      (session.user.role === "client_admin" ||
        session.user.role === "client_viewer") &&
      callerSuppliedId !== undefined &&
      callerSuppliedId !== effectiveAccountId
    ) {
      throw new TenantScopeError(
        "Caller is not in the resource's tenant scope.",
      );
    }

    return { ok: true, session, effectiveAccountId };
  } catch (thrown) {
    const result = errFromThrown<never>(thrown);
    if (result.ok === false) {
      return { ok: false, error: result.error };
    }
    return {
      ok: false,
      error: { code: "internal_error", message: "Unknown error." },
    };
  }
}

/**
 * Wraps a row's account_id check for accessors that fetched a record
 * by id (e.g. getAccountById). Returns an error envelope when the
 * tenant scope mismatch is detected.
 */
export function assertRowInScope<T extends { account_id?: string | null }>(
  row: T,
  effectiveAccountId: string | undefined,
  isCrossTenantRole: boolean,
): Result<T> {
  if (isCrossTenantRole) {
    return { ok: true, data: row };
  }
  if (!effectiveAccountId) {
    return err("no_session", "No tenant scope on session.");
  }
  if (row.account_id !== effectiveAccountId) {
    return err(
      "tenant_scope_denied",
      "Caller is not in the resource's tenant scope.",
    );
  }
  return { ok: true, data: row };
}

export function isCrossTenantRole(session: Session): boolean {
  return (
    session.user.role === "aj_admin" || session.user.role === "operator"
  );
}
