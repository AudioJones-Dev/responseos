import { execFileSync } from "node:child_process";
import type { PrismaClient as PrismaClientType } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

const DATABASE_URL = process.env.DATABASE_URL;
const DIRECT_URL = process.env.DIRECT_URL ?? DATABASE_URL;
const TEST_WEBHOOK_PROVIDER = "phase-d-test-provider";
const SAFE_INTEGRATION_HOSTS = new Set(["localhost", "127.0.0.1", "postgres"]);

const REQUIRED_DATABASE_URL_MESSAGE =
  "npm run test:integration requires DATABASE_URL to point at a disposable local Postgres database, for example postgresql://postgres:postgres@localhost:5432/responseos_test?schema=public";

if (!DATABASE_URL) {
  throw new Error(REQUIRED_DATABASE_URL_MESSAGE);
}

let prisma: PrismaClientType;

const prismaEnv = {
  ...process.env,
  DATABASE_URL,
  DIRECT_URL,
};

interface ModelCounts {
  organizations: number;
  users: number;
  contacts: number;
  calls: number;
  leadEvents: number;
  leadQualifications: number;
  bookings: number;
  quoteRequests: number;
  revenueMetrics: number;
  assessmentReports: number;
  engagements: number;
  auditLogs: number;
  webhookEvents: number;
}

async function getCoreCounts(): Promise<ModelCounts> {
  const [
    organizations,
    users,
    contacts,
    calls,
    leadEvents,
    leadQualifications,
    bookings,
    quoteRequests,
    revenueMetrics,
    assessmentReports,
    engagements,
    auditLogs,
    webhookEvents,
  ] = await prisma.$transaction([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.contact.count(),
    prisma.call.count(),
    prisma.leadEvent.count(),
    prisma.leadQualification.count(),
    prisma.booking.count(),
    prisma.quoteRequest.count(),
    prisma.revenueMetrics.count(),
    prisma.assessmentReport.count(),
    prisma.engagement.count(),
    prisma.auditLog.count(),
    prisma.webhookEvent.count(),
  ]);

  return {
    organizations,
    users,
    contacts,
    calls,
    leadEvents,
    leadQualifications,
    bookings,
    quoteRequests,
    revenueMetrics,
    assessmentReports,
    engagements,
    auditLogs,
    webhookEvents,
  };
}

function runPrisma(args: string[]) {
  const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(npxBin, ["prisma", ...args], {
    cwd: process.cwd(),
    env: prismaEnv,
    stdio: "inherit",
  });
}

function assertSafeIntegrationDatabaseUrl(databaseUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(`${REQUIRED_DATABASE_URL_MESSAGE}. Received an invalid URL.`);
  }

  const host = parsed.hostname;
  const dbName = parsed.pathname.replace(/^\//, "");

  if (!SAFE_INTEGRATION_HOSTS.has(host) || !/test/i.test(dbName)) {
    throw new Error(
      `Refusing to run prisma migrate reset against ${host}/${dbName}. ` +
        "Use a disposable local DB whose name contains 'test'.",
    );
  }
}

async function importData(session?: string) {
  if (session) {
    process.env.RESPONSEOS_DEV_SESSION = session;
  } else {
    delete process.env.RESPONSEOS_DEV_SESSION;
  }
  process.env.DATABASE_URL = DATABASE_URL;
  process.env.DIRECT_URL = DIRECT_URL;
  vi.resetModules();
  return import("@/lib/data/index");
}

type TenantScopedResult =
  | { ok: true }
  | { ok: false; error: { code: string } };

function expectTenantScopeDenied(result: TenantScopedResult) {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe("tenant_scope_denied");
  }
}

