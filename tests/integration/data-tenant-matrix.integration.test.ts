import { afterAll, beforeEach, describe, expect, test } from "vitest";
import {
  Assessments,
  AuditLogs,
  Automations,
  Bookings,
  Calls,
  Contacts,
  Engagements,
  Leads,
  Notifications,
  Accounts,
  Quotes,
  RevenueMetrics,
  Users,
} from "@/lib/data";
import { disconnectTestDb, resetAndSeedTestDb, setDevSession } from "./setup";

type TenantResult = Promise<
  | { ok: true; data: Array<{ account_id?: string | null; id?: string }> | { account_id?: string | null; id?: string } | null }
  | { ok: false; error: { code: string } }
>;

const listCases: Array<{
  name: string;
  read: (accountId?: string) => TenantResult;
}> = [
  { name: "listAssessmentReports", read: (accountId) => Assessments.listAssessmentReports({ accountId }) },
  { name: "listAuditLogs", read: (accountId) => AuditLogs.listAuditLogs({ accountId }) },
  { name: "listAutomations", read: (accountId) => Automations.listAutomations({ accountId }) },
  { name: "listBookings", read: (accountId) => Bookings.listBookings({ accountId }) },
  { name: "listCalls", read: (accountId) => Calls.listCalls({ accountId }) },
  { name: "listContacts", read: (accountId) => Contacts.listContacts({ accountId }) },
  { name: "listEngagements", read: (accountId) => Engagements.listEngagements({ accountId }) },
  { name: "listLeads", read: (accountId) => Leads.listLeads({ accountId }) },
  { name: "listNotifications", read: (accountId) => Notifications.listNotifications({ accountId }) },
  { name: "listQuoteRequests", read: (accountId) => Quotes.listQuoteRequests({ accountId }) },
  { name: "listRevenueMetrics", read: (accountId) => RevenueMetrics.listRevenueMetrics({ accountId }) },
  { name: "getCurrentRevenueMetrics", read: (accountId) => RevenueMetrics.getCurrentRevenueMetrics({ accountId }) },
  { name: "listUsers", read: (accountId) => Users.listUsers({ accountId }) },
];

beforeEach(async () => {
  await resetAndSeedTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe.each(listCases)("$name tenant matrix", ({ read }) => {
  test("aj_admin reads across tenants", async () => {
    setDevSession("aj_admin");
    const result = await read();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
  });

  test("client_admin reads own tenant", async () => {
    setDevSession("client_admin@org_mock_1");
    const result = await read("org_mock_1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    expect(rows.every((row) => row.account_id === "org_mock_1" || row.id === "org_mock_1")).toBe(true);
  });

  test("client_admin cannot read another tenant", async () => {
    setDevSession("client_admin@org_mock_1");
    const result = await read("org_mock_2");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tenant_scope_denied");
  });
});

describe("account read tenant matrix", () => {
  test("aj_admin reads across tenants", async () => {
    setDevSession("aj_admin");
    const result = await Accounts.listAccounts();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new Set(result.data.map((org) => org.id))).toEqual(new Set(["org_mock_1", "org_mock_2"]));
  });

  test("client_admin reads own tenant", async () => {
    setDevSession("client_admin@org_mock_1");
    const result = await Accounts.getAccountById("org_mock_1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe("org_mock_1");
  });

  test("client_admin cannot read another tenant", async () => {
    setDevSession("client_admin@org_mock_1");
    const result = await Accounts.getAccountById("org_mock_2");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tenant_scope_denied");
  });
});
