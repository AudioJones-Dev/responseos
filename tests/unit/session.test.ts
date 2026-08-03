import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type Mock,
} from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/client", () => ({
  db: {
    user: { findUnique: vi.fn() },
    account: { findUnique: vi.fn() },
  },
}));

const ORIGINAL_ENV = { ...process.env };

async function freshSession() {
  vi.resetModules();
  return await import("@/lib/auth/session");
}

/**
 * Loads the session module plus the (mocked) Clerk and Prisma modules after a
 * single `resetModules()`, so all three share the same fresh module instances.
 */
async function loadClerkSession() {
  vi.resetModules();
  const clerk = await import("@clerk/nextjs/server");
  const client = await import("@/lib/db/client");
  const session = await import("@/lib/auth/session");
  return {
    session,
    auth: clerk.auth as unknown as Mock,
    userFindUnique: (client.db as unknown as {
      user: { findUnique: Mock };
    }).user.findUnique,
    accountFindUnique: (client.db as unknown as {
      account: { findUnique: Mock };
    }).account.findUnique,
  };
}

type MutableEnv = Record<string, string | undefined>;

describe("lib/auth/session.ts", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    const env = process.env as MutableEnv;
    delete env.RESPONSEOS_DEV_SESSION;
    delete env.NODE_ENV;
    delete env.CLERK_SECRET_KEY;
    delete env.AJ_DIGITAL_CLERK_ORG_ID;
    delete env.RESPONSEOS_REQUIRE_AUTH;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  test("default session resolves to aj_admin (no env vars)", async () => {
    const { getCurrentSession } = await freshSession();
    const session = await getCurrentSession();
    expect(session?.user.role).toBe("aj_admin");
    expect(session?.account).toBeNull();
  });

  test("RESPONSEOS_DEV_SESSION=client_admin@org_mock_1 yields tenant session", async () => {
    process.env.RESPONSEOS_DEV_SESSION = "client_admin@org_mock_1";
    const { getCurrentSession, getCurrentAccount } = await freshSession();
    const session = await getCurrentSession();
    expect(session?.user.role).toBe("client_admin");
    expect(session?.account?.id).toBe("org_mock_1");
    const org = await getCurrentAccount();
    expect(org?.slug).toBe("sunshine-hvac");
  });

  test("hard-throws if NODE_ENV=production AND RESPONSEOS_DEV_SESSION is set", async () => {
    (process.env as MutableEnv).NODE_ENV = "production";
    process.env.RESPONSEOS_DEV_SESSION = "aj_admin";
    const { getCurrentSession, DevSessionInProductionError } =
      await freshSession();
    await expect(getCurrentSession()).rejects.toBeInstanceOf(
      DevSessionInProductionError,
    );
  });

  test("does NOT throw in production when RESPONSEOS_DEV_SESSION is unset", async () => {
    (process.env as MutableEnv).NODE_ENV = "production";
    const { getCurrentSession } = await freshSession();
    await expect(getCurrentSession()).resolves.toBeTruthy();
  });

  test("RESPONSEOS_REQUIRE_AUTH fails closed (null) when Clerk is unconfigured", async () => {
    // Auth-required hosted deploy without Clerk keys must NOT fall back to the
    // privileged aj_admin dev session (D2 — cross-tenant fail-open).
    process.env.RESPONSEOS_REQUIRE_AUTH = "1";
    const { getCurrentSession } = await freshSession();
    expect(await getCurrentSession()).toBeNull();
  });

  test("RESPONSEOS_REQUIRE_AUTH=0/false preserves the mock-first fallback", async () => {
    process.env.RESPONSEOS_REQUIRE_AUTH = "0";
    const { getCurrentSession } = await freshSession();
    expect((await getCurrentSession())?.user.role).toBe("aj_admin");
    process.env.RESPONSEOS_REQUIRE_AUTH = "false";
    const again = await freshSession();
    expect((await again.getCurrentSession())?.user.role).toBe("aj_admin");
  });

  test("requireRole accepts matching role", async () => {
    const { requireRole } = await freshSession();
    const session = await requireRole("aj_admin");
    expect(session.user.role).toBe("aj_admin");
  });

  test("requireRole rejects non-matching role with role_denied", async () => {
    const { requireRole, RoleDeniedError } = await freshSession();
    await expect(requireRole("client_admin")).rejects.toBeInstanceOf(
      RoleDeniedError,
    );
  });

  test("requireTenantScope: aj_admin bypasses for any org", async () => {
    const { requireTenantScope } = await freshSession();
    await expect(
      requireTenantScope("org_mock_1"),
    ).resolves.toBeUndefined();
    await expect(
      requireTenantScope("org_mock_2"),
    ).resolves.toBeUndefined();
  });

  test("requireTenantScope: client_admin allowed only in their own org", async () => {
    process.env.RESPONSEOS_DEV_SESSION = "client_admin@org_mock_1";
    const { requireTenantScope, TenantScopeError } = await freshSession();
    await expect(
      requireTenantScope("org_mock_1"),
    ).resolves.toBeUndefined();
    await expect(requireTenantScope("org_mock_2")).rejects.toBeInstanceOf(
      TenantScopeError,
    );
  });

  test("resolveTenantScope: tenant user always returns their own org id", async () => {
    process.env.RESPONSEOS_DEV_SESSION = "client_viewer@org_mock_1";
    const { resolveTenantScope } = await freshSession();
    expect(await resolveTenantScope(undefined)).toBe("org_mock_1");
    // Caller-supplied id is ignored for tenant users — they always get scoped
    // to their session org.
    expect(await resolveTenantScope("org_mock_2")).toBe("org_mock_1");
  });

  test("resolveTenantScope: aj_admin honors caller-supplied id", async () => {
    const { resolveTenantScope } = await freshSession();
    expect(await resolveTenantScope("org_anything")).toBe("org_anything");
    expect(await resolveTenantScope(undefined)).toBeUndefined();
  });
});

