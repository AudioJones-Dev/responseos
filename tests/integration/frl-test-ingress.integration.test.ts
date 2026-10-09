import { createHash, createHmac, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST } from "@/app/api/frl-test-intakes/route";
import { disconnectTestDb, prisma, resetAndSeedTestDb } from "./setup";

const secret = "synthetic-test-key-not-a-real-credential";
const payload = {
  schemaVersion: 1,
  need: "Service or repair",
  equipment: "Stair lift",
  building: "Home",
  city: "TEST",
  name: "Synthetic Test",
  email: "test@example.com",
  sourcePage: "/",
  audience: "homeowner",
  contactConsent: true,
  emailUpdates: false,
};
function signed(id: string, data: unknown = payload) {
  const body = JSON.stringify(data);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const digest = createHash("sha256").update(body).digest("hex");
  const signature = createHmac("sha256", secret)
    .update(`v1\nPOST\n/api/frl-test-intakes\n${timestamp}\n${id}\n${digest}`)
    .digest("hex");
  return new Request("http://127.0.0.1/api/frl-test-intakes", {
    method: "POST",
    body,
    headers: {
      "Idempotency-Key": id,
      "X-FRL-Timestamp": timestamp,
      "X-FRL-Signature": `v1=${signature}`,
    },
  });
}
beforeEach(async () => {
  await resetAndSeedTestDb();
  vi.stubEnv("RESPONSEOS_FRL_TEST_INTAKE_ENABLED", "true");
  vi.stubEnv("RESPONSEOS_FRL_TEST_ACCOUNT_ID", "org_mock_1");
  vi.stubEnv("RESPONSEOS_FRL_TEST_SIGNING_SECRET", secret);
});
afterEach(() => vi.unstubAllEnvs());
afterAll(disconnectTestDb);

test("lost-response retry returns one durable receipt and two blocked intents", async () => {
  const id = randomUUID();
  const first = await POST(signed(id));
  const firstBody = await first.json();
  const retried = await POST(signed(id));
  expect(first.status).toBe(201);
  expect(retried.status).toBe(200);
  expect(await retried.json()).toEqual({ ...firstBody, replay: true });
  expect(await prisma.frlWebIntake.count()).toBe(1);
  expect(
    await prisma.frlMockDelivery.count({
      where: { status: "blocked", mode: "mock" },
    }),
  ).toBe(2);
  expect(
    await prisma.auditLog.findFirst({
      where: { action: "frl_web_intake.received" },
    }),
  ).toMatchObject({ actor_type: "system", account_id: "org_mock_1" });
  expect((await POST(signed(id, { ...payload, city: "CHANGED" }))).status).toBe(
    409,
  );
  expect(await prisma.frlWebIntake.count()).toBe(1);
});

test("bad signature, caller-selected tenant and production mode cannot persist", async () => {
  const bad = signed(randomUUID());
  bad.headers.set("X-FRL-Signature", `v1=${"0".repeat(64)}`);
  expect((await POST(bad)).status).toBe(401);
  expect(
    (await POST(signed(randomUUID(), { ...payload, accountId: "org_mock_2" })))
      .status,
  ).toBe(400);
  vi.stubEnv("NODE_ENV", "production");
  expect((await POST(signed(randomUUID()))).status).toBe(503);
  expect(await prisma.frlWebIntake.count()).toBe(0);
  expect(await prisma.frlMockDelivery.count()).toBe(0);
});
