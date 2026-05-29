import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { getMockAppointments } from "@/lib/mock/appointments";
import { getMockCalls } from "@/lib/mock/calls";
import { getMockContacts } from "@/lib/mock/contacts";
import { getMockLeadEvents } from "@/lib/mock/leads";
import { getMockAccounts } from "@/lib/mock/accounts";
import { getMockQuoteRequests } from "@/lib/mock/quotes";
import { getMockRevenueMetrics } from "@/lib/mock/revenueMetrics";
import { getMockProviderConnections } from "@/lib/mock/providerConnections";
import { getMockConversations } from "@/lib/mock/conversations";
import { getMockSmsMessages } from "@/lib/mock/smsMessages";
import { getMockCallSegments } from "@/lib/mock/callSegments";
import { getMockCallTranscripts } from "@/lib/mock/callTranscripts";
import { getMockQaLogs } from "@/lib/mock/qaLogs";
import { disconnectTestDb, normalize, prisma, resetAndSeedTestDb } from "./setup";

function clean(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => clean(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined && entry !== null)
        .filter(([key]) => key !== "created_at" && key !== "updated_at")
        .map(([key, entry]) => [key, clean(entry)]),
    );
  }
  return value;
}

function pick(row: object, keys: string[]): Record<string, unknown> {
  const record = row as Record<string, unknown>;
  return Object.fromEntries(keys.map((key) => [key, record[key]]));
}

