import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  claimFrlMockDelivery,
  settleFrlMockDelivery,
} from "@/lib/data/frlMockDelivery";
import {
  persistFrlWebIntake,
  purgeExpiredFrlWebIntakePayloads,
} from "@/lib/data/frlWebIntakes";
import {
  disconnectTestDb,
  prisma,
  resetAndSeedTestDb,
  setDevSession,
} from "./setup";

const request = {
  schemaVersion: 1,
  need: "New equipment + installation",
  equipment: "Platform lift",
  building: "Home",
  city: "TEST ONLY",
  name: "Synthetic Test",
  email: "test@example.com",
  sourcePage: "/services/vertical-platform-lifts/builders-contractors",
  contactConsent: true,
  emailUpdates: false,
  audience: "builder",
  professionalRole: "gc",
  projectStage: "planning",
  organizationName: "Synthetic Company",
  timeline: "TEST ONLY",
  requestPurpose: "scope-coordination",
};

beforeEach(async () => {
  await resetAndSeedTestDb();
  setDevSession("client_admin@org_mock_1");
});
afterAll(disconnectTestDb);
afterEach(() => vi.unstubAllEnvs());

test.each(["dispatching", "uncertain"] as const)(
  "preserves expired payload with %s delivery",
  async (status) => {
    vi.stubEnv("RESPONSEOS_FRL_MOCK_DISPATCH_ENABLED", "true");
    const receipt = await persistFrlWebIntake({
      submissionId: randomUUID(),
      environment: "test",
      request,
    });
    const claim = await claimFrlMockDelivery(receipt.reference, "crm");
    if (claim.status !== "claimed") throw new Error("Expected claim");
    if (status === "uncertain")
      await settleFrlMockDelivery({
        operationId: claim.operationId,
        token: claim.token,
        outcome: "uncertain",
      });
    await prisma.frlWebIntake.updateMany({ data: { expires_at: new Date(0) } });
    expect(await purgeExpiredFrlWebIntakePayloads()).toEqual({ purged: 0 });
    expect(await prisma.frlWebIntake.findFirst()).toMatchObject({
      purged_at: null,
      request_json: request,
    });
  },
);

test("concurrent uncertain settlement and purge preserve recovery data", async () => {
  vi.stubEnv("RESPONSEOS_FRL_MOCK_DISPATCH_ENABLED", "true");
  const receipt = await persistFrlWebIntake({
    submissionId: randomUUID(),
    environment: "test",
    request,
  });
  const claim = await claimFrlMockDelivery(receipt.reference, "crm");
  if (claim.status !== "claimed") throw new Error("Expected claim");
  const storedPayload = (await prisma.frlWebIntake.findFirstOrThrow())
    .request_json;
  await prisma.frlWebIntake.updateMany({ data: { expires_at: new Date(0) } });
  const [, purged] = await Promise.all([
    settleFrlMockDelivery({
      operationId: claim.operationId,
      token: claim.token,
      outcome: "uncertain",
    }),
    purgeExpiredFrlWebIntakePayloads(),
  ]);
  expect(purged).toEqual({ purged: 0 });
  expect((await prisma.frlWebIntake.findFirst())?.request_json).toEqual(
    storedPayload,
  );
});

test("terminal mock outcomes permit expiry purge without deleting delivery evidence", async () => {
  vi.stubEnv("RESPONSEOS_FRL_MOCK_DISPATCH_ENABLED", "true");
  for (const outcome of ["confirmed", "rejected"] as const) {
    const receipt = await persistFrlWebIntake({
      submissionId: randomUUID(),
      environment: "test",
      request,
    });
    const claim = await claimFrlMockDelivery(receipt.reference, "crm");
    if (claim.status !== "claimed") throw new Error("Expected claim");
    await settleFrlMockDelivery({
      operationId: claim.operationId,
      token: claim.token,
      outcome,
      ...(outcome === "confirmed" ? { receiptId: "mock_retention_test" } : {}),
    });
  }
  await prisma.frlWebIntake.updateMany({ data: { expires_at: new Date(0) } });
  expect(await purgeExpiredFrlWebIntakePayloads()).toEqual({ purged: 2 });
  expect(
    await prisma.frlMockDelivery.count({
      where: { status: { in: ["confirmed", "rejected"] } },
    }),
  ).toBe(2);
});

