import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
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
  Organizations,
  Quotes,
  RevenueMetrics,
  Users,
  WebhookEvents,
} from "@/lib/data";
import {
  connectTestDb,
  resetTestDb,
  seedTestDb,
} from "./setup";

function expectOk<T>(result: { ok: true; data: T } | { ok: false; error: unknown }): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Expected ok result: ${JSON.stringify(result.error)}`);
  return result.data;
}

beforeAll(async () => {
  await connectTestDb();
});

beforeEach(async () => {
  process.env.RESPONSEOS_DEV_SESSION = "aj_admin";
  await resetTestDb();
  seedTestDb();
});

afterAll(() => {
  delete process.env.RESPONSEOS_DEV_SESSION;
});

describe("real-DB positive paths for data accessors", () => {
  test("organization and user accessors read deterministic seed rows", async () => {
    const organizations = expectOk(await Organizations.listOrganizations());
    expect(organizations.map((org) => org.id)).toEqual([
      "org_mock_1",
      "org_mock_2",
    ]);

    const org = expectOk(await Organizations.getOrganizationById("org_mock_1"));
    expect(org.slug).toBe("sunshine-hvac");

    const users = expectOk(await Users.listUsers({ organizationId: "org_mock_1" }));
    expect(users.map((user) => user.id)).toContain("user_acme_owner_1");

    const user = expectOk(await Users.getUserById("user_acme_owner_1"));
    expect(user.organization_id).toBe("org_mock_1");
  });

  test("contact, call, lead, qualification, booking, and quote accessors compose over seeded rows", async () => {
    const contacts = expectOk(await Contacts.listContacts({ organizationId: "org_mock_1" }));
    expect(contacts).toHaveLength(2);
    expect(expectOk(await Contacts.getContactById("contact_mock_1")).phone).toBe(
      "+15555550199",
    );

    const calls = expectOk(await Calls.listCalls({ organizationId: "org_mock_1" }));
    expect(calls[0]?.id).toBe("call_mock_3");
    expect(expectOk(await Calls.getCallById("call_mock_2")).lead_score).toBe(84);

    const leads = expectOk(
      await Leads.listLeads({ organizationId: "org_mock_1", status: "qualified" }),
    );
    expect(leads.map((lead) => lead.id)).toEqual([
      "lead_mock_11",
      "lead_mock_6",
      "lead_mock_2",
    ]);
    expect(expectOk(await Leads.getLeadById("lead_mock_3")).status).toBe("booked");

    const qualification = expectOk(
      await LeadQualifications.getLeadQualificationByLeadId("lead_mock_2"),
    );
    expect(qualification?.qualification_score).toBe(84);

    const bookings = expectOk(await Bookings.listBookings({ organizationId: "org_mock_1" }));
    expect(bookings[0]?.id).toBe("booking_mock_1");
    expect(expectOk(await Bookings.getBookingById("booking_mock_1")).status).toBe(
      "confirmed",
    );

    const quotes = expectOk(await Quotes.listQuoteRequests({ organizationId: "org_mock_1" }));
    expect(quotes[0]?.id).toBe("quote_mock_1");
    expect(expectOk(await Quotes.getQuoteRequestById("quote_mock_1")).status).toBe(
      "reviewing",
    );
  });

  test("v0.2 assessment, engagement, audit, webhook, and reporting accessors read/write correctly", async () => {
    expectOk(await Automations.listAutomations({ organizationId: "org_mock_1" }));
    expectOk(await Notifications.listNotifications({ organizationId: "org_mock_1" }));

    const metrics = expectOk(
      await RevenueMetrics.listRevenueMetrics({ organizationId: "org_mock_1" }),
    );
    expect(metrics.map((metric) => metric.id)).toEqual([
      "rev_mock_current",
      "rev_mock_prev_1",
      "rev_mock_prev_2",
    ]);
    expect(
      expectOk(await RevenueMetrics.getCurrentRevenueMetrics({ organizationId: "org_mock_1" }))
        ?.id,
    ).toBe("rev_mock_current");

    const assessments = expectOk(
      await Assessments.listAssessmentReports({ organizationId: "org_mock_1" }),
    );
    expect(assessments[0]?.id).toBe("assessment_mock_1");
    expect(expectOk(await Assessments.getAssessmentReportById("assessment_mock_1")).status).toBe(
      "signed",
    );

    const engagements = expectOk(
      await Engagements.listEngagements({ organizationId: "org_mock_1" }),
    );
    expect(engagements[0]?.id).toBe("engagement_mock_1");
    expect(expectOk(await Engagements.getEngagementById("engagement_mock_1")).tier).toBe(
      "recovery_pro",
    );

    const recorded = expectOk(
      await AuditLogs.recordAuditLog({
        organization_id: "org_mock_1",
        actor_user_id: "user_aj_admin_1",
        actor_type: "user",
        action: "integration.audit_recorded",
        target_type: "LeadEvent",
        target_id: "lead_mock_2",
        metadata_json: { suite: "data-accessors" },
      }),
    );
    expect(recorded.recorded).toBe(true);
    const auditLogs = expectOk(
      await AuditLogs.listAuditLogs({
        organizationId: "org_mock_1",
        action: "integration.audit_recorded",
      }),
    );
    expect(auditLogs[0]).toMatchObject({
      action: "integration.audit_recorded",
      target_id: "lead_mock_2",
    });

    const webhook = expectOk(
      await WebhookEvents.recordWebhookEvent({
        organization_id: "org_mock_1",
        provider: "twilio",
        provider_event_id: "evt_integration_1",
        event_type: "call.status",
        raw_body: "{}",
      }),
    );
    expect(webhook.process_status).toBe("received");
    expect(
      expectOk(
        await WebhookEvents.recordWebhookEvent({
          organization_id: "org_mock_1",
          provider: "twilio",
          provider_event_id: "evt_integration_1",
          event_type: "call.status",
          raw_body: "{}",
        }),
      ).process_status,
    ).toBe("duplicate");
    const webhooks = expectOk(await WebhookEvents.listWebhookEvents({ provider: "twilio" }));
    expect(webhooks[0]).toMatchObject({
      id: webhook.id,
      process_status: "received",
    });
  });
});
