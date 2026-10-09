import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";
import { persistFrlWebIntake } from "@/lib/data/frlWebIntakes";
import { runFrlMockDelivery } from "@/lib/data/frlMockRunner";
import {
  disconnectTestDb,
  prisma,
  resetAndSeedTestDb,
  setDevSession,
} from "./setup";

beforeEach(async () => {
  await resetAndSeedTestDb();
  setDevSession("client_admin@org_mock_1");
  vi.stubEnv("RESPONSEOS_FRL_MOCK_DISPATCH_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());
afterAll(disconnectTestDb);
async function intake(optIn = false) {
  return persistFrlWebIntake({
    submissionId: randomUUID(),
    environment: "test",
    request: {
      schemaVersion: 1,
      need: "Service or repair",
      equipment: "Stair lift",
      building: "Home",
      city: "TEST",
      name: "Synthetic",
      email: "test@example.com",
      contactConsent: true,
      sourcePage: "/",
      audience: "homeowner",
      emailUpdates: optIn,
    },
  });
}
test("runs CRM then consent-gated follow-ups once and replays their mock receipts", async () => {
  const { reference } = await intake(true);
  const run = (kind: "crm" | "notification" | "marketing") =>
    runFrlMockDelivery({ reference, kind, scenario: "confirmed" });
  expect((await run("notification")).status).toBe("blocked");
  const results = await Promise.all([run("crm"), run("crm")]);
  expect(results.some((result) => result.status === "confirmed")).toBe(true);
  const crm = await run("crm");
  expect(crm).toMatchObject({ status: "confirmed", mode: "mock" });
  expect(await run("crm")).toEqual(crm);
  expect((await run("notification")).status).toBe("confirmed");
  expect((await run("marketing")).status).toBe("confirmed");
  expect(await prisma.frlMockDelivery.findMany()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "crm",
        status: "confirmed",
        attempt_count: 1,
      }),
      expect.objectContaining({
        kind: "notification",
        status: "confirmed",
        attempt_count: 1,
      }),
      expect.objectContaining({
        kind: "marketing",
        status: "confirmed",
        attempt_count: 1,
      }),
    ]),
  );
});
test.each(["uncertain", "rejected"] as const)(
  "does not retry %s outcome or unblock follow-ups",
  async (scenario) => {
    const { reference } = await intake();
    expect(
      await runFrlMockDelivery({ reference, kind: "crm", scenario }),
    ).toMatchObject({ status: scenario, settlementRecorded: true });
    expect(
      (
        await runFrlMockDelivery({
          reference,
          kind: "crm",
          scenario: "confirmed",
        })
      ).status,
    ).toBe(scenario);
    expect(
      (
        await runFrlMockDelivery({
          reference,
          kind: "notification",
          scenario: "confirmed",
        })
      ).status,
    ).toBe("blocked");
    expect(
      (await prisma.frlMockDelivery.findFirst({ where: { kind: "crm" } }))
        ?.attempt_count,
    ).toBe(1);
  },
);
test("refuses Production, another tenant and unconsented marketing without an attempt", async () => {
  const { reference } = await intake();
  const input = {
    reference,
    kind: "crm" as const,
    scenario: "confirmed" as const,
  };
  vi.stubEnv("NODE_ENV", "production");
  await expect(runFrlMockDelivery(input)).rejects.toThrow(
    "RESPONSEOS_DEV_SESSION must not be set",
  );
  vi.stubEnv("NODE_ENV", "test");
  expect(
    (await runFrlMockDelivery({ ...input, kind: "marketing" })).status,
  ).toBe("blocked");
  const row = await prisma.frlWebIntake.findFirstOrThrow();
  await prisma.$transaction(async (tx) => {
    await tx.frlMockDelivery.deleteMany({ where: { intake_id: row.id } });
    await tx.frlWebIntake.update({
      where: { id: row.id },
      data: { account_id: "org_mock_2" },
    });
    await tx.frlMockDelivery.create({
      data: { account_id: "org_mock_2", intake_id: row.id, kind: "crm" },
    });
  });
  expect((await runFrlMockDelivery(input)).status).toBe("blocked");
  expect(
    await prisma.frlMockDelivery.count({ where: { attempt_count: { gt: 0 } } }),
  ).toBe(0);
});
test("lost settlement reports uncertainty and preserves the claim against resending", async () => {
  const { reference } = await intake();
  await prisma.$executeRawUnsafe(
    `CREATE FUNCTION "frl_runner_fail_settlement"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'frl_mock_delivery.settled' THEN RAISE EXCEPTION 'synthetic settlement outage'; END IF; RETURN NEW; END $$`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER "frl_runner_fail_settlement" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "frl_runner_fail_settlement"()`,
  );
  try {
    const input = {
      reference,
      kind: "crm" as const,
      scenario: "confirmed" as const,
    };
    expect(await runFrlMockDelivery(input)).toEqual({
      status: "uncertain",
      mode: "mock",
      settlementRecorded: false,
    });
    expect((await runFrlMockDelivery(input)).status).toBe("dispatching");
    await prisma.frlMockDelivery.updateMany({
      where: { kind: "crm" },
      data: { lease_until: new Date(0) },
    });
    expect((await runFrlMockDelivery(input)).status).toBe("uncertain");
    expect(
      (await prisma.frlMockDelivery.findFirst({ where: { kind: "crm" } }))
        ?.attempt_count,
    ).toBe(1);
  } finally {
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER "frl_runner_fail_settlement" ON "AuditLog"`,
    );
    await prisma.$executeRawUnsafe(
      `DROP FUNCTION "frl_runner_fail_settlement"()`,
    );
  }
});
