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
  Organizations,
  Quotes,
  RevenueMetrics,
  Users,
} from "@/lib/data";
import { disconnectTestDb, resetAndSeedTestDb, setDevSession } from "./setup";

type TenantResult = Promise<
  | { ok: true; data: Array<{ organization_id?: string | null; id?: string }> | { organization_id?: string | null; id?: string } | null }
  | { ok: false; error: { code: string } }
>;

const listCases: Array<{
  name: string;
  read: (organizationId?: string) => TenantResult;
}> = [
  { name: "listAssessmentReports", read: (organizationId) => Assessments.listAssessmentReports({ organizationId }) },
  { name: "listAuditLogs", read: (organizationId) => AuditLogs.listAuditLogs({ organizationId }) },
  { name: "listAutomations", read: (organizationId) => Automations.listAutomations({ organizationId }) },
  { name: "listBookings", read: (organizationId) => Bookings.listBookings({ organizationId }) },
  { name: "listCalls", read: (organizationId) => Calls.listCalls({ organizationId }) },
  { name: "listContacts", read: (organizationId) => Contacts.listContacts({ organizationId }) },
  { name: "listEngagements", read: (organizationId) => Engagements.listEngagements({ organizationId }) },
  { name: "listLeads", read: (organizationId) => Leads.listLeads({ organizationId }) },
  { name: "listNotifications", read: (organizationId) => Notifications.listNotifications({ organizationId }) },
  { name: "listQuoteRequests", read: (organizationId) => Quotes.listQuoteRequests({ organizationId }) },
  { name: "listRevenueMetrics", read: (organizationId) => RevenueMetrics.listRevenueMetrics({ organizationId }) },
  { name: "getCurrentRevenueMetrics", read: (organizationId) => RevenueMetrics.getCurrentRevenueMetrics({ organizationId }) },
  { name: "listUsers", read: (organizationId) => Users.listUsers({ organizationId }) },
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
    expect(rows.every((row) => row.organization_id === "org_mock_1" || row.id === "org_mock_1")).toBe(true);
  });

  test("client_admin cannot read another tenant", async () => {
    setDevSession("client_admin@org_mock_1");
    const result = await read("org_mock_2");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tenant_scope_denied");
  });
});

describe("organization read tenant matrix", () => {
  test("aj_admin reads across tenants", async () => {
    setDevSession("aj_admin");
    const result = await Organizations.listOrganizations();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new Set(result.data.map((org) => org.id))).toEqual(new Set(["org_mock_1", "org_mock_2"]));
  });

  test("client_admin reads own tenant", async () => {
    setDevSession("client_admin@org_mock_1");
    const result = await Organizations.getOrganizationById("org_mock_1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe("org_mock_1");
  });

  test("client_admin cannot read another tenant", async () => {
    setDevSession("client_admin@org_mock_1");
    const result = await Organizations.getOrganizationById("org_mock_2");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tenant_scope_denied");
  });
});