beforeEach(async () => {
  await resetAndSeedTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("seeded mock fixture parity", () => {
  test("accounts match lib/mock accounts field-for-field", async () => {
    const rows = await prisma.account.findMany({ orderBy: { id: "asc" } });
    expect(clean(normalize(rows))).toEqual(clean(getMockAccounts()));
  });

  test("contacts match lib/mock contacts field-for-field", async () => {
    const rows = await prisma.contact.findMany({ orderBy: { id: "asc" } });
    expect(clean(normalize(rows))).toEqual(clean(getMockContacts()));
  });

  test("calls match lib/mock calls field-for-field", async () => {
    const keys = [
      "id",
      "account_id",
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
      "account_id",
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
    const fixtureRows = [...getMockLeadEvents()].sort((a, b) =>
      a.id.localeCompare(b.id),
    );

    expect(clean(normalize(rows.map((row) => pick(row, keys))))).toEqual(
      clean(fixtureRows.map((row) => pick(row, keys))),
    );
  });

  test("appointments match lib/mock appointments field-for-field", async () => {
    const keys = [
      "id",
      "account_id",
      "contact_id",
      "lead_event_id",
      "calendar_provider",
      "external_event_id",
      "title",
      "start_time",
      "end_time",
      "status",
      "location",
      "notes",
    ];
    const rows = await prisma.appointment.findMany({ orderBy: { id: "asc" } });
    expect(clean(normalize(rows.map((row) => pick(row, keys))))).toEqual(
      clean(getMockAppointments().map((row) => pick(row, keys))),
    );
  });

  test("quote requests match lib/mock quotes field-for-field", async () => {
    const keys = [
      "id",
      "account_id",
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

  test("provider connections match lib/mock provider connections field-for-field", async () => {
    // credentials_encrypted and oauth_refresh_token_encrypted are
    // deliberately excluded — the public mock type does not expose them
    // (ADR-0020 puts ciphertext behind the encryption-module boundary).
    const keys = [
      "id",
      "account_id",
      "provider",
      "status",
      "scopes",
      "connected_by",
      "last_verified_at",
    ];
    const rows = await prisma.providerConnection.findMany({ orderBy: { id: "asc" } });
    expect(clean(normalize(rows.map((row) => pick(row, keys))))).toEqual(
      clean(getMockProviderConnections().map((row) => pick(row, keys))),
    );
  });

  test("conversations match lib/mock conversations field-for-field", async () => {
    const keys = [
      "id",
      "account_id",
      "contact_id",
      "business_number",
      "peer_number",
      "status",
      "last_message_at",
    ];
    const rows = await prisma.conversation.findMany({ orderBy: { id: "asc" } });
    expect(clean(normalize(rows.map((row) => pick(row, keys))))).toEqual(
      clean(getMockConversations().map((row) => pick(row, keys))),
    );
  });

  test("sms messages match lib/mock sms messages field-for-field", async () => {
    const keys = [
      "id",
      "account_id",
      "conversation_id",
      "provider",
      "provider_message_id",
      "direction",
      "from_number",
      "to_number",
      "body",
      "status",
      "segment_count",
      "error_code",
      "error_message",
      "sent_at",
      "delivered_at",
    ];
    const rows = await prisma.smsMessage.findMany({ orderBy: { id: "asc" } });
    expect(clean(normalize(rows.map((row) => pick(row, keys))))).toEqual(
      clean(getMockSmsMessages().map((row) => pick(row, keys))),
    );
  });

  test("provider credentials are stored as mock-sentinel bytes in mock mode", async () => {
    const rows = await prisma.providerConnection.findMany({
      where: { id: { in: ["pconn_mock_1", "pconn_mock_2"] } },
      orderBy: { id: "asc" },
      select: { id: true, credentials_encrypted: true },
    });
    const sentinel = Buffer.from("<MOCK_REDACTED>", "utf8");
    // Prisma 6 maps the `Bytes` scalar to `Uint8Array` (not Node `Buffer`),
    // so wrap before calling Buffer.equals. The wrap preserves the byte
    // contents — it does not change what is stored or compared.
    for (const row of rows) {
      expect(Buffer.from(row.credentials_encrypted).equals(sentinel)).toBe(true);
    }
  });

  test("call segments match lib/mock call segments field-for-field", async () => {
    const keys = [
      "id",
      "account_id",
      "call_id",
      "sequence",
      "speaker",
      "text",
      "redacted_text",
      "confidence",
      "started_at",
      "ended_at",
    ];
    const rows = await prisma.callSegment.findMany({ orderBy: { id: "asc" } });
    expect(clean(normalize(rows.map((row) => pick(row, keys))))).toEqual(
      clean(getMockCallSegments().map((row) => pick(row, keys))),
    );
  });

  test("call transcripts match lib/mock call transcripts field-for-field (public shape)", async () => {
    // raw_ref and redacted_ref are deliberately excluded — the public
    // mock type does not expose them and the lib/data/* accessor in
    // 31B does not return them (Q7 + ADR-0019 step 2.3 guardrail).
    const keys = [
      "id",
      "account_id",
      "call_id",
      "inline_text",
      "language",
      "retention_lane",
      "expires_at",
      "redacted_at",
    ];
    const rows = await prisma.callTranscript.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        account_id: true,
        call_id: true,
        inline_text: true,
        language: true,
        retention_lane: true,
        expires_at: true,
        redacted_at: true,
      },
    });
    expect(clean(normalize(rows.map((row) => pick(row, keys))))).toEqual(
      clean(getMockCallTranscripts().map((row) => pick(row, keys))),
    );
  });

  test("call transcript raw_ref / redacted_ref are stored at the DB level but never exposed by the public accessor", async () => {
    // Direct DB read may surface the columns (they exist on the row);
    // but the public-shape accessor must not project them. The seed
    // intentionally leaves both null in v0.2 — object storage is not
    // wired. This test asserts both invariants together.
    const row = await prisma.callTranscript.findUnique({
      where: { call_id: "call_mock_2" },
      select: { raw_ref: true, redacted_ref: true },
    });
    expect(row).not.toBeNull();
    expect(row?.raw_ref).toBeNull();
    expect(row?.redacted_ref).toBeNull();
  });

  test("qa logs match lib/mock qa logs field-for-field", async () => {
    const keys = [
      "id",
      "account_id",
      "call_id",
      "rubric_version",
      "reviewer_type",
      "reviewer_user_id",
      "score",
      "findings_json",
      "notes",
      "reviewed_at",
    ];
    const rows = await prisma.qaLog.findMany({ orderBy: { id: "asc" } });
    expect(clean(normalize(rows.map((row) => pick(row, keys))))).toEqual(
      clean(getMockQaLogs().map((row) => pick(row, keys))),
    );
  });

  test("revenue metrics match lib/mock revenue metrics field-for-field", async () => {
    const keys = [
      "id",
      "account_id",
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