describe("v0.2 Postgres integration coverage", () => {
  beforeAll(async () => {
    assertSafeIntegrationDatabaseUrl(DATABASE_URL);
    runPrisma(["generate"]);
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient({
      datasources: { db: { url: DATABASE_URL } },
    });
    runPrisma(["migrate", "reset", "--force", "--skip-seed"]);
    runPrisma(["db", "seed"]);
  }, 120_000);

  afterEach(async () => {
    await prisma.webhookEvent.deleteMany({
      where: { provider: TEST_WEBHOOK_PROVIDER },
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    const { db } = await import("@/lib/db/client");
    await db?.$disconnect();
  });

  test("deterministic seed is idempotent and preserves core seeded counts", async () => {
    const firstCounts = await getCoreCounts();

    expect(firstCounts).toMatchInlineSnapshot(`
      {
        "assessmentReports": 1,
        "auditLogs": 6,
        "bookings": 2,
        "calls": 4,
        "contacts": 3,
        "engagements": 1,
        "leadEvents": 11,
        "leadQualifications": 3,
        "organizations": 2,
        "quoteRequests": 2,
        "revenueMetrics": 3,
        "users": 3,
        "webhookEvents": 0,
      }
    `);

    runPrisma(["db", "seed"]);
    await expect(getCoreCounts()).resolves.toEqual(firstCounts);
  }, 120_000);

  test("tenant-scoped reads flow through lib/data accessors", async () => {
    const { Calls, Contacts, Leads, Bookings, Quotes, RevenueMetrics } =
      await importData("client_admin@org_mock_1");

    const contacts = await Contacts.listContacts({});
    expect(contacts.ok).toBe(true);
    if (!contacts.ok) return;
    expect(contacts.data).toHaveLength(2);
    expect(contacts.data.every((row) => row.organization_id === "org_mock_1"))
      .toBe(true);

    const calls = await Calls.listCalls({});
    expect(calls.ok).toBe(true);
    if (!calls.ok) return;
    expect(calls.data).toHaveLength(3);
    expect(calls.data.every((row) => row.organization_id === "org_mock_1"))
      .toBe(true);

    const leads = await Leads.listLeads({});
    expect(leads.ok).toBe(true);
    if (!leads.ok) return;
    expect(leads.data).toHaveLength(9);
    expect(leads.data.every((row) => row.organization_id === "org_mock_1"))
      .toBe(true);

    const bookings = await Bookings.listBookings({});
    expect(bookings.ok).toBe(true);
    if (!bookings.ok) return;
    expect(bookings.data).toHaveLength(1);
    expect(bookings.data[0]?.organization_id).toBe("org_mock_1");

    const quotes = await Quotes.listQuoteRequests({});
    expect(quotes.ok).toBe(true);
    if (!quotes.ok) return;
    expect(quotes.data).toHaveLength(1);
    expect(quotes.data[0]?.organization_id).toBe("org_mock_1");

    const revenue = await RevenueMetrics.listRevenueMetrics({});
    expect(revenue.ok).toBe(true);
    if (!revenue.ok) return;
    expect(revenue.data).toHaveLength(3);
    expect(revenue.data.every((row) => row.organization_id === "org_mock_1"))
      .toBe(true);
  });

  test("client role is denied when requesting another tenant", async () => {
    const { Contacts, Calls, Leads, Bookings, Quotes, RevenueMetrics } =
      await importData("client_admin@org_mock_1");

    const [contacts, calls, leads, bookings, quotes, revenue] = await Promise.all([
      Contacts.listContacts({ organizationId: "org_mock_2" }),
      Calls.listCalls({ organizationId: "org_mock_2" }),
      Leads.listLeads({ organizationId: "org_mock_2" }),
      Bookings.listBookings({ organizationId: "org_mock_2" }),
      Quotes.listQuoteRequests({ organizationId: "org_mock_2" }),
      RevenueMetrics.listRevenueMetrics({ organizationId: "org_mock_2" }),
    ]);

    expectTenantScopeDenied(contacts);
    expectTenantScopeDenied(calls);
    expectTenantScopeDenied(leads);
    expectTenantScopeDenied(bookings);
    expectTenantScopeDenied(quotes);
    expectTenantScopeDenied(revenue);
  });

  test("recordWebhookEvent dedupes provider event replays", async () => {
    const { WebhookEvents } = await importData("aj_admin");

    const first = await WebhookEvents.recordWebhookEvent({
      organization_id: "org_mock_1",
      provider: TEST_WEBHOOK_PROVIDER,
      provider_event_id: "phase-d-event-1",
      event_type: "call.ended",
      raw_body: JSON.stringify({ event: "phase-d-event-1" }),
      signature_header: "test-signature",
    });

    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.process_status).toBe("received");

    const replay = await WebhookEvents.recordWebhookEvent({
      organization_id: "org_mock_1",
      provider: TEST_WEBHOOK_PROVIDER,
      provider_event_id: "phase-d-event-1",
      event_type: "call.ended",
      raw_body: JSON.stringify({ event: "phase-d-event-1", replay: true }),
      signature_header: "test-signature",
    });

    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.data).toEqual({
      id: first.data.id,
      process_status: "duplicate",
    });
    await expect(
      prisma.webhookEvent.count({
        where: {
          provider: TEST_WEBHOOK_PROVIDER,
          provider_event_id: "phase-d-event-1",
        },
      }),
    ).resolves.toBe(1);
  });
});
