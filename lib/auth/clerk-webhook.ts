import "@/lib/serverOnlyGuard";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Svix-compatible Clerk webhook signature verification (ADR-0009).
 *
 * Clerk signs webhooks via Svix. The signature is an HMAC-SHA256 over
 * `${svix-id}.${svix-timestamp}.${rawBody}` keyed by the base64 secret that
 * follows the `whsec_` prefix, encoded as base64. The `svix-signature` header
 * is a space-delimited list of `v<n>,<sig>` entries; a match against any v1
 * entry (constant-time) verifies the payload.
 *
 * Verification runs before the body is parsed and before any mutation, and
 * rejects timestamps outside a 5-minute window for replay protection.
 */

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export type ClerkWebhookVerification =
  | { ok: true }
  | { ok: false; reason: string };

export interface ClerkWebhookHeaders {
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
}

export function verifyClerkWebhook(params: {
  secret: string;
  payload: string;
  headers: ClerkWebhookHeaders;
  now?: number;
}): ClerkWebhookVerification {
  const { secret, payload, headers } = params;
  const { svixId, svixTimestamp, svixSignature } = headers;

  if (!svixId || !svixTimestamp || !svixSignature) {
    return { ok: false, reason: "missing_headers" };
  }

  const timestampSeconds = Number(svixTimestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return { ok: false, reason: "invalid_timestamp" };
  }
  const now = params.now ?? Date.now();
  if (Math.abs(now - timestampSeconds * 1000) > FIVE_MINUTES_MS) {
    return { ok: false, reason: "timestamp_out_of_tolerance" };
  }

  const secretKey = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const secretBytes = Buffer.from(secretKey, "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  const expected = createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");
  const expectedBytes = Buffer.from(expected);

  const provided = svixSignature
    .split(" ")
    .map((entry) => (entry.includes(",") ? entry.split(",")[1] : entry));

  const matched = provided.some((sig) => {
    const sigBytes = Buffer.from(sig);
    return (
      sigBytes.length === expectedBytes.length &&
      timingSafeEqual(sigBytes, expectedBytes)
    );
  });

  return matched ? { ok: true } : { ok: false, reason: "signature_mismatch" };
}
