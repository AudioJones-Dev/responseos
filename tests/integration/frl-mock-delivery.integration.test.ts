import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, expect, test, vi } from "vitest";
import {
  persistFrlWebIntake,
  purgeExpiredFrlWebIntakePayloads,
} from "@/lib/data/frlWebIntakes";
import {
  claimFrlMockDelivery,
  settleFrlMockDelivery,
  requeueRejectedFrlMockDelivery,
} from "@/lib/data/frlMockDelivery";
import {
  disconnectTestDb,
  prisma,
  resetAndSeedTestDb,
  setDevSession,
} from "./setup";

const request = {
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
  emailUpdates: false,
};
beforeEach(async () => {
  vi.unstubAllEnvs();
  await resetAndSeedTestDb();
  setDevSession("client_admin@org_mock_1");
  vi.stubEnv("RESPONSEOS_FRL_MOCK_DISPATCH_ENABLED", "true");
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await disconnectTestDb();
});
async function receipt(
  environment: "test" | "preview" | "production" = "test",
  optIn = false,
) {
  return persistFrlWebIntake({
    submissionId: randomUUID(),
    environment,
    request: { ...request, emailUpdates: optIn },
  });
}
async function claim(
  reference: string,
  kind: "crm" | "notification" | "marketing" = "crm",
) {
  const result = await claimFrlMockDelivery(reference, kind);
  if (result.status !== "claimed") throw new Error("Expected mock claim");
  return result;
}

test("expired receipt still records expired dispatch uncertainty once and retains recovery payload", async () => {
  const intake = await receipt();
  const current = await claim(intake.reference);
  await prisma.frlWebIntake.updateMany({ data: { expires_at: new Date(0) } });
  await prisma.frlMockDelivery.update({
    where: { id: current.operationId },
    data: { lease_until: new Date(0) },
  });
  expect(await claimFrlMockDelivery(intake.reference, "crm")).toEqual({
    status: "uncertain",
  });
  expect(await claimFrlMockDelivery(intake.reference, "crm")).toEqual({
    status: "uncertain",
  });
  expect(
    await prisma.frlMockDelivery.findUnique({
      where: { id: current.operationId },
    }),
  ).toMatchObject({
    status: "uncertain",
    dispatch_token: null,
    lease_until: null,
    attempt_count: 1,
  });
  expect(
    await prisma.auditLog.count({
      where: {
        action: "frl_mock_delivery.lease_expired",
        target_id: current.operationId,
      },
    }),
  ).toBe(1);
  expect(await purgeExpiredFrlWebIntakePayloads()).toEqual({ purged: 0 });
  expect((await prisma.frlWebIntake.findFirst())?.request_json).not.toBeNull();
});

test("expired receipt cannot begin a fresh delivery attempt", async () => {
  const intake = await receipt();
  await prisma.frlWebIntake.updateMany({ data: { expires_at: new Date(0) } });
  expect(await claimFrlMockDelivery(intake.reference, "crm")).toEqual({
    status: "blocked",
  });
  expect(
    await prisma.frlMockDelivery.count({ where: { attempt_count: { gt: 0 } } }),
  ).toBe(0);
  expect(
    await prisma.auditLog.count({
      where: { action: "frl_mock_delivery.claimed" },
    }),
  ).toBe(0);
});

test("expired receipt preserves a current dispatch lease without another claim", async () => {
  const intake = await receipt();
  const current = await claim(intake.reference);
  await prisma.frlWebIntake.updateMany({ data: { expires_at: new Date(0) } });
  expect(await claimFrlMockDelivery(intake.reference, "crm")).toEqual({
    status: "dispatching",
  });
  expect(
    await prisma.frlMockDelivery.findUnique({
      where: { id: current.operationId },
    }),
  ).toMatchObject({ dispatch_token: current.token, attempt_count: 1 });
});

test("commits unique blocked intents with receipt, suppressing marketing without consent", async () => {
  const input = {
    submissionId: randomUUID(),
    environment: "test" as const,
    request,
  };
  await persistFrlWebIntake(input);
  await persistFrlWebIntake(input);
  expect(await prisma.frlMockDelivery.count()).toBe(2);
  expect(
    await prisma.frlMockDelivery.count({ where: { kind: "marketing" } }),
  ).toBe(0);
});

test("allows one concurrent claim and confirmed replay without another attempt", async () => {
  const intake = await receipt();
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      claimFrlMockDelivery(intake.reference, "crm"),
    ),
  );
  const claimed = results.filter((r) => r.status === "claimed");
  expect(claimed).toHaveLength(1);
  const winner = claimed[0];
  if (winner.status !== "claimed") throw new Error("Missing claim");
  await settleFrlMockDelivery({
    operationId: winner.operationId,
    token: winner.token,
    outcome: "confirmed",
    receiptId: "mock_crm_1",
  });
  expect(await claimFrlMockDelivery(intake.reference, "crm")).toEqual({
    status: "confirmed",
    receiptId: "mock_crm_1",
  });
  expect(
    (
      await prisma.frlMockDelivery.findUnique({
        where: { id: winner.operationId },
      })
    )?.attempt_count,
  ).toBe(1);
});

