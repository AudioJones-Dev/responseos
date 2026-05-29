import { afterAll, beforeEach, describe, expect, test } from "vitest";
import {
  Assessments,
  AuditLogs,
  Automations,
  Bookings,
  Calls,
  Contacts,
  Engagements,
  LeadQualifications,
  Leads,
  Notifications,
  Accounts,
  Quotes,
  RevenueMetrics,
  Users,
  WebhookEvents,
} from "@/lib/data";
import { disconnectTestDb, prisma, resetAndSeedTestDb, setDevSession } from "./setup";

describe("data accessors against Postgres", () => {
  beforeEach(async () => {
    await resetAndSeedTestDb();
    setDevSession("aj_admin");
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  test("account accessors list and fetch seeded tenants", async () => {
    const list = await Accounts.listAccounts();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((org) => org.id)).toEqual(["org_mock_1", "org_mock_2"]);

    const found = await Accounts.getAccountById("org_mock_1");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data.slug).toBe("sunshine-hvac");
  });

  test("user accessors list and fetch users", async () => {
    const list = await Users.listUsers({ accountId: "org_mock_1" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((user) => user.id)).toEqual(["user_acme_owner_1", "user_acme_viewer_1"]);

    const found = await Users.getUserById("user_acme_owner_1");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data.role).toBe("client_admin");
  });

  test("contact accessors list and fetch contacts", async () => {
    const list = await Contacts.listContacts({ accountId: "org_mock_1" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data).toHaveLength(2);

    const found = await Contacts.getContactById("contact_mock_1");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data.email).toBe("jordan.reyes@example.com");
  });

  test("call accessors preserve default ordering and fetch calls", async () => {
    const list = await Calls.listCalls({ accountId: "org_mock_1" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((call) => call.id)).toEqual(["call_mock_3", "call_mock_2", "call_mock_1"]);

    const found = await Calls.getCallById("call_mock_2");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data.summary).toContain("AC quote request");
  });

  test("lead accessors list and fetch leads", async () => {
    const list = await Leads.listLeads({ accountId: "org_mock_1" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data[0].id).toBe("lead_mock_11");

    const found = await Leads.getLeadById("lead_mock_2");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data.status).toBe("qualified");
  });

  test("lead qualification accessor fetches by lead id", async () => {
    const result = await LeadQualifications.getLeadQualificationByLeadId("lead_mock_2");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.qualification_status).toBe("qualified");
  });

  test("booking accessors list and fetch bookings", async () => {
    const list = await Bookings.listBookings({ accountId: "org_mock_1" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((booking) => booking.id)).toEqual(["booking_mock_1"]);

    const found = await Bookings.getBookingById("booking_mock_1");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data.status).toBe("confirmed");
  });

  test("quote accessors list and fetch quote requests", async () => {
    const list = await Quotes.listQuoteRequests({ accountId: "org_mock_2" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((quote) => quote.id)).toEqual(["quote_mock_2"]);

    const found = await Quotes.getQuoteRequestById("quote_mock_2");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data.service_type).toBe("Roof replacement");
  });

  test("automation and notification list accessors read seeded rows", async () => {
    const automations = await Automations.listAutomations({ accountId: "org_mock_1" });
    expect(automations.ok).toBe(true);
    if (!automations.ok) return;
    expect(Array.isArray(automations.data)).toBe(true);

    const notifications = await Notifications.listNotifications({ accountId: "org_mock_1" });
    expect(notifications.ok).toBe(true);
    if (!notifications.ok) return;
    expect(Array.isArray(notifications.data)).toBe(true);
  });

  test("revenue metric accessors list and fetch current metrics", async () => {
    const list = await RevenueMetrics.listRevenueMetrics({ accountId: "org_mock_1" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((row) => row.id)).toEqual(["rev_mock_current", "rev_mock_prev_1", "rev_mock_prev_2"]);

    const current = await RevenueMetrics.getCurrentRevenueMetrics({ accountId: "org_mock_1" });
    expect(current.ok).toBe(true);
    if (!current.ok) return;
    expect(current.data?.id).toBe("rev_mock_current");
  });

  test("assessment and engagement accessors list and fetch v0.2 records", async () => {
    const assessments = await Assessments.listAssessmentReports({ accountId: "org_mock_1" });
    expect(assessments.ok).toBe(true);
    if (!assessments.ok) return;
    expect(assessments.data.map((assessment) => assessment.id)).toEqual(["assessment_mock_1"]);

    const assessment = await Assessments.getAssessmentReportById("assessment_mock_1");
    expect(assessment.ok).toBe(true);
    if (!assessment.ok) return;
    expect(assessment.data.readiness_score).toBe(72);

    const engagements = await Engagements.listEngagements({ accountId: "org_mock_1" });
    expect(engagements.ok).toBe(true);
    if (!engagements.ok) return;
    expect(engagements.data.map((engagement) => engagement.id)).toEqual(["engagement_mock_1"]);

    const engagement = await Engagements.getEngagementById("engagement_mock_1");
    expect(engagement.ok).toBe(true);
    if (!engagement.ok) return;
    expect(engagement.data.assessment_report_id).toBe("assessment_mock_1");
  });

  test("audit log accessors record and list rows", async () => {
    const recorded = await AuditLogs.recordAuditLog({
      account_id: "org_mock_1",
      actor_user_id: "user_aj_admin_1",
      actor_type: "user",
      action: "integration.audit.recorded",
      target_type: "LeadEvent",
      target_id: "lead_mock_2",
      metadata_json: { before: "new", after: "qualified" },
      ip_address: "127.0.0.1",
      user_agent: "vitest",
    });
    expect(recorded).toEqual({ ok: true, data: { recorded: true } });

    const list = await AuditLogs.listAuditLogs({ accountId: "org_mock_1", action: "integration.audit.recorded" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data).toHaveLength(1);
    expect(list.data[0]).toMatchObject({ action: "integration.audit.recorded", target_id: "lead_mock_2" });
  });

  test("webhook event accessors compute hashes, record idempotently, and list rows", async () => {
    const hash = WebhookEvents.computeDedupeHash("twilio", "event_test_001");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);

    const first = await WebhookEvents.recordWebhookEvent({
      account_id: "org_mock_1",
      provider: "twilio",
      provider_event_id: "event_test_001",
      event_type: "call.completed",
      raw_body: JSON.stringify({ id: "event_test_001" }),
      signature_header: "signature",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.process_status).toBe("received");

    const duplicate = await WebhookEvents.recordWebhookEvent({
      provider: "twilio",
      provider_event_id: "event_test_001",
      event_type: "call.completed",
      raw_body: "{}",
    });
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) return;
    expect(duplicate.data).toEqual({ id: first.data.id, process_status: "duplicate" });

    const list = await WebhookEvents.listWebhookEvents({ provider: "twilio" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((event) => event.id)).toContain(first.data.id);

    expect(await prisma.webhookEvent.count({ where: { dedupe_hash: hash } })).toBe(1);
  });
});
