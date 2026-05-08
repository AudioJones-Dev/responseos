import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TABLES_IN_DELETE_ORDER = [
  "WebhookEvent",
  "AuditLog",
  "Engagement",
  "AssessmentReport",
  "RevenueMetrics",
  "Notification",
  "Automation",
  "QuoteRequest",
  "Booking",
  "LeadQualification",
  "LeadEvent",
  "Call",
  "Contact",
  "User",
  "Organization",
] as const;

const MODEL_DELEGATES = [
  "webhookEvent",
  "auditLog",
  "engagement",
  "assessmentReport",
  "revenueMetrics",
  "notification",
  "automation",
  "quoteRequest",
  "booking",
  "leadQualification",
  "leadEvent",
  "call",
  "contact",
  "user",
  "organization",
] as const;

type SnapshotValue =
  | null
  | string
  | number
  | boolean
  | SnapshotValue[]
  | { [key: string]: SnapshotValue };

function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required for integration tests. Start Postgres 16, run migrations, and retry.",
    );
  }
}

function normalize(value: unknown): SnapshotValue {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalize(nested)]),
    ) as { [key: string]: SnapshotValue };
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return String(value);
}

export async function connectTestDb(): Promise<PrismaClient> {
  requireDatabaseUrl();
  await prisma.$connect();
  return prisma;
}

export async function resetTestDb(): Promise<void> {
  requireDatabaseUrl();
  for (const table of TABLES_IN_DELETE_ORDER) {
    await prisma.$executeRawUnsafe(`DELETE FROM \"${table}\"`);
  }
}

export function runPrismaCommand(args: string[]): void {
  requireDatabaseUrl();
  execFileSync("npx", ["prisma", ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
  });
}

export function seedTestDb(): void {
  runPrismaCommand(["db", "seed"]);
}

export async function snapshotDb(): Promise<Record<string, SnapshotValue[]>> {
  const snapshot: Record<string, SnapshotValue[]> = {};

  for (const model of MODEL_DELEGATES) {
    const delegate = prisma[model] as unknown as {
      findMany(args: { orderBy: { id: "asc" } }): Promise<unknown[]>;
    };
    const rows = await delegate.findMany({ orderBy: { id: "asc" } });
    snapshot[model] = normalize(rows) as SnapshotValue[];
  }

  return snapshot;
}