describe("lib/auth/session.ts — Clerk path", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    const env = process.env as MutableEnv;
    delete env.RESPONSEOS_DEV_SESSION;
    delete env.NODE_ENV;
    delete env.CLERK_SECRET_KEY;
    delete env.AJ_DIGITAL_CLERK_ORG_ID;
    delete env.RESPONSEOS_REQUIRE_AUTH;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  const clientUser = {
    id: "user_db_1",
    account_id: "acct_db_1",
    email: "owner@sunshine-hvac.example",
    name: "Sunshine Owner",
    role: "client_admin",
    clerk_user_id: "clerk_user_1",
  };
  const clientAccount = {
    id: "acct_db_1",
    slug: "sunshine-hvac",
    name: "Sunshine HVAC",
    clerk_org_id: "org_clerk_client_1",
  };

  test("Clerk env absent preserves dev/mock session behavior", async () => {
    // No CLERK_SECRET_KEY → falls through to placeholder dev session.
    const { session, auth } = await loadClerkSession();
    const result = await session.getCurrentSession();
    expect(result?.user.role).toBe("aj_admin");
    expect(auth).not.toHaveBeenCalled();
  });

  test("RESPONSEOS_REQUIRE_AUTH does not disturb the Clerk path when Clerk is configured", async () => {
    process.env.RESPONSEOS_REQUIRE_AUTH = "1";
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    const { session, auth, userFindUnique, accountFindUnique } =
      await loadClerkSession();
    auth.mockResolvedValue({ userId: "clerk_user_1", orgId: "org_clerk_client_1" });
    userFindUnique.mockResolvedValue(clientUser);
    accountFindUnique.mockResolvedValue(clientAccount);

    const result = await session.getCurrentSession();
    expect(result?.user.role).toBe("client_admin");
    expect(result?.account?.id).toBe("acct_db_1");
  });

  test("explicit RESPONSEOS_DEV_SESSION wins over Clerk in non-production", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    process.env.RESPONSEOS_DEV_SESSION = "client_admin@org_mock_1";
    const { session, auth } = await loadClerkSession();
    const result = await session.getCurrentSession();
    expect(result?.user.role).toBe("client_admin");
    expect(result?.account?.id).toBe("org_mock_1");
    expect(auth).not.toHaveBeenCalled();
  });

  test("Clerk user with valid DB mapping resolves a tenant session", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    const { session, auth, userFindUnique, accountFindUnique } =
      await loadClerkSession();
    auth.mockResolvedValue({ userId: "clerk_user_1", orgId: "org_clerk_client_1" });
    userFindUnique.mockResolvedValue(clientUser);
    accountFindUnique.mockResolvedValue(clientAccount);

    const result = await session.getCurrentSession();
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { clerk_user_id: "clerk_user_1" },
    });
    expect(accountFindUnique).toHaveBeenCalledWith({
      where: { clerk_org_id: "org_clerk_client_1" },
    });
    expect(result?.user.id).toBe("user_db_1");
    expect(result?.user.role).toBe("client_admin");
    expect(result?.account?.id).toBe("acct_db_1");
    expect(result?.account?.slug).toBe("sunshine-hvac");
  });

  test("unauthenticated Clerk request resolves to null (no userId)", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    const { session, auth, userFindUnique } = await loadClerkSession();
    auth.mockResolvedValue({ userId: null, orgId: null });

    expect(await session.getCurrentSession()).toBeNull();
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  test("Clerk user without User.clerk_user_id mapping does not create a user", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    const { session, auth, userFindUnique, accountFindUnique } =
      await loadClerkSession();
    auth.mockResolvedValue({ userId: "clerk_unmapped", orgId: "org_clerk_client_1" });
    userFindUnique.mockResolvedValue(null);

    expect(await session.getCurrentSession()).toBeNull();
    expect(accountFindUnique).not.toHaveBeenCalled();
  });

  test("active org without Account.clerk_org_id mapping does not create an account", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    const { session, auth, userFindUnique, accountFindUnique } =
      await loadClerkSession();
    auth.mockResolvedValue({ userId: "clerk_user_1", orgId: "org_unmapped" });
    userFindUnique.mockResolvedValue(clientUser);
    accountFindUnique.mockResolvedValue(null);

    expect(await session.getCurrentSession()).toBeNull();
  });

  test("active org is preferred over the AJ control-org fallback", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    process.env.AJ_DIGITAL_CLERK_ORG_ID = "org_clerk_aj_control";
    const { session, auth, userFindUnique, accountFindUnique } =
      await loadClerkSession();
    // DB role is aj_admin but the user is actively scoped into a client org.
    auth.mockResolvedValue({ userId: "clerk_user_1", orgId: "org_clerk_client_1" });
    userFindUnique.mockResolvedValue({ ...clientUser, role: "aj_admin" });
    accountFindUnique.mockResolvedValue(clientAccount);

    const result = await session.getCurrentSession();
    // Active client org wins → tenant session, and aj_admin is NOT granted here.
    expect(result?.account?.id).toBe("acct_db_1");
    expect(result?.user.role).toBe("client_viewer");
  });

  test("does not reuse a tenant admin grant across orgs the user does not belong to", async () => {
    // DB client_admin of account A; Clerk reports an active org mapped to a
    // different account B. The session must NOT be granted for B.
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    const { session, auth, userFindUnique, accountFindUnique } =
      await loadClerkSession();
    auth.mockResolvedValue({ userId: "clerk_user_1", orgId: "org_clerk_client_2" });
    userFindUnique.mockResolvedValue({ ...clientUser, account_id: "acct_A" });
    accountFindUnique.mockResolvedValue({
      id: "acct_B",
      slug: "other-tenant",
      name: "Other Tenant",
      clerk_org_id: "org_clerk_client_2",
    });

    expect(await session.getCurrentSession()).toBeNull();
  });

  test("AJ control org → cross-tenant session with null account", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    process.env.AJ_DIGITAL_CLERK_ORG_ID = "org_clerk_aj_control";
    const { session, auth, userFindUnique, accountFindUnique } =
      await loadClerkSession();
    auth.mockResolvedValue({ userId: "clerk_aj", orgId: "org_clerk_aj_control" });
    userFindUnique.mockResolvedValue({
      id: "user_aj",
      email: "aj@responseos.example",
      name: "AJ Admin",
      role: "aj_admin",
      clerk_user_id: "clerk_aj",
    });

    const result = await session.getCurrentSession();
    expect(result?.user.role).toBe("aj_admin");
    expect(result?.account).toBeNull();
    expect(accountFindUnique).not.toHaveBeenCalled();
  });

  test("AJ control-org fallback applies only to control-plane DB users", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    process.env.AJ_DIGITAL_CLERK_ORG_ID = "org_clerk_aj_control";
    const { session, auth, userFindUnique, accountFindUnique } =
      await loadClerkSession();
    // No active org + control org configured: operator → control context.
    auth.mockResolvedValue({ userId: "clerk_op", orgId: null });
    userFindUnique.mockResolvedValue({
      id: "user_op",
      email: "operator@responseos.example",
      name: "AJ Operator",
      role: "operator",
      clerk_user_id: "clerk_op",
    });

    const result = await session.getCurrentSession();
    expect(result?.user.role).toBe("operator");
    expect(result?.account).toBeNull();
    expect(accountFindUnique).not.toHaveBeenCalled();
  });

  test("no active org + non-control user does not guess a tenant", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    process.env.AJ_DIGITAL_CLERK_ORG_ID = "org_clerk_aj_control";
    const { session, auth, userFindUnique, accountFindUnique } =
      await loadClerkSession();
    auth.mockResolvedValue({ userId: "clerk_user_1", orgId: null });
    userFindUnique.mockResolvedValue(clientUser);

    expect(await session.getCurrentSession()).toBeNull();
    expect(accountFindUnique).not.toHaveBeenCalled();
  });

  test("role mapping does not over-grant aj_admin in a client org", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    const { session, auth, userFindUnique, accountFindUnique } =
      await loadClerkSession();
    auth.mockResolvedValue({ userId: "clerk_user_1", orgId: "org_clerk_client_1" });
    userFindUnique.mockResolvedValue({ ...clientUser, role: "aj_admin" });
    accountFindUnique.mockResolvedValue(clientAccount);

    const result = await session.getCurrentSession();
    expect(result?.user.role).toBe("client_viewer");
  });

  test("client member (non-admin DB grant) caps at client_viewer", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    const { session, auth, userFindUnique, accountFindUnique } =
      await loadClerkSession();
    auth.mockResolvedValue({ userId: "clerk_user_1", orgId: "org_clerk_client_1" });
    userFindUnique.mockResolvedValue({ ...clientUser, role: "client_viewer" });
    accountFindUnique.mockResolvedValue(clientAccount);

    const result = await session.getCurrentSession();
    expect(result?.user.role).toBe("client_viewer");
  });

  test("public contract: getCurrentUser/getCurrentAccount/requireTenantScope work on a Clerk session", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    const { session, auth, userFindUnique, accountFindUnique } =
      await loadClerkSession();
    auth.mockResolvedValue({ userId: "clerk_user_1", orgId: "org_clerk_client_1" });
    userFindUnique.mockResolvedValue(clientUser);
    accountFindUnique.mockResolvedValue(clientAccount);

    const user = await session.getCurrentUser();
    expect(user?.id).toBe("user_db_1");
    const account = await session.getCurrentAccount();
    expect(account?.id).toBe("acct_db_1");
    await expect(session.requireTenantScope("acct_db_1")).resolves.toBeUndefined();
    await expect(session.requireTenantScope("other")).rejects.toBeInstanceOf(
      session.TenantScopeError,
    );
  });

  test("hard-throws in production when RESPONSEOS_DEV_SESSION is set, even with Clerk env", async () => {
    (process.env as MutableEnv).NODE_ENV = "production";
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    process.env.RESPONSEOS_DEV_SESSION = "aj_admin";
    const { session, auth } = await loadClerkSession();
    await expect(session.getCurrentSession()).rejects.toBeInstanceOf(
      session.DevSessionInProductionError,
    );
    expect(auth).not.toHaveBeenCalled();
  });
});
