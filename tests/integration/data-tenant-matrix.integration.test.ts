import { afterAll, beforeEach, describe, expect, test } from "vitest";
import {
  Assessments,
  AuditLogs,
  Automations,
  Appointments,
  Calls,
  CallSegments,
  CallTranscripts,
  Contacts,
  Conversations,
  Engagements,
  Leads,
  Notifications,
  Accounts,
  ProviderConnections,
  QaLogs,
  Quotes,
  RevenueMetrics,
  SmsMessages,
  Users,
  WorkflowRuns,
} from "@/lib/data";
import { disconnectTestDb, prisma, resetAndSeedTestDb, setDevSession } from "./setup";

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
  { name: "listAppointments", read: (accountId) => Appointments.listAppointments({ accountId }) },
  { name: "listCalls", read: (accountId) => Calls.listCalls({ accountId }) },
  { name: "listContacts", read: (accountId) => Contacts.listContacts({ accountId }) },
  { name: "listEngagements", read: (accountId) => Engagements.listEngagements({ accountId }) },
  { name: "listLeads", read: (accountId) => Leads.listLeads({ accountId }) },
  { name: "listNotifications", read: (accountId) => Notifications.listNotifications({ accountId }) },
  { name: "listQuoteRequests", read: (accountId) => Quotes.listQuoteRequests({ accountId }) },
  { name: "listRevenueMetrics", read: (accountId) => RevenueMetrics.listRevenueMetrics({ accountId }) },
  { name: "getCurrentRevenueMetrics", read: (accountId) => RevenueMetrics.getCurrentRevenueMetrics({ accountId }) },
  { name: "listUsers", read: (accountId) => Users.listUsers({ accountId }) },
  // v0.2-closeout models — seeded for org_mock_1 (conv_mock_1, call_mock_2).
  { name: "listConversations", read: (accountId) => Conversations.listConversations({ accountId }) },
  { name: "listProviderConnections", read: (accountId) => ProviderConnections.listProviderConnections({ accountId }) },
  { name: "listWorkflowRuns", read: (accountId) => WorkflowRuns.listWorkflowRuns({ accountId }) },
  { name: "listSmsMessagesByConversation", read: (accountId) => SmsMessages.listSmsMessagesByConversation({ accountId: accountId as string, conversationId: "conv_mock_1" }) },
  { name: "listCallSegmentsByCall", read: (accountId) => CallSegments.listCallSegmentsByCall({ accountId: accountId as string, callId: "call_mock_2" }) },
  { name: "listQaLogsByCall", read: (accountId) => QaLogs.listQaLogsByCall({ accountId: accountId as string, callId: "call_mock_2" }) },
  { name: "getCallTranscriptByCall", read: (accountId) => CallTranscripts.getCallTranscriptByCall({ accountId: accountId as string, callId: "call_mock_2" }) },
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
    expect(new Set(result.data.map((org) => org.id))).toEqual(
      new Set(["org_mock_1", "org_mock_2", "org_tyrone_1"]),
    );
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

// The v0.2-closeout substrate accessors enforce isolation on by-id reads with
// an inline scope check (not the listCases withTenantScope path). Cover it.
describe("by-id inline tenant guards (v0.2-closeout substrate)", () => {
  test("client_admin reads own conversation by id", async () => {
    setDevSession("client_admin@org_mock_1");
    const result = await Conversations.getConversationById("conv_mock_1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.account_id).toBe("org_mock_1");
  });

  test("client_admin cannot read another tenant's conversation by id", async () => {
    setDevSession("client_admin@org_mock_1");
    const result = await Conversations.getConversationById("conv_mock_2");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tenant_scope_denied");
  });

  test("client_admin cannot read another tenant's workflow run by id", async () => {
    setDevSession("client_admin@org_mock_1");
    const result = await WorkflowRuns.getWorkflowRunByRunId("n8n_run_mock_2");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tenant_scope_denied");
  });

  test("aj_admin reads any tenant's conversation by id", async () => {
    setDevSession("aj_admin");
    const result = await Conversations.getConversationById("conv_mock_2");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.account_id).toBe("org_mock_2");
  });
});

// A tenant passing their OWN accountId together with a child id (conversation
// / call) owned by ANOTHER tenant must get empty/denied — never the foreign
// rows. conv_mock_2 has org_mock_2 SMS in the seed; call_mock_4 (org_mock_2)
// gets org_mock_2-owned children inserted below so the exclusion actually bites.
describe("foreign child id under own account scope", () => {
  beforeEach(async () => {
    await prisma.callSegment.create({
      data: {
        account_id: "org_mock_2",
        call_id: "call_mock_4",
        sequence: 1,
        speaker: "caller",
        text: "foreign-tenant segment",
        started_at: new Date("2026-01-01T00:00:00Z"),
        ended_at: new Date("2026-01-01T00:00:05Z"),
      },
    });
    await prisma.qaLog.create({
      data: {
        account_id: "org_mock_2",
        call_id: "call_mock_4",
        rubric_version: "v1",
        reviewer_type: "human",
        findings_json: {},
        reviewed_at: new Date("2026-01-01T00:00:00Z"),
      },
    });
    await prisma.callTranscript.create({
      data: {
        account_id: "org_mock_2",
        call_id: "call_mock_4",
        inline_text: "foreign-tenant transcript",
      },
    });
  });

  test("listSmsMessagesByConversation excludes another tenant's conversation", async () => {
    setDevSession("client_admin@org_mock_1");
    const result = await SmsMessages.listSmsMessagesByConversation({
      accountId: "org_mock_1",
      conversationId: "conv_mock_2",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  test("listCallSegmentsByCall excludes another tenant's call", async () => {
    setDevSession("client_admin@org_mock_1");
    const result = await CallSegments.listCallSegmentsByCall({
      accountId: "org_mock_1",
      callId: "call_mock_4",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  test("listQaLogsByCall excludes another tenant's call", async () => {
    setDevSession("client_admin@org_mock_1");
    const result = await QaLogs.listQaLogsByCall({
      accountId: "org_mock_1",
      callId: "call_mock_4",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  test("getCallTranscriptByCall denies another tenant's call, never leaks it", async () => {
    setDevSession("client_admin@org_mock_1");
    const result = await CallTranscripts.getCallTranscriptByCall({
      accountId: "org_mock_1",
      callId: "call_mock_4",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tenant_scope_denied");
  });
});
