import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { EXPECTED_SEED_COUNTS } from "@/prisma/seed";

const migrateResetSafetyError =
  "Refusing to run migrate reset against a non-local database. DATABASE_URL must point at localhost.";

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
  const { hostname } = new URL(databaseUrl);

  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    throw new Error(migrateResetSafetyError);
  }
}

const execFileAsync = promisify(execFile);
const prisma = databaseUrl ? new PrismaClient() : null;
const describeIntegration = databaseUrl ? describe : describe.skip;

type SeedCounts = Record<keyof typeof EXPECTED_SEED_COUNTS, number>;

function requireDatabaseUrl(): string {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be set to run the Postgres integration suite.",
    );
  }

  return databaseUrl;
}

function requirePrisma(): PrismaClient {
  if (!prisma) {
    throw new Error(
      "DATABASE_URL must be set to run the Postgres integration suite.",
    );
  }

  return prisma;
}

async function runMigrateReset() {
  const localDatabaseUrl = requireDatabaseUrl();

  await execFileAsync("npx", ["prisma", "migrate", "reset", "--force"], {
    env: {
      ...process.env,
      DATABASE_URL: localDatabaseUrl,
      DIRECT_URL: process.env.DIRECT_URL ?? localDatabaseUrl,
    },
  });
}

async function seedCounts() {
  const client = requirePrisma();

  return {
    organizations: await client.organization.count(),
    users: await client.user.count(),
    contacts: await client.contact.count(),
    calls: await client.call.count(),
    leadEvents: await client.leadEvent.count(),
    leadQualifications: await client.leadQualification.count(),
    bookings: await client.booking.count(),
    quoteRequests: await client.quoteRequest.count(),
    revenueMetrics: await client.revenueMetrics.count(),
    assessmentReports: await client.assessmentReport.count(),
    engagements: await client.engagement.count(),
    auditLogs: await client.auditLog.count(),
    webhookEvents: await client.webhookEvent.count(),
    automations: await client.automation.count(),
    notifications: await client.notification.count(),
  } satisfies SeedCounts;
}

async function importData(session: string) {
  const previousSession = process.env.RESPONSEOS_DEV_SESSION;
  process.env.RESPONSEOS_DEV_SESSION = session;
  vi.resetModules();

  try {
    return await import("@/lib/data/index");
  } finally {
    if (previousSession === undefined) {
      delete process.env.RESPONSEOS_DEV_SESSION;
    } else {
      process.env.RESPONSEOS_DEV_SESSION = previousSession;
    }
  }
}

describeIntegration("v0.2 Postgres integration suite", () => {
  beforeAll(async () => {
    await runMigrateReset();
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await (globalThis.__responseos_prisma__?.$disconnect?.() ??
      Promise.resolve());
    delete globalThis.__responseos_prisma__;
  });

  test("migrate reset seeds the expected deterministic fixture counts", async () => {
    await expect(seedCounts()).resolves.toEqual(EXPECTED_SEED_COUNTS);
  });

  test("seed remains idempotent across repeated migrate reset runs", async () => {
    await runMigrateReset();
    await expect(seedCounts()).resolves.toEqual(EXPECTED_SEED_COUNTS);
  }, 60_000);

  test("data accessors enforce tenant isolation against Postgres rows", async () => {
    const { Calls } = await importData("client_admin@org_mock_1");

    const ownTenant = await Calls.listCalls({});
    expect(ownTenant.ok).toBe(true);
    if (!ownTenant.ok) return;
    expect(
      ownTenant.data.every((call) => call.organization_id === "org_mock_1"),
    ).toBe(true);

    const crossTenant = await Calls.listCalls({ organizationId: "org_mock_2" });
    expect(crossTenant.ok).toBe(false);
    if (crossTenant.ok) return;
    expect(crossTenant.error.code).toBe("tenant_scope_denied");
  });
});
