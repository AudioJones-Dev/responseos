import { describe, expect, test, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { assertFingerprint, contentFingerprint, fingerprintPolicy } from "@/lib/providers/telnyx/fingerprint";
import { verifyTelnyxWebhook } from "@/lib/providers/telnyx/webhook";

const key = Buffer.alloc(32, 0x42);
const bytes = Buffer.from('{"a":1}');
const now = new Date("2026-10-18T00:00:00Z");
const row = () => ({ signature_valid: true, content_fingerprint: contentFingerprint(bytes, key), fingerprint_version: 1, fingerprint_key_id: "synthetic-local-v1", payload_expires_at: new Date(now.getTime() + 1000), payload_purged_at: null });

describe("verified byte identity", () => {
  test("exact bytes survive signature verification, including non-UTF8 distinctions", () => {
    const keys = generateKeyPairSync("ed25519"), timestamp = String(now.getTime() / 1000);
    const original = Buffer.from([0xff, 0xfe]);
    const signature = sign(null, Buffer.concat([Buffer.from(`${timestamp}|`), original]), keys.privateKey).toString("base64");
    const options = { signature, timestamp, now, publicKey: keys.publicKey.export({ type: "spki", format: "pem" }).toString() };
    expect(verifyTelnyxWebhook({ ...options, rawBody: original }).ok).toBe(true);
    expect(verifyTelnyxWebhook({ ...options, rawBody: original.toString("utf8") }).ok).toBe(false);
  });
  test("valid identity matches without JSON canonicalization", () => {
    expect(() => assertFingerprint(row(), bytes, now)).not.toThrow();
    for (const changed of ['{ "a":1}', '{"a":1}\n', '{"a":2}']) expect(() => assertFingerprint(row(), Buffer.from(changed), now)).toThrow("webhook_fingerprint_conflict");
  });
  test.each([
    { fingerprint_version: 2 }, { content_fingerprint: null }, { fingerprint_key_id: null },
    { signature_valid: false }, { payload_expires_at: null }, { payload_expires_at: now }, { payload_purged_at: now },
  ])("fails closed for unavailable evidence %j", patch => {
    expect(() => assertFingerprint({ ...row(), ...patch }, bytes, now)).toThrow();
  });
  test("retired and wrong keys fail without exposing keys", () => {
    expect(() => assertFingerprint(row(), bytes, now, { keyId: "new", keys: new Map(), retentionSeconds: 60 })).toThrow("webhook_fingerprint_key_unavailable");
    expect(() => assertFingerprint(row(), bytes, now, { keyId: "new", keys: new Map([["synthetic-local-v1", Buffer.alloc(32, 1)]]), retentionSeconds: 60 })).toThrow("webhook_fingerprint_conflict");
  });
  test.each(["", "0", "-1", "Infinity", "1.5"])("does not select a retention default for %s", value => {
    vi.stubEnv("RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS", value);
    try { expect(fingerprintPolicy).toThrow("webhook_fingerprint_configuration_unavailable"); } finally { vi.unstubAllEnvs(); }
  });
});
