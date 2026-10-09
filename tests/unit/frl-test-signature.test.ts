import { afterEach, expect, test, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { verifyFrlTestRequest } from "@/lib/validation/frl-test-signature";

const id = "46d276ab-f451-4ff0-b7e2-9cd00491c240";
const secret = "synthetic-test-key-not-a-real-credential";
afterEach(() => vi.unstubAllEnvs());
function request(body = "{}", age = 0) {
  vi.stubEnv("RESPONSEOS_FRL_TEST_INTAKE_ENABLED", "true");
  vi.stubEnv("RESPONSEOS_FRL_TEST_ACCOUNT_ID", "org_mock_1");
  vi.stubEnv("RESPONSEOS_FRL_TEST_SIGNING_SECRET", secret);
  const timestamp = String(Math.floor(Date.now() / 1000) - age);
  const digest = createHash("sha256").update(body).digest("hex");
  const signature = createHmac("sha256", secret)
    .update(`v1\nPOST\n/api/frl-test-intakes\n${timestamp}\n${id}\n${digest}`)
    .digest("hex");
  return new Request("http://127.0.0.1:3001/api/frl-test-intakes", {
    method: "POST",
    headers: {
      "Idempotency-Key": id,
      "X-FRL-Timestamp": timestamp,
      "X-FRL-Signature": `v1=${signature}`,
    },
    body,
  });
}
test("derives tenant from server configuration after signature validation", async () => {
  expect(await verifyFrlTestRequest(request())).toMatchObject({
    accountId: "org_mock_1",
    submissionId: id,
    payload: {},
  });
});
test("rejects expired signature", async () => {
  await expect(verifyFrlTestRequest(request("{}", 301))).rejects.toMatchObject({
    status: 401,
  });
});
test("rejects altered identity, signature and oversized actual bytes", async () => {
  const changed = request();
  changed.headers.set(
    "idempotency-key",
    "56d276ab-f451-4ff0-b7e2-9cd00491c240",
  );
  await expect(verifyFrlTestRequest(changed)).rejects.toMatchObject({
    status: 401,
  });
  await expect(
    verifyFrlTestRequest(request(" ".repeat(8193))),
  ).rejects.toMatchObject({ status: 413 });
});
test("fails closed in production", async () => {
  const input = request();
  vi.stubEnv("NODE_ENV", "production");
  await expect(verifyFrlTestRequest(input)).rejects.toMatchObject({
    status: 503,
  });
});
