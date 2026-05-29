import "@/lib/serverOnlyGuard";
import type { UserRole } from "@/types/user";

/**
 * v0.2 placeholder session contract per docs/v0.2-implementation-spec.md §3.
 *
 * The five exports below are the public surface that pages, route handlers,
 * and `lib/data/*` accessors call today. v0.3 swaps the implementation behind
 * the same contract for a real auth provider (Auth.js per §11 Q2).
 *
 * Hard production guard: setting RESPONSEOS_DEV_SESSION while
 * NODE_ENV === "production" throws on every session lookup. The placeholder
 * is dev-mode only.
 */

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface SessionAccount {
  id: string;
  slug: string;
  name: string;
}

export interface Session {
  user: SessionUser;
  account: SessionAccount | null;
  expires_at: string;
}

interface DevSessionConfig {
  user: SessionUser;
  account: SessionAccount | null;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

const DEV_SESSIONS: Record<string, DevSessionConfig> = {
  aj_admin: {
    user: {
      id: "user_aj_admin_1",
      email: "aj@responseos.example",
      name: "AJ Admin",
      role: "aj_admin",
    },
    account: null,
  },
  operator: {
    user: {
      id: "user_aj_operator_1",
      email: "operator@responseos.example",
      name: "AJ Operator",
      role: "operator",
    },
    account: null,
  },
  "client_admin@org_mock_1": {
    user: {
      id: "user_acme_owner_1",
      email: "owner@sunshine-hvac.example",
      name: "Sunshine Owner",
      role: "client_admin",
    },
    account: {
      id: "org_mock_1",
      slug: "sunshine-hvac",
      name: "Sunshine HVAC",
    },
  },
  "client_viewer@org_mock_1": {
    user: {
      id: "user_acme_viewer_1",
      email: "manager@sunshine-hvac.example",
      name: "Sunshine Office Manager",
      role: "client_viewer",
    },
    account: {
      id: "org_mock_1",
      slug: "sunshine-hvac",
      name: "Sunshine HVAC",
    },
  },
};

const DEFAULT_DEV_SESSION_KEY = "aj_admin";

class TenantScopeError extends Error {
  code = "tenant_scope_denied" as const;
  status = 403 as const;
  constructor(message = "Caller is not in the resource's tenant scope.") {
    super(message);
    this.name = "TenantScopeError";
  }
}

class RoleDeniedError extends Error {
  code = "role_denied" as const;
  status = 403 as const;
  constructor(message = "Caller role is not authorized for this action.") {
    super(message);
    this.name = "RoleDeniedError";
  }
}

class DevSessionInProductionError extends Error {
  code = "dev_session_in_production" as const;
  status = 500 as const;
  constructor() {
    super(
      "RESPONSEOS_DEV_SESSION must not be set when NODE_ENV === 'production'.",
    );
    this.name = "DevSessionInProductionError";
  }
}

export { TenantScopeError, RoleDeniedError, DevSessionInProductionError };

function resolveDevSession(): DevSessionConfig {
  const requested = process.env.RESPONSEOS_DEV_SESSION;

  if (process.env.NODE_ENV === "production" && requested) {
    throw new DevSessionInProductionError();
  }

  const key = requested && requested.length > 0 ? requested : DEFAULT_DEV_SESSION_KEY;
  const config = DEV_SESSIONS[key];
  if (!config) {
    return DEV_SESSIONS[DEFAULT_DEV_SESSION_KEY];
  }
  return config;
}

export async function getCurrentSession(): Promise<Session | null> {
  const config = resolveDevSession();
  return {
    user: config.user,
    account: config.account,
    expires_at: new Date(Date.now() + ONE_HOUR_MS).toISOString(),
  };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

export async function getCurrentAccount(): Promise<SessionAccount | null> {
  const session = await getCurrentSession();
  return session?.account ?? null;
}

export async function requireRole(
  role: UserRole | UserRole[],
): Promise<Session> {
  const session = await getCurrentSession();
  if (!session) {
    throw new RoleDeniedError("No active session.");
  }
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(session.user.role)) {
    throw new RoleDeniedError(
      `Role ${session.user.role} not in allowed set [${allowed.join(", ")}].`,
    );
  }
  return session;
}

export async function requireTenantScope(
  accountId: string,
): Promise<void> {
  const session = await getCurrentSession();
  if (!session) {
    throw new TenantScopeError("No active session.");
  }
  // aj_admin and operator bypass tenant scope per spec §3.
  if (session.user.role === "aj_admin" || session.user.role === "operator") {
    return;
  }
  if (!session.account || session.account.id !== accountId) {
    throw new TenantScopeError();
  }
}

/**
 * Resolves the tenant id a query should be scoped to.
 *
 * - aj_admin / operator: use the caller-supplied accountId (may be undefined for
 *   cross-tenant reads).
 * - client_admin / client_viewer: ignore caller input and return the session
 *   organization id.
 *
 * Throws TenantScopeError when a tenant user has no organization on session.
 */
export async function resolveTenantScope(
  callerSuppliedId?: string,
): Promise<string | undefined> {
  const session = await getCurrentSession();
  if (!session) {
    throw new TenantScopeError("No active session.");
  }
  if (session.user.role === "aj_admin" || session.user.role === "operator") {
    return callerSuppliedId;
  }
  if (!session.account) {
    throw new TenantScopeError("Tenant user has no account context.");
  }
  return session.account.id;
}
