// Synthetic test scaffold only. Never import into application ingestion.
import { createHmac, timingSafeEqual, verify, type KeyObject } from "node:crypto";
import type { WebhookEvent } from "@prisma/client";
import { prisma } from "./setup";

export const syntheticKey = Buffer.alloc(32, 0x42);
export const syntheticKeyId = "synthetic-local-v1";
export function fingerprint(bytes: Buffer, key: Buffer): string {
  return createHmac("sha256", key).update(bytes).digest("hex");
}
export function identityMatches(row: Pick<WebhookEvent, "content_fingerprint" | "fingerprint_version" | "fingerprint_key_id" | "payload_expires_at" | "payload_purged_at" | "signature_valid">, bytes: Buffer, keys: Map<string, Buffer>, now = new Date()): boolean {
  if (!row.signature_valid || row.payload_purged_at || !row.payload_expires_at || row.payload_expires_at <= now ||
      row.fingerprint_version !== 1 || !row.content_fingerprint || !/^[0-9a-f]{64}$/.test(row.content_fingerprint) || !row.fingerprint_key_id) return false;
  const key = keys.get(row.fingerprint_key_id);
  if (!key) return false;
  return timingSafeEqual(Buffer.from(row.content_fingerprint, "hex"), Buffer.from(fingerprint(bytes, key), "hex"));
}
export async function ingestSynthetic(eventId: string, original: Buffer, signature: Buffer, publicKey: KeyObject) {
  if (!verify(null, original, publicKey, signature)) throw new Error("signature_invalid");
  const digest = fingerprint(original, syntheticKey);
  await prisma.webhookEvent.createMany({ data: [{
    id: `fingerprint-${eventId}`, provider: "synthetic", provider_event_id: eventId,
    event_type: "synthetic", dedupe_hash: `fingerprint-dedupe-${eventId}`,
    signature_valid: true, raw_body: "<REDACTED_SYNTHETIC>",
    content_fingerprint: digest, fingerprint_version: 1, fingerprint_key_id: syntheticKeyId,
    payload_expires_at: new Date(Date.now() + 60_000),
  }], skipDuplicates: true });
  const row = await prisma.webhookEvent.findUniqueOrThrow({ where: { provider_provider_event_id: { provider: "synthetic", provider_event_id: eventId } } });
  if (!identityMatches(row, original, new Map([[syntheticKeyId, syntheticKey]]))) throw new Error("identity_unverifiable_or_conflicting");
  return row;
}
