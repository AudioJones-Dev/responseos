import { execFileSync } from "node:child_process";
import { afterAll, describe, expect, test } from "vitest";
import { disconnectTestDb, normalize, prisma } from "./setup";

function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL must be set to a local Postgres before running seed-determinism integration tests.",
    );
  }
  const host = new URL(url).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(
      `Refusing to run prisma migrate reset against non-local database (host=${host}). DATABASE_URL must point at localhost or 127.0.0.1.`,
    );
  }
}

assertLocalDatabase();

const TABLE_READS = {
  organizations: () => prisma.organization.findMany({ orderBy: { id: "asc" } }),
  users: () => prisma.user.findMany({ orderBy: { id: "asc" } }),
  contacts: () => prisma.contact.findMany({ orderBy: { id: "asc" } }),
  calls: () => prisma.call.findMany({ orderBy: { id: "asc" } }),
  leadEvents: () => prisma.leadEvent.findMany({ orderBy: { id: "asc" } }),
  leadQualifications: () => prisma.leadQualification.findMany({ orderBy: { id: "asc" } }),
  bookings: () => prisma.booking.findMany({ orderBy: { id: "asc" } }),
  quoteRequests: () => prisma.quoteRequest.findMany({ orderBy: { id: "asc" } }),
  revenueMetrics: () => prisma.revenueMetrics.findMany({ orderBy: { id: "asc" } }),
  assessmentReports: () => prisma.assessmentReport.findMany({ orderBy: { id: "asc" } }),
  engagements: () => prisma.engagement.findMany({ orderBy: { id: "asc" } }),
  auditLogs: () => prisma.auditLog.findMany({ orderBy: { id: "asc" } }),
  webhookEvents: () => prisma.webhookEvent.findMany({ orderBy: { id: "asc" } }),
};

function migrateResetAndSeed(): void {
  execFileSync("npx", ["prisma", "migrate", "reset", "--force"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
  });
}

function stripDbManagedTimestamps(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stripDbManagedTimestamps(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "created_at" && key !== "updated_at")
        .map(([key, entry]) => [key, stripDbManagedTimestamps(entry)]),
    );
  }
  return value;
}

async function snapshotSeededTables(): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    Object.entries(TABLE_READS).map(async ([table, read]) => [
      table,
      stripDbManagedTimestamps(normalize(await read())),
    ]),
  );
  return Object.fromEntries(entries);
}

describe("seed determinism", () => {
  afterAll(async () => {
    await disconnectTestDb();
  });

  test("seeded business payloads are identical across consecutive migrate reset + seed runs", async () => {
    await prisma.$disconnect();
    migrateResetAndSeed();
    await prisma.$connect();
    const first = await snapshotSeededTables();

    await prisma.$disconnect();
    migrateResetAndSeed();
    await prisma.$connect();
    const second = await snapshotSeededTables();

    expect(second).toEqual(first);
  });
});
