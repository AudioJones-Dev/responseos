import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import {
  connectTestDb,
  resetTestDb,
  seedTestDb,
} from "./setup";

const ORG_A = "org_mock_1";
const ORG_B = "org_mock_2";

const scopedAccessors = [
  [
    "Organizations.getOrganizationById",
    () => Organizations.getOrganizationById(ORG_A),
    () => Organizations.getOrganizationById(ORG_B),
  ],
  [
    "Users.listUsers",
    () => Users.listUsers({ organizationId: ORG_A }),
    () => Users.listUsers({ organizationId: ORG_B }),
  ],
  [
    "Contacts.listContacts",
    () => Contacts.listContacts({ organizationId: ORG_A }),
    () => Contacts.listContacts({ organizationId: ORG_B }),
  ],
  [
    "Calls.listCalls",
    () => Calls.listCalls({ organizationId: ORG_A }),
    () => Calls.listCalls({ organizationId: ORG_B }),
  ],
  [
    "Leads.listLeads",
    () => Leads.listLeads({ organizationId: ORG_A }),
    () => Leads.listLeads({ organizationId: ORG_B }),
  ],
  [
    "LeadQualifications.getLeadQualificationByLeadId",
    () => LeadQualifications.getLeadQualificationByLeadId("lead_mock_2"),
    () => LeadQualifications.getLeadQualificationByLeadId("lead_mock_8"),
  ],
  [
    "Bookings.listBookings",
    () => Bookings.listBookings({ organizationId: ORG_A }),
    () => Bookings.listBookings({ organizationId: ORG_B }),
  ],
  [
    "Quotes.listQuoteRequests",
    () => Quotes.listQuoteRequests({ organizationId: ORG_A }),
    () => Quotes.listQuoteRequests({ organizationId: ORG_B }),
  ],
  [
    "Automations.listAutomations",
    () => Automations.listAutomations({ organizationId: ORG_A }),
    () => Automations.listAutomations({ organizationId: ORG_B }),
  ],
  [
    "Notifications.listNotifications",
    () => Notifications.listNotifications({ organizationId: ORG_A }),
    () => Notifications.listNotifications({ organizationId: ORG_B }),
  ],
  [
    "RevenueMetrics.listRevenueMetrics",
    () => RevenueMetrics.listRevenueMetrics({ organizationId: ORG_A }),
    () => RevenueMetrics.listRevenueMetrics({ organizationId: ORG_B }),
  ],
  [
    "Assessments.listAssessmentReports",
    () => Assessments.listAssessmentReports({ organizationId: ORG_A }),
    () => Assessments.listAssessmentReports({ organizationId: ORG_B }),
  ],
  [
    "Engagements.listEngagements",
    () => Engagements.listEngagements({ organizationId: ORG_A }),
    () => Engagements.listEngagements({ organizationId: ORG_B }),
  ],
  [
    "AuditLogs.listAuditLogs",
    () => AuditLogs.listAuditLogs({ organizationId: ORG_A }),
    () => AuditLogs.listAuditLogs({ organizationId: ORG_B }),
  ],
] as const;

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
} from "@/lib/data";

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

describe.each(scopedAccessors)("%s tenant matrix", (_name, callOrgA, callOrgB) => {
  test("aj_admin reads across tenants", async () => {
    process.env.RESPONSEOS_DEV_SESSION = "aj_admin";

    const result = await callOrgB();

    expect(result.ok).toBe(true);
  });

  test("client_admin of org A reads org A", async () => {
    process.env.RESPONSEOS_DEV_SESSION = "client_admin@org_mock_1";

    const result = await callOrgA();

    expect(result.ok).toBe(true);
  });

  test("client_admin of org A reading org B is denied", async () => {
    process.env.RESPONSEOS_DEV_SESSION = "client_admin@org_mock_1";

    const result = await callOrgB();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("tenant_scope_denied");
  });
});
