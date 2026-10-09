import "@/lib/serverOnlyGuard";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export class FrlTestIngressError extends Error {
  constructor(readonly status: number) {
    super("Test intake unavailable or invalid.");
  }
}

export async function verifyFrlTestRequest(request: Request) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.RESPONSEOS_FRL_TEST_INTAKE_ENABLED !== "true"
  )
    throw new FrlTestIngressError(503);
  const accountId = process.env.RESPONSEOS_FRL_TEST_ACCOUNT_ID;
  const secret = process.env.RESPONSEOS_FRL_TEST_SIGNING_SECRET;
  if (
    !accountId ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(accountId) ||
    !secret ||
    secret.length < 32
  )
    throw new FrlTestIngressError(503);
  const timestamp = request.headers.get("x-frl-timestamp") ?? "";
  const submissionId = request.headers.get("idempotency-key") ?? "";
  const signature = request.headers.get("x-frl-signature") ?? "";
  if (
    request.method !== "POST" ||
    new URL(request.url).pathname !== "/api/frl-test-intakes" ||
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      submissionId,
    ) ||
    !/^v1=[0-9a-f]{64}$/.test(signature)
  )
    throw new FrlTestIngressError(401);
  const chunks: Uint8Array[] = [];
  const reader = request.body?.getReader();
  let size = 0;
  if (reader)
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new FrlTestIngressError(413);
      }
      chunks.push(value);
    }
  const body = Buffer.concat(chunks);
  const digest = createHash("sha256").update(body).digest("hex");
  const signed = `v1\nPOST\n/api/frl-test-intakes\n${timestamp}\n${submissionId}\n${digest}`;
  const expected = createHmac("sha256", secret).update(signed).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature.slice(3), "hex")))
    throw new FrlTestIngressError(401);
  let payload: unknown;
  try {
    payload = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(body),
    );
  } catch {
    throw new FrlTestIngressError(400);
  }
  return { accountId, submissionId, payload };
}
