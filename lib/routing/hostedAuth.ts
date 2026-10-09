import "@/lib/serverOnlyGuard";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const credentialSchema = z.object({
  keyId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  secret: z.string().min(32),
  accountId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  environment: z.enum(["test", "preview"]),
  audience: z.string().min(1).max(120),
  retentionDays: z.number().int().min(1).max(90),
}).strict();
export type HostedAuthority = Omit<z.infer<typeof credentialSchema>, "secret">;
export class HostedIntakeError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
export const hostedIntakePath = "/api/webhooks/frl/v1/intakes";
export function hostedSigningText(timestamp: string, submissionId: string, audience: string, body: Uint8Array) {
  return `responseos-hosted-intake.v1\nPOST\n${hostedIntakePath}\n${audience}\n${timestamp}\n${submissionId}\n${createHash("sha256").update(body).digest("hex")}`;
}
export async function authenticateHostedIntake(request: Request, env: Readonly<Record<string, string | undefined>> = process.env) {
  if (env.RESPONSEOS_HOSTED_INTAKE_ENABLED !== "true") throw new HostedIntakeError(503, "intake_disabled");
  let credentials: z.infer<typeof credentialSchema>[];
  try {
    credentials = z.array(credentialSchema).min(1).max(20).parse(JSON.parse(env.RESPONSEOS_HOSTED_INTAKE_KEYS ?? ""));
    if (new Set(credentials.map(c => c.keyId)).size !== credentials.length) throw new Error();
  } catch { throw new HostedIntakeError(503, "credential_configuration_invalid"); }
  const keyId = request.headers.get("x-responseos-key-id");
  const credential = credentials.find(c => c.keyId === keyId);
  const timestamp = request.headers.get("x-responseos-timestamp") ?? "";
  const submissionId = request.headers.get("idempotency-key") ?? "";
  const signature = request.headers.get("x-responseos-signature") ?? "";
  if (!credential || request.method !== "POST" || new URL(request.url).pathname !== hostedIntakePath ||
      !/^\d{10}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId) ||
      !/^v1=[0-9a-f]{64}$/.test(signature)) throw new HostedIntakeError(401, "authentication_failed");
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  if (reader) for (;;) {
    const next = await reader.read(); if (next.done) break;
    size += next.value.length;
    if (size > 16384) { await reader.cancel(); throw new HostedIntakeError(413, "payload_too_large"); }
    chunks.push(next.value);
  }
  const body = Buffer.concat(chunks);
  const expected = createHmac("sha256", credential.secret).update(hostedSigningText(timestamp, submissionId, credential.audience, body)).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature.slice(3), "hex"))) throw new HostedIntakeError(401, "authentication_failed");
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)); }
  catch { throw new HostedIntakeError(400, "invalid_payload"); }
  const authority: HostedAuthority = { keyId: credential.keyId, accountId: credential.accountId, environment: credential.environment, audience: credential.audience, retentionDays: credential.retentionDays };
  return { authority, submissionId: submissionId.toLowerCase(), payload };
}
