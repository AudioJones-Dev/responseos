import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import {
  Bookings,
  Calls,
  Contacts,
  Leads,
  Organizations,
  Quotes,
  RevenueMetrics,
} from "@/lib/data";
import { getMockBookings } from "@/lib/mock/bookings";
import { getMockCalls } from "@/lib/mock/calls";
import { getMockContacts } from "@/lib/mock/contacts";
import { getMockLeadEvents } from "@/lib/mock/leads";
import { getMockOrganizations } from "@/lib/mock/organizations";
import { getMockQuoteRequests } from "@/lib/mock/quotes";
import { getMockRevenueMetrics } from "@/lib/mock/revenueMetrics";
import {
  connectTestDb,
  resetTestDb,
  seedTestDb,
} from "./setup";

type Row = Record<string, unknown>;

const TABLES_WITH_STRICT_MOCK_PARITY = [
  {
    name: "organizations",
    listDb: () => Organizations.listOrganizations(),
    listMock: getMockOrganizations,
    fields: [
      "id",
      "name",
      "slug",
      "industry",
      "website_url",
      "primary_phone",
      "timezone",
      "status",
    ],
  },
  {
    name: "contacts",
    listDb: () => Contacts.listContacts({}),
    listMock: getMockContacts,
    fields: [
      "id",
      "organization_id",
      "first_name",
      "last_name",
      "phone",
      "email",
      "city",
      "state",
      "zip",
      "source",
    ],
  },
  {
    name: "calls",
    listDb: () => Calls.listCalls({}),
    listMock: getMockCalls,
    fields: [
      "id",
      "organization_id",
      "contact_id",
      "provider",
      "direction",
      "status",
      "from_number",
      "to_number",
      "started_at",
      "ended_at",
      "duration_seconds",
      "transcript",
      "summary",
      "sentiment",
      "spam_score",
      "lead_score",
    ],
  },
  {
    name: "lead events",
    listDb: () => Leads.listLeads({}),
    listMock: getMockLeadEvents,
    fields: [
      "id",
      "organization_id",
      "contact_id",
      "call_id",
      "source",
      "event_type",
      "status",
      "urgency",
      "estimated_value",
      "recovered_value",
      "notes",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "quote requests",
    listDb: () => Quotes.listQuoteRequests({}),
    listMock: getMockQuoteRequests,
    fields: [
      "id",
      "organization_id",
      "contact_id",
      "lead_event_id",
      "service_type",
      "description",
      "property_address",
      "estimated_value",
      "status",
    ],
  },
  {
    name: "revenue metrics",
    listDb: () => RevenueMetrics.listRevenueMetrics({}),
    listMock: getMockRevenueMetrics,
    fields: [
      "id",
      "organization_id",
      "period_start",
      "period_end",
      "total_calls",
      "missed_calls",
      "calls_answered_by_ai",
      "qualified_leads",
      "appointments_booked",
      "quotes_requested",
      "quotes_sent",
      "jobs_won",
      "estimated_recovered_revenue",
      "verified_recovered_revenue",
      "admin_hours_saved",
      "response_time_avg_seconds",
      "roi_multiple",
    ],
  },
] as const;

function project(rows: Row[], fields: readonly string[]): Row[] {
  return [...rows]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((row) =>
      Object.fromEntries(fields.map((field) => [field, row[field] ?? undefined])),
    );
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

describe.each(TABLES_WITH_STRICT_MOCK_PARITY)("$name", (fixture) => {
  test("seeded rows match mock fixture fields", async () => {
    const dbRows = await fixture.listDb();
    expect(dbRows.ok).toBe(true);
    if (!dbRows.ok) return;

    expect(project(dbRows.data as unknown as Row[], fixture.fields)).toEqual(
      project(fixture.listMock() as unknown as Row[], fixture.fields),
    );
  });
});

test("bookings keep deterministic ids and stable business fields", async () => {
  const dbRows = await Bookings.listBookings({});
  expect(dbRows.ok).toBe(true);
  if (!dbRows.ok) return;

  expect(
    project(dbRows.data as unknown as Row[], [
      "id",
      "organization_id",
      "contact_id",
      "lead_event_id",
      "calendar_provider",
      "title",
      "status",
      "location",
    ]),
  ).toEqual(
    project(getMockBookings() as unknown as Row[], [
      "id",
      "organization_id",
      "contact_id",
      "lead_event_id",
      "calendar_provider",
      "title",
      "status",
      "location",
    ]),
  );
});
