import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const DATABASE_URL = process.env.DATABASE_URL;
const DIRECT_URL = process.env.DIRECT_URL ?? DATABASE_URL;
const ORIGINAL_ENV = { ...process.env };

const REQUIRED_DATABASE_URL_MESSAGE =
  "DATABASE_URL must point at a disposable local Postgres database, for example postgresql://postgres:postgres@localhost:5432/responseos_test?schema=public";

if (!DATABASE_URL) {
  throw new Error(REQUIRED_DATABASE_URL_MESSAGE);
}

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

const prismaEnv = {
  ...process.env,
  DATABASE_URL,
  DIRECT_URL,
};

const importedDataClients = new Set<{ $disconnect: () => Promise<void> }>();

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
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(executable, ["prisma", ...args], {
    cwd: process.cwd(),
    env: prismaEnv,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(
      `npx prisma ${args.join(" ")} failed with exit code ${result.status}`,
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

  const [data, dbModule] = await Promise.all([
    import("@/lib/data/index"),
    import("@/lib/db/client"),
  ]);
  if (dbModule.db) {
    importedDataClients.add(dbModule.db);
  }
  return data;
}

describe("v0.2 Postgres integration coverage", () => {
  beforeAll(async () => {
    runPrisma(["migrate", "reset", "--force", "--skip-seed"]);
    runPrisma(["db", "seed"]);
  }, 120_000);

  afterEach(async () => {
    process.env = { ...ORIGINAL_ENV, DATABASE_URL, DIRECT_URL };
    vi.resetModules();

    await prisma.webhookEvent.deleteMany({
      where: { provider: "phase-d-test-provider" },
    });
  });

  afterAll(async () => {
    await Promise.all(
      [...importedDataClients].map((client) => client.$disconnect()),
    );
    await prisma.$disconnect();
  });

  test("deterministic seed is idempotent and preserves core seeded counts", async () => {
    const firstCounts = await getCoreCounts();

    // Snapshot must match prisma/seed.ts exactly; update both together when
    // intentional seed fixture changes land.
    expect(firstCounts).toEqual({
      organizations: 2,
      users: 3,
      contacts: 3,
      calls: 4,
      leadEvents: 11,
      leadQualifications: 3,
      bookings: 2,
      quoteRequests: 2,
      revenueMetrics: 3,
      assessmentReports: 1,
      engagements: 1,
      auditLogs: 6,
      webhookEvents: 0,
    });

    runPrisma(["db", "seed"]);
    await expect(getCoreCounts()).resolves.toEqual(firstCounts);
  }, 120_000);

  test("aj_admin reads across tenants through lib/data accessors", async () => {
    const { Calls, Contacts } = await importData("aj_admin");

    const contacts = await Contacts.listContacts({});
    expect(contacts.ok).toBe(true);
    if (!contacts.ok) return;
    expect(new Set(contacts.data.map((row) => row.organization_id))).toEqual(
      new Set(["org_mock_1", "org_mock_2"]),
    );

    const calls = await Calls.listCalls({});
    expect(calls.ok).toBe(true);
    if (!calls.ok) return;
    expect(new Set(calls.data.map((row) => row.organization_id))).toEqual(
      new Set(["org_mock_1", "org_mock_2"]),
    );
  });

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

    const results = await Promise.all([
      Contacts.listContacts({ organizationId: "org_mock_2" }),
      Calls.listCalls({ organizationId: "org_mock_2" }),
      Leads.listLeads({ organizationId: "org_mock_2" }),
      Bookings.listBookings({ organizationId: "org_mock_2" }),
      Quotes.listQuoteRequests({ organizationId: "org_mock_2" }),
      RevenueMetrics.listRevenueMetrics({ organizationId: "org_mock_2" }),
    ]);

    for (const result of results) {
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("tenant_scope_denied");
    }
  });

  test("recordWebhookEvent dedupes provider event replays", async () => {
    const { WebhookEvents } = await importData("aj_admin");

    const first = await WebhookEvents.recordWebhookEvent({
      organization_id: "org_mock_1",
      provider: "phase-d-test-provider",
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
      provider: "phase-d-test-provider",
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
          provider: "phase-d-test-provider",
          provider_event_id: "phase-d-event-1",
        },
      }),
    ).resolves.toBe(1);
  });
});
