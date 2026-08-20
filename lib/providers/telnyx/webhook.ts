import { createPublicKey, verify } from "node:crypto";

export interface TelnyxWebhookEnvelope {
  data: {
    id: string;
    event_type: string;
    occurred_at?: string;
    payload: Record<string, unknown>;
  };
}

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
export const TELNYX_MAX_WEBHOOK_AGE_SECONDS = 300;

function publicKeyFromConfig(value: string) {
  if (value.includes("BEGIN PUBLIC KEY")) return createPublicKey(value);
  const raw = Buffer.from(value, "base64");
  if (raw.length !== 32) throw new Error("TELNYX_PUBLIC_KEY must be a 32-byte base64 Ed25519 key or PEM.");
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
    format: "der",
    type: "spki",
  });
}

export function verifyTelnyxWebhook(params: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  publicKey: string;
  now?: Date;
}): { ok: true } | { ok: false; reason: "missing" | "stale" | "invalid" } {
  if (!params.signature || !params.timestamp) return { ok: false, reason: "missing" };
  const timestamp = Number(params.timestamp);
  if (!Number.isFinite(timestamp)) return { ok: false, reason: "invalid" };
  const nowSeconds = Math.floor((params.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - timestamp) > TELNYX_MAX_WEBHOOK_AGE_SECONDS) {
    return { ok: false, reason: "stale" };
  }

  try {
    const signedPayload = Buffer.from(`${params.timestamp}|${params.rawBody}`);
    const signature = Buffer.from(params.signature, "base64");
    return verify(null, signedPayload, publicKeyFromConfig(params.publicKey), signature)
      ? { ok: true }
      : { ok: false, reason: "invalid" };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export function parseTelnyxWebhook(rawBody: string): TelnyxWebhookEnvelope | null {
  try {
    const parsed = JSON.parse(rawBody) as Partial<TelnyxWebhookEnvelope>;
    const data = parsed.data;
    if (
      !data ||
      typeof data.id !== "string" ||
      typeof data.event_type !== "string" ||
      typeof data.payload !== "object" ||
      data.payload === null ||
      Array.isArray(data.payload)
    ) {
      return null;
    }
    return parsed as TelnyxWebhookEnvelope;
  } catch {
    return null;
  }
}

export function getTelnyxCallId(payload: Record<string, unknown>): string | null {
  for (const key of ["call_control_id", "call_session_id", "conversation_id", "call_leg_id"]) {
    if (typeof payload[key] === "string" && payload[key].length > 0) {
      return payload[key];
    }
  }
  return null;
}
