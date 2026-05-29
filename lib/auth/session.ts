import "@/lib/serverOnlyGuard";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db/client";
import type { UserRole } from "@/types/user";

/**
 * v0.2 session contract per docs/v0.2-implementation-spec.md §3 and the
 * Clerk alignment plan (docs/product/RESPONSEOS_V0_2_CLERK_ALIGNMENT_PLAN.md).
 *
 * The exports below are the public surface that pages, route handlers, and
 * `lib/data/*` accessors call. 32B wires Clerk's server-side `auth()` behind
 * this contract without changing any signature, type, or error class.
 *
 * Dispatch (see `getCurrentSession`):
 *   1. Production guard — RESPONSEOS_DEV_SESSION under NODE_ENV=production throws.
 *   2. Explicit dev override — RESPONSEOS_DEV_SESSION set in non-production wins
 *      (the test/CI bypass per plan §4.7).
 *   3. Clerk path — when CLERK_SECRET_KEY is set, derive from Clerk `auth()`.
 *   4. Placeholder fallback — no Clerk env: existing dev-session behavior
 *      (defaults to aj_admin), preserved unchanged.
 *
 * The Clerk path resolves only existing `User`/`Account` rows. There is no
 * just-in-time provisioning in 32B — an unmapped Clerk identity or org resolves
 * to no session (32C owns webhook-driven provisioning).
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

/**
 * Resolves the dev/placeholder session config.
 *
 * - Always throws `DevSessionInProductionError` when RESPONSEOS_DEV_SESSION is
 *   set under NODE_ENV=production (the production hard guard).
 * - When `requireExplicit` is true, returns null unless RESPONSEOS_DEV_SESSION
 *   is explicitly set — used for the non-production override step.
 * - Otherwise falls back to the default (`aj_admin`) — the placeholder behavior
 *   preserved from before Clerk wiring.
 */
function resolveDevSession(
  { requireExplicit }: { requireExplicit: boolean } = { requireExplicit: false },
): DevSessionConfig | null {
  const requested = process.env.RESPONSEOS_DEV_SESSION;

  if (process.env.NODE_ENV === "production" && requested) {
    throw new DevSessionInProductionError();
  }

  if (requireExplicit && !(requested && requested.length > 0)) {
    return null;
  }

  const key = requested && requested.length > 0 ? requested : DEFAULT_DEV_SESSION_KEY;
  return DEV_SESSIONS[key] ?? DEV_SESSIONS[DEFAULT_DEV_SESSION_KEY];
}

function buildSession(
  user: SessionUser,
  account: SessionAccount | null,
): Session {
  return {
    user,
    account,
    expires_at: new Date(Date.now() + ONE_HOUR_MS).toISOString(),
  };
}

function clerkEnabled(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY);
}

/**
 * Conservative role mapping (operator decision Q4).
 *
 * - Control context (active org is the AJ Digital control org): the DB role is
 *   authoritative; `aj_admin` / `operator` are permitted. We never elevate
 *   beyond the DB grant.
 * - Tenant context (active org maps to a client `Account`): `aj_admin` is never
 *   granted here, and `client_admin` requires an explicit DB grant. Anything
 *   else resolves no higher than `client_viewer`.
 *
 * Clerk's generic org membership role is intentionally NOT used to widen
 * privileges — the DB row is the source of truth for the grant.
 */
function resolveSessionRole(
  dbRole: UserRole,
  context: "control" | "tenant",
): UserRole {
  if (context === "control") {
    return dbRole;
  }
  return dbRole === "client_admin" ? "client_admin" : "client_viewer";
}

/**
 * Derives a session from Clerk's server-side `auth()`.
 *
 * Resolves only existing rows — no JIT provisioning (operator decision Q1):
 * an unauthenticated Clerk request, an unmapped `clerk_user_id`, or an active
 * org with no mapped `Account` all resolve to `null` (the existing
 * unauthenticated pathway). Multi-org membership uses the active Clerk org
 * first, falling back to the AJ Digital control org only for control context
 * (operator decisions Q15 / Q4).
 */
async function deriveClerkSession(): Promise<Session | null> {
  const { userId, orgId } = await auth();
  if (!userId || !db) {
    return null;
  }

  const user = await db.user.findUnique({ where: { clerk_user_id: userId } });
  if (!user) {
    return null;
  }

  const sessionUser = (role: UserRole): SessionUser => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role,
  });

  const ajControlOrgId = process.env.AJ_DIGITAL_CLERK_ORG_ID;
  const activeOrgId = orgId ?? null;

  const isActiveControlOrg =
    Boolean(ajControlOrgId) && activeOrgId === ajControlOrgId;
  // Fallback only for control context: no active org, but the DB user is an
  // AJ control-plane user and a control org is configured.
  const isControlFallback =
    !activeOrgId &&
    Boolean(ajControlOrgId) &&
    (user.role === "aj_admin" || user.role === "operator");

  if (isActiveControlOrg || isControlFallback) {
    return buildSession(sessionUser(resolveSessionRole(user.role, "control")), null);
  }

  // Tenant context requires an active org that maps to an existing Account. We
  // never guess a tenant when no active org can be resolved (operator Q15).
  if (!activeOrgId) {
    return null;
  }

  const account = await db.account.findUnique({
    where: { clerk_org_id: activeOrgId },
  });
  if (!account) {
    return null;
  }

  // Tenant isolation: the mapped user must actually belong to this account.
  // `User.account_id` is the authoritative tenant binding (kept current by the
  // 32C webhook membership sync). When Clerk's active org maps to a different
  // account than the user's own, fail closed rather than reusing the user's
  // global role for a tenant they don't belong to (cross-tenant escalation).
  if (user.account_id !== account.id) {
    return null;
  }

  return buildSession(sessionUser(resolveSessionRole(user.role, "tenant")), {
    id: account.id,
    slug: account.slug,
    name: account.name,
  });
}

export async function getCurrentSession(): Promise<Session | null> {
  // 1 + 2. Production guard, then explicit non-production dev override.
  const explicitDev = resolveDevSession({ requireExplicit: true });
  if (explicitDev) {
    return buildSession(explicitDev.user, explicitDev.account);
  }

  // 3. Clerk path when configured.
  if (clerkEnabled()) {
    return deriveClerkSession();
  }

  // 4. Placeholder fallback — preserves pre-Clerk dev-session behavior.
  const fallback = resolveDevSession();
  return buildSession(fallback!.user, fallback!.account);
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
