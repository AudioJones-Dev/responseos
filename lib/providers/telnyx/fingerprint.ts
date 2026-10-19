import "@/lib/serverOnlyGuard";
import { createHmac, timingSafeEqual } from "node:crypto";

export interface FingerprintPolicy {
  keyId: string;
  keys: ReadonlyMap<string, Buffer>;
  retentionSeconds: number;
}

export function fingerprintPolicy(): FingerprintPolicy {
  try {
    const keyId = process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_KEY_ID ?? "";
    const retentionSeconds = Number(process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS);
    const configured: unknown = JSON.parse(process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_KEYS_JSON ?? "null");
    if (!configured || typeof configured !== "object" || Array.isArray(configured) || !Number.isSafeInteger(retentionSeconds) || retentionSeconds <= 0 || retentionSeconds > 86400 || !Number.isFinite(new Date(Date.now() + retentionSeconds * 1000).getTime())) throw new Error();
    const keys = new Map<string, Buffer>();
    for (const [id, value] of Object.entries(configured)) {
      if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(id) || typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) throw new Error();
      keys.set(id, Buffer.from(value, "hex"));
    }
    if (!keys.has(keyId)) throw new Error();
    return { keyId, keys, retentionSeconds };
  } catch {
    throw new Error("webhook_fingerprint_configuration_unavailable");
  }
}

export function contentFingerprint(bytes: Uint8Array, key: Buffer) {
  return createHmac("sha256", key).update(bytes).digest("hex");
}

export interface FingerprintedRow {
  payload_erasure_required_at?: Date | null;
  signature_valid: boolean;
  content_fingerprint: string | null;
  fingerprint_version: number | null;
  fingerprint_key_id: string | null;
  payload_expires_at: Date | null;
  payload_purged_at: Date | null;
}

export function assertFingerprintAvailable(row: FingerprintedRow, now: Date, policy = fingerprintPolicy()) {
  if (row.payload_erasure_required_at) throw new Error("webhook_erasure_required");
  if (!row.signature_valid || row.payload_purged_at || !row.payload_expires_at || !Number.isFinite(row.payload_expires_at.getTime()) || row.payload_expires_at <= now) throw new Error("webhook_fingerprint_expired_or_purged");
  if (row.fingerprint_version !== 1 || !row.content_fingerprint || !/^[0-9a-f]{64}$/.test(row.content_fingerprint) || !row.fingerprint_key_id) throw new Error("webhook_fingerprint_unverifiable");
  const key = policy.keys.get(row.fingerprint_key_id);
  if (!key) throw new Error("webhook_fingerprint_key_unavailable");
  return key;
}

export function assertFingerprint(row: FingerprintedRow, bytes: Uint8Array, now: Date, policy = fingerprintPolicy()) {
  const key = assertFingerprintAvailable(row, now, policy);
  if (!timingSafeEqual(Buffer.from(row.content_fingerprint!, "hex"), Buffer.from(contentFingerprint(bytes, key), "hex"))) throw new Error("webhook_fingerprint_conflict");
}