test("persists all professional fields and replays a durable receipt without another audit event", async () => {
  const input = {
    submissionId: randomUUID(),
    environment: "test" as const,
    request,
  };
  const first = await persistFrlWebIntake(input);
  const again = await persistFrlWebIntake(input);
  expect(first).toMatchObject({ replay: false, deliveryStatus: "blocked" });
  expect(again).toEqual({ ...first, replay: true });
  expect(await prisma.frlWebIntake.findFirst()).toMatchObject({
    account_id: "org_mock_1",
    request_json: request,
    delivery_status: "blocked",
  });
  expect(
    await prisma.auditLog.count({
      where: { action: "frl_web_intake.received" },
    }),
  ).toBe(1);
});

test("serializes concurrent inserts to one receipt", async () => {
  const input = {
    submissionId: randomUUID(),
    environment: "test" as const,
    request,
  };
  const results = await Promise.all(
    Array.from({ length: 5 }, () => persistFrlWebIntake(input)),
  );
  expect(new Set(results.map((r) => r.reference)).size).toBe(1);
  expect(results.filter((r) => !r.replay)).toHaveLength(1);
  expect(await prisma.frlWebIntake.count()).toBe(1);
});

test("conflicts on changed payload and canonicalizes parsed object order", async () => {
  const input = {
    submissionId: randomUUID(),
    environment: "test" as const,
    request,
  };
  await persistFrlWebIntake(input);
  expect(
    (
      await persistFrlWebIntake({
        ...input,
        request: Object.fromEntries(Object.entries(request).reverse()),
      })
    ).replay,
  ).toBe(true);
  await expect(
    persistFrlWebIntake({
      ...input,
      request: { ...request, timeline: "Changed" },
    }),
  ).rejects.toMatchObject({ code: "conflict" });
});

test("separates environment and genuinely new submission identities", async () => {
  const input = {
    submissionId: randomUUID(),
    environment: "test" as const,
    request,
  };
  await persistFrlWebIntake(input);
  await persistFrlWebIntake({ ...input, environment: "preview" });
  await persistFrlWebIntake({ ...input, submissionId: randomUUID() });
  expect(await prisma.frlWebIntake.count()).toBe(3);
});

test("fails closed without a selected session tenant or with viewer permissions", async () => {
  const input = {
    submissionId: randomUUID(),
    environment: "test" as const,
    request,
  };
  setDevSession("aj_admin");
  await expect(persistFrlWebIntake(input)).rejects.toMatchObject({
    code: "tenant_required",
  });
  setDevSession("client_viewer@org_mock_1");
  await expect(persistFrlWebIntake(input)).rejects.toBeDefined();
  expect(await prisma.frlWebIntake.count()).toBe(0);
});

test("purges expired payload while retaining duplicate identity and audit reference", async () => {
  const input = {
    submissionId: randomUUID(),
    environment: "test" as const,
    request,
  };
  const first = await persistFrlWebIntake(input);
  await prisma.frlWebIntake.updateMany({ data: { expires_at: new Date(0) } });
  expect(await purgeExpiredFrlWebIntakePayloads()).toEqual({ purged: 1 });
  expect(await prisma.frlWebIntake.findFirst()).toMatchObject({
    request_json: null,
    reference: first.reference,
  });
  expect((await persistFrlWebIntake(input)).replay).toBe(true);
  expect(
    await prisma.auditLog.count({
      where: { action: "frl_web_intake.payload_purged" },
    }),
  ).toBe(1);
});

test("database refuses delivery activation", async () => {
  await persistFrlWebIntake({
    submissionId: randomUUID(),
    environment: "test",
    request,
  });
  await expect(
    prisma.frlWebIntake.updateMany({ data: { delivery_status: "pending" } }),
  ).rejects.toBeDefined();
});
