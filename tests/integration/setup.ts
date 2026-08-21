import { execFileSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { resetFactoryCounters } from "../factories";

export const prisma = new PrismaClient();

const TABLES = [
  "BootstrapPromotion",
  "TelephonyNumberAssignment",
  "TelephonyNumber",
  "BusinessMemorySnapshot",
  "KnowledgeFact",
  "KnowledgeSource",
  "KnowledgeIngestionRun",
  "ProspectBootstrap",
  "CrmSyncOperation",
  "ProspectIntake",
  "ProfessionalOpportunity",
  "AgentProfile",
  "WorkflowRun",
  "QaLog",
  "CallTranscript",
  "CallSegment",
  "SmsMessage",
  "Conversation",
  "ProviderConnection",
  "WebhookEvent",
  "AuditLog",
  "Engagement",
  "AssessmentReport",
  "RevenueMetrics",
  "Notification",
  "Automation",
  "QuoteRequest",
  "Appointment",
  "LeadQualification",
  "LeadEvent",
  "Call",
  "Contact",
  "User",
  "Account",
];

export async function connectTestDb(): Promise<PrismaClient> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for integration tests.");
  }
  await prisma.$connect();
  return prisma;
}

export async function resetTestDb(): Promise<void> {
  await connectTestDb();
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
  resetFactoryCounters();
}

export async function seedTestDb(): Promise<void> {
  const tsxCli = path.resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  execFileSync(process.execPath, [tsxCli, "prisma/seed.ts"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
  });
}

export async function resetAndSeedTestDb(): Promise<void> {
  await resetTestDb();
  seedTestDb();
}

export async function disconnectTestDb(): Promise<void> {
  await prisma.$disconnect();
}

export function setDevSession(session: string): void {
  process.env.RESPONSEOS_DEV_SESSION = session;
}

export function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalize(entry)]),
    );
  }
  return value;
}
