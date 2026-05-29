import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Three-case tenant scope matrix per docs/v0.2-implementation-spec.md §7.
 * Exercised against every per-tenant accessor with mock-mode fallback so
 * no DB is required.
 *
 * 1. aj_admin reads across tenants → passes.
 * 2. client_admin of org A reads org A → passes.
 * 3. client_admin of org A reads org B → tenant_scope_denied.
 */

const ORIGINAL_ENV = { ...process.env };

type MutableEnv = Record<string, string | undefined>;

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
  const env = process.env as MutableEnv;
  delete env.DATABASE_URL;
  delete env.RESPONSEOS_DEV_SESSION;
  delete env.NODE_ENV;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function asAjAdmin() {
  // default session is aj_admin
  return import("@/lib/data/index");
}
async function asClientAdminOrg1() {
  process.env.RESPONSEOS_DEV_SESSION = "client_admin@org_mock_1";
  vi.resetModules();
  return import("@/lib/data/index");
}

// ---- contacts -----------------------------------------------------------
describe("listContacts tenant matrix", () => {
  test("aj_admin sees both org_mock_1 and org_mock_2 contacts", async () => {
    const { Contacts } = await asAjAdmin();
    const result = await Contacts.listContacts({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const orgs = new Set(result.data.map((c) => c.account_id));
    expect(orgs.has("org_mock_1")).toBe(true);
    expect(orgs.has("org_mock_2")).toBe(true);
  });

  test("client_admin of org_mock_1 only sees org_mock_1 contacts", async () => {
    const { Contacts } = await asClientAdminOrg1();
    const result = await Contacts.listContacts({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.data.every((c) => c.account_id === "org_mock_1"),
    ).toBe(true);
  });

  test("client_admin of org_mock_1 reading org_mock_2 → tenant_scope_denied", async () => {
    const { Contacts } = await asClientAdminOrg1();
    const result = await Contacts.listContacts({ accountId: "org_mock_2" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tenant_scope_denied");
  });
});

// ---- calls --------------------------------------------------------------
describe("listCalls tenant matrix", () => {
  test("aj_admin sees calls from both orgs", async () => {
    const { Calls } = await asAjAdmin();
    const result = await Calls.listCalls({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const orgs = new Set(result.data.map((c) => c.account_id));
    expect(orgs.has("org_mock_1")).toBe(true);
    expect(orgs.has("org_mock_2")).toBe(true);
  });

  test("client_admin only sees own org", async () => {
    const { Calls } = await asClientAdminOrg1();
    const result = await Calls.listCalls({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.data.every((c) => c.account_id === "org_mock_1"),
    ).toBe(true);
  });

  test("client_admin cross-tenant request denied", async () => {
    const { Calls } = await asClientAdminOrg1();
    const result = await Calls.listCalls({ accountId: "org_mock_2" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tenant_scope_denied");
  });
});

// ---- leads --------------------------------------------------------------
describe("listLeads tenant matrix", () => {
  test("aj_admin sees both orgs", async () => {
    const { Leads } = await asAjAdmin();
    const result = await Leads.listLeads({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const orgs = new Set(result.data.map((l) => l.account_id));
    expect(orgs.size).toBeGreaterThanOrEqual(2);
  });

  test("client_admin only sees own org", async () => {
    const { Leads } = await asClientAdminOrg1();
    const result = await Leads.listLeads({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.data.every((l) => l.account_id === "org_mock_1"),
    ).toBe(true);
  });

  test("client_admin cross-tenant request denied", async () => {
    const { Leads } = await asClientAdminOrg1();
    const result = await Leads.listLeads({ accountId: "org_mock_2" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tenant_scope_denied");
  });
});

// ---- bookings -----------------------------------------------------------
describe("listAppointments tenant matrix", () => {
  test("aj_admin sees both orgs", async () => {
    const { Appointments } = await asAjAdmin();
    const result = await Appointments.listAppointments({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const orgs = new Set(result.data.map((b) => b.account_id));
    expect(orgs.has("org_mock_1")).toBe(true);
    expect(orgs.has("org_mock_2")).toBe(true);
  });

  test("client_admin only sees own org", async () => {
    const { Appointments } = await asClientAdminOrg1();
    const result = await Appointments.listAppointments({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.data.every((b) => b.account_id === "org_mock_1"),
    ).toBe(true);
  });

  test("client_admin cross-tenant request denied", async () => {
    const { Appointments } = await asClientAdminOrg1();
    const result = await Appointments.listAppointments({ accountId: "org_mock_2" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tenant_scope_denied");
  });
});

// ---- quotes -------------------------------------------------------------
describe("listQuoteRequests tenant matrix", () => {
  test("aj_admin sees both orgs", async () => {
    const { Quotes } = await asAjAdmin();
    const result = await Quotes.listQuoteRequests({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const orgs = new Set(result.data.map((q) => q.account_id));
    expect(orgs.has("org_mock_1")).toBe(true);
    expect(orgs.has("org_mock_2")).toBe(true);
  });

  test("client_admin only sees own org", async () => {
    const { Quotes } = await asClientAdminOrg1();
    const result = await Quotes.listQuoteRequests({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.data.every((q) => q.account_id === "org_mock_1"),
    ).toBe(true);
  });

  test("client_admin cross-tenant request denied", async () => {
    const { Quotes } = await asClientAdminOrg1();
    const result = await Quotes.listQuoteRequests({ accountId: "org_mock_2" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tenant_scope_denied");
  });
});

// ---- revenueMetrics ------------------------------------------------------
describe("listRevenueMetrics tenant matrix", () => {
  test("aj_admin sees all rows", async () => {
    const { RevenueMetrics } = await asAjAdmin();
    const result = await RevenueMetrics.listRevenueMetrics({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBeGreaterThan(0);
  });

  test("client_admin only sees own org rows", async () => {
    const { RevenueMetrics } = await asClientAdminOrg1();
    const result = await RevenueMetrics.listRevenueMetrics({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.data.every((r) => r.account_id === "org_mock_1"),
    ).toBe(true);
  });

  test("client_admin cross-tenant request denied", async () => {
    const { RevenueMetrics } = await asClientAdminOrg1();
    const result = await RevenueMetrics.listRevenueMetrics({
      accountId: "org_mock_2",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tenant_scope_denied");
  });
});

// ---- organizations ------------------------------------------------------
describe("listAccounts tenant matrix", () => {
  test("aj_admin sees both orgs", async () => {
    const { Accounts } = await asAjAdmin();
    const result = await Accounts.listAccounts();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = new Set(result.data.map((o) => o.id));
    expect(ids.has("org_mock_1")).toBe(true);
    expect(ids.has("org_mock_2")).toBe(true);
  });

  test("client_admin only sees own org", async () => {
    const { Accounts } = await asClientAdminOrg1();
    const result = await Accounts.listAccounts();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBe(1);
    expect(result.data[0].id).toBe("org_mock_1");
  });

  test("client_admin cross-tenant getAccountById denied", async () => {
    const { Accounts } = await asClientAdminOrg1();
    const result = await Accounts.getAccountById("org_mock_2");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tenant_scope_denied");
  });
});