test("expired dispatch remains uncertain instead of being reclaimed after a crash", async () => {
  const intake = await receipt();
  const first = await claim(intake.reference);
  await prisma.frlMockDelivery.update({
    where: { id: first.operationId },
    data: { lease_until: new Date(0) },
  });
  expect(await claimFrlMockDelivery(intake.reference, "crm")).toEqual({
    status: "uncertain",
  });
  expect(await claimFrlMockDelivery(intake.reference, "crm")).toMatchObject({
    status: "uncertain",
  });
  await expect(
    settleFrlMockDelivery({
      operationId: first.operationId,
      token: first.token,
      outcome: "confirmed",
      receiptId: "mock_late",
    }),
  ).rejects.toMatchObject({ code: "conflict" });
  await expect(
    requeueRejectedFrlMockDelivery(first.operationId, "mock_nonacceptance_1"),
  ).rejects.toMatchObject({ code: "conflict" });
});

test("rejects wrong fencing token and persists ambiguous outcome without retry", async () => {
  const intake = await receipt();
  const first = await claim(intake.reference);
  await expect(
    settleFrlMockDelivery({
      operationId: first.operationId,
      token: randomUUID(),
      outcome: "uncertain",
    }),
  ).rejects.toMatchObject({ code: "conflict" });
  await settleFrlMockDelivery({
    operationId: first.operationId,
    token: first.token,
    outcome: "uncertain",
  });
  expect(await claimFrlMockDelivery(intake.reference, "crm")).toMatchObject({
    status: "uncertain",
  });
});

test("requires CRM confirmation before notification or marketing claims", async () => {
  const intake = await receipt("test", true);
  expect(
    await claimFrlMockDelivery(intake.reference, "notification"),
  ).toMatchObject({ status: "blocked" });
  const crm = await claim(intake.reference);
  await settleFrlMockDelivery({
    operationId: crm.operationId,
    token: crm.token,
    outcome: "confirmed",
    receiptId: "mock_crm",
  });
  expect((await claim(intake.reference, "notification")).mode).toBe("mock");
  expect((await claim(intake.reference, "marketing")).mode).toBe("mock");
});

test.each(["preview", "production"] as const)(
  "blocks %s receipt delivery even with test flag",
  async (environment) => {
    const intake = await receipt(environment);
    expect(await claimFrlMockDelivery(intake.reference, "crm")).toEqual({
      status: "blocked",
    });
  },
);

test("blocks disabled flag and production runtime", async () => {
  const intake = await receipt();
  vi.stubEnv("RESPONSEOS_FRL_MOCK_DISPATCH_ENABLED", "false");
  expect(await claimFrlMockDelivery(intake.reference, "crm")).toEqual({
    status: "blocked",
  });
  vi.stubEnv("RESPONSEOS_FRL_MOCK_DISPATCH_ENABLED", "true");
  vi.stubEnv("NODE_ENV", "production");
  await expect(
    claimFrlMockDelivery(intake.reference, "crm"),
  ).rejects.toBeDefined();
});

test("allows bounded operator retry only after explicit mock nonacceptance", async () => {
  const intake = await receipt();
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await claim(intake.reference);
    await settleFrlMockDelivery({
      operationId: current.operationId,
      token: current.token,
      outcome: "rejected",
    });
    if (attempt < 2)
      await requeueRejectedFrlMockDelivery(
        current.operationId,
        `mock_nonacceptance_${attempt}`,
      );
    else
      await expect(
        requeueRejectedFrlMockDelivery(
          current.operationId,
          "mock_nonacceptance_3",
        ),
      ).rejects.toMatchObject({ code: "conflict" });
  }
});

test("refuses live mode and blocks purged receipts", async () => {
  const intake = await receipt();
  await expect(
    prisma.frlMockDelivery.updateMany({ data: { mode: "live" } }),
  ).rejects.toBeDefined();
  await prisma.frlWebIntake.updateMany({ data: { purged_at: new Date() } });
  expect(await claimFrlMockDelivery(intake.reference, "crm")).toEqual({
    status: "blocked",
  });
});

test("failed settlement transaction keeps the durable dispatch claim and cannot authorize resend", async () => {
  const intake = await receipt();
  const first = await claim(intake.reference);
  await prisma.$executeRawUnsafe(
    `CREATE FUNCTION "frl_test_fail_settlement"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'frl_mock_delivery.settled' THEN RAISE EXCEPTION 'synthetic settlement outage'; END IF; RETURN NEW; END $$`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER "frl_test_fail_settlement" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "frl_test_fail_settlement"()`,
  );
  try {
    await expect(
      settleFrlMockDelivery({
        operationId: first.operationId,
        token: first.token,
        outcome: "confirmed",
        receiptId: "mock_accepted",
      }),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(await claimFrlMockDelivery(intake.reference, "crm")).toMatchObject({
      status: "dispatching",
    });
    await prisma.frlMockDelivery.update({
      where: { id: first.operationId },
      data: { lease_until: new Date(0) },
    });
    expect(await claimFrlMockDelivery(intake.reference, "crm")).toMatchObject({
      status: "uncertain",
    });
    expect(
      (
        await prisma.frlMockDelivery.findUnique({
          where: { id: first.operationId },
        })
      )?.attempt_count,
    ).toBe(1);
  } finally {
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER "frl_test_fail_settlement" ON "AuditLog"`,
    );
    await prisma.$executeRawUnsafe(
      `DROP FUNCTION "frl_test_fail_settlement"()`,
    );
  }
});
