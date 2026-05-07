import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function freshSession() {
  vi.resetModules();
  return await import("@/lib/auth/session");
}

type MutableEnv = Record<string, string | undefined>;

describe("lib/auth/session.ts", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    const env = process.env as MutableEnv;
    delete env.RESPONSEOS_DEV_SESSION;
    delete env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  test("default session resolves to aj_admin (no env vars)", async () => {
    const { getCurrentSession } = await freshSession();
    const session = await getCurrentSession();
    expect(session?.user.role).toBe("aj_admin");
    expect(session?.organization).toBeNull();
  });

  test("RESPONSEOS_DEV_SESSION=client_admin@org_mock_1 yields tenant session", async () => {
    process.env.RESPONSEOS_DEV_SESSION = "client_admin@org_mock_1";
    const { getCurrentSession, getCurrentOrganization } = await freshSession();
    const session = await getCurrentSession();
    expect(session?.user.role).toBe("client_admin");
    expect(session?.organization?.id).toBe("org_mock_1");
    const org = await getCurrentOrganization();
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
