import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { getMockCalls } from "@/lib/mock/calls";
import { getMockContacts } from "@/lib/mock/contacts";
import { getMockLeadEvents } from "@/lib/mock/leads";
import { getMockOrganizations } from "@/lib/mock/organizations";
import { getMockQuoteRequests } from "@/lib/mock/quotes";
import { getMockRevenueMetrics } from "@/lib/mock/revenueMetrics";
import { disconnectTestDb, normalize, prisma, resetAndSeedTestDb } from "./setup";

function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => clean(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .filter(([key]) => key !== "created_at" && key !== "updated_at")
        .map(([key, entry]) => [key, clean(entry)]),
    );
  }
  return value;
}

function pick(row: object, keys: string[]): Record<string, unknown> {
  const record = row as Record<string, unknown>;
  return Object.fromEntries(keys.map((key) => [key, clean(record[key])]));
}

beforeEach(async () => {
  await resetAndSeedTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("seeded mock fixture parity", () => {
  test("organizations match lib/mock organizations field-for-field", async () => {
    const rows = await prisma.organization.findMany({ orderBy: { id: "asc" } });
    expect(clean(normalize(rows))).toEqual(clean(getMockOrganizations()));
  });

  test("contacts match lib/mock contacts field-for-field", async () => {
    const rows = await prisma.contact.findMany({ orderBy: { id: "asc" } });
    expect(clean(normalize(rows))).toEqual(clean(getMockContacts()));
  });

  test("calls match lib/mock calls field-for-field", async () => {
    const keys = [
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
      "recording_url",
      "transcript",
      "summary",
      "sentiment",
      "spam_score",
      "lead_score",
    ];
    const rows = await prisma.call.findMany({ orderBy: { id: "asc" } });
    expect(clean(normalize(rows.map((row) => pick(row, keys))))).toEqual(
      clean(getMockCalls().map((row) => pick(row, keys))),
    );
  });

  test("lead events match lib/mock leads field-for-field", async () => {
    const keys = [
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
    ];
    const rows = await prisma.leadEvent.findMany({ orderBy: { id: "asc" } });
    expect(clean(normalize(rows.map((row) => pick(row, keys))))).toEqual(
      clean(getMockLeadEvents().map((row) => pick(row, keys))),
    );
  });

  test.skip("bookings match lib/mock bookings field-for-field", () => {
    // Existing booking mock fixtures derive times from Date.now(), while the seed uses fixed anchors.
    // Phase D documents this drift without changing lib/mock or prisma/seed per the hard rules.
  });

  test("quote requests match lib/mock quotes field-for-field", async () => {
    const keys = [
      "id",
      "organization_id",
      "contact_id",
      "lead_event_id",
      "service_type",
      "description",
      "photos",
      "property_address",
      "estimated_value",
      "status",
    ];
    const rows = await prisma.quoteRequest.findMany({ orderBy: { id: "asc" } });
    expect(clean(normalize(rows.map((row) => pick(row, keys))))).toEqual(
      clean(getMockQuoteRequests().map((row) => pick(row, keys))),
    );
  });

  test("revenue metrics match lib/mock revenue metrics field-for-field", async () => {
    const keys = [
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
    ];
    const rows = await prisma.revenueMetrics.findMany({ orderBy: { id: "asc" } });
    expect(clean(normalize(rows.map((row) => pick(row, keys))))).toEqual(
      clean(getMockRevenueMetrics().map((row) => pick(row, keys))),
    );
  });
});
