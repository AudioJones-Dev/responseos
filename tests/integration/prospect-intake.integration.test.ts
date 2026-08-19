import { afterAll, beforeEach, describe, expect, test } from "vitest";
import {
  createProspectIntake,
  listProspectIntakes,
  purgeExpiredUnqualifiedProspectPii,
  transitionProspectIntake,
} from "@/lib/data/prospectIntakes";
import { disconnectTestDb, prisma, resetAndSeedTestDb, setDevSession } from "./setup";

const request = {
  name: "Jordan Vega",
  email: "jordan@example.com",
  business_name: "Example Services",
};

describe("ProspectIntake persistence", () => {
  beforeEach(async () => {
    await resetAndSeedTestDb();
    setDevSession("aj_admin");
  });
  afterAll(disconnectTestDb);

  test("replays one idempotent submission without duplicating PII", async () => {
    const first = await createProspectIntake({
      accountId: "org_mock_1",
      idempotencyKey: "intake:replay-001",
      request,
    });
    const replay = await createProspectIntake({
      accountId: "org_mock_1",
      idempotencyKey: "intake:replay-001",
      request,
    });
    expect(first.ok && first.data.replay).toBe(false);
    expect(replay.ok && replay.data.replay).toBe(true);
    expect(await prisma.prospectIntake.count()).toBe(1);
  });

  test("rejects reuse of a key for different content", async () => {
    await createProspectIntake({
      accountId: "org_mock_1",
      idempotencyKey: "intake:conflict-001",
      request,
    });
    const conflict = await createProspectIntake({
      accountId: "org_mock_1",
      idempotencyKey: "intake:conflict-001",
      request: { ...request, business_name: "Different Services" },
    });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.error.code).toBe("idempotency_conflict");
  });

  test("enforces received to reviewed to terminal workflow", async () => {
    const created = await createProspectIntake({
      accountId: "org_mock_1",
      idempotencyKey: "intake:workflow-001",
      request,
    });
    if (!created.ok) throw new Error(created.error.message);
    const invalid = await transitionProspectIntake({
      id: created.data.intake.id,
      accountId: "org_mock_1",
      status: "qualified",
    });
    expect(invalid.ok).toBe(false);
    await transitionProspectIntake({
      id: created.data.intake.id,
      accountId: "org_mock_1",
      status: "reviewed",
    });
    const qualified = await transitionProspectIntake({
      id: created.data.intake.id,
      accountId: "org_mock_1",
      status: "qualified",
    });
    expect(qualified.ok && qualified.data.after.status).toBe("qualified");
    expect(
      await prisma.auditLog.count({
        where: {
          target_id: created.data.intake.id,
          action: "prospect_intake.status_changed",
        },
      }),
    ).toBe(2);
  });

  test("purges expired unqualified PII but preserves the audit reference", async () => {
    const now = new Date("2026-08-18T12:00:00.000Z");
    await createProspectIntake({
      accountId: "org_mock_1",
      idempotencyKey: "intake:expired-001",
      request,
      now: new Date("2026-05-01T12:00:00.000Z"),
    });
    const purged = await purgeExpiredUnqualifiedProspectPii({ accountId: "org_mock_1", now });
    expect(purged.ok && purged.data.purged).toBe(1);
    const listed = await listProspectIntakes({ accountId: "org_mock_1" });
    expect(listed.ok && listed.data[0].request).toBeNull();
    expect(listed.ok && listed.data[0].reference).toMatch(/^audit_/);
  });
});
