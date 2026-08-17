import { afterAll, beforeEach, describe, expect, test } from "vitest";
import {
  createInboundAudit,
  INBOUND_PROSPECT_ACCOUNT_ID,
} from "@/lib/data/inboundAudits";
import { disconnectTestDb, prisma, resetAndSeedTestDb } from "./setup";

beforeEach(async () => {
  await resetAndSeedTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("inbound audit database boundary", () => {
  test("the internal inbound account is seeded outside client fixtures", async () => {
    await expect(
      prisma.account.findUnique({
        where: { id: INBOUND_PROSPECT_ACCOUNT_ID },
      }),
    ).resolves.toMatchObject({
      id: INBOUND_PROSPECT_ACCOUNT_ID,
      industry: "internal",
    });
  });

  test("the inbound account can accept the current audit capture", async () => {
    const created = await createInboundAudit({
      name: "Database Prospect",
      email: "db-prospect@example.com",
      business_name: "Database HVAC",
      industry: "home_services",
      monthly_missed_calls: 20,
      avg_job_value_usd: 850,
      close_rate_pct: 30,
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data).toMatchObject({
      account_id: INBOUND_PROSPECT_ACCOUNT_ID,
      persisted: true,
      status: "draft",
    });
    const stored = await prisma.assessmentReport.findUnique({
      where: { id: created.data.id },
    });
    expect(stored).toMatchObject({
      account_id: INBOUND_PROSPECT_ACCOUNT_ID,
      status: "draft",
    });
    expect(stored?.inputs_json).toMatchObject({
      monthly_missed_calls: 20,
      avg_job_value_usd: 850,
      close_rate_pct: 30,
    });
  });
});
