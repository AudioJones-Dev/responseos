/**
 * Provider credential encryption per ADR-0020.
 *
 * Posture:
 *   - AES-256-GCM with a 12-byte random nonce per ciphertext.
 *   - AAD bound to `${accountId}:${provider}` (defeats cross-row swap attacks).
 *   - Envelope framing prepended to ciphertext+tag:
 *       [ version: u8 | algorithm: u8 | nonce: 12 bytes | ciphertext+tag ]
 *   - Key is read from `RESPONSEOS_PROVIDER_KEY` (base64-encoded 32 bytes).
 *   - When the env var is absent, the module falls back to mock mode:
 *       * encrypt -> Buffer containing the UTF-8 bytes of MOCK_SENTINEL.
 *       * decrypt -> a deterministic redacted-credential map.
 *     Mock mode is what makes ADR-0001 (mock-first) hold: the app boots
 *     and runs without a real key.
 *
 * The plaintext is JSON. Decryption returns a parsed object. Plaintext is
 * NEVER returned in error messages, log lines, or thrown values.
 *
 * This module is the single chokepoint for credential crypto. lib/data/*
 * accessors take and return opaque ciphertext (Buffer / Bytes) and never
 * touch plaintext. Decryption happens at the provider-adapter boundary
 * (lib/providers/<vendor>/*) when live wiring lands in v0.3.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const ENVELOPE_VERSION = 1;
export const ALGORITHM_AES_256_GCM = 1;
const NONCE_LENGTH = 12;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;
const HEADER_LENGTH = 1 + 1 + NONCE_LENGTH; // version + algorithm + nonce
const MOCK_SENTINEL = "<MOCK_REDACTED>";
const MOCK_SENTINEL_BYTES = Buffer.from(MOCK_SENTINEL, "utf8");

export interface EncryptionContext {
  accountId: string;
  provider: string;
}

/**
 * `true` when the encryption module is operating in real-key mode.
 * `false` when the env var is absent and mock fallback is in force.
 */
export function isEncryptionLive(): boolean {
  return readKey() !== null;
}

/**
 * Encrypt a plaintext credential object for storage. Returns opaque
 * ciphertext bytes suitable for the `Bytes` column on
 * `provider_connections.credentials_encrypted`.
 *
 * Mock fallback (no key): returns the UTF-8 bytes of MOCK_SENTINEL. This
 * is stored verbatim in the column and decrypted to a redacted mock
 * credential map below.
 */
export function encryptCredentials(
  plaintext: Record<string, unknown>,
  ctx: EncryptionContext,
): Buffer {
  const key = readKey();
  if (key === null) {
    return Buffer.from(MOCK_SENTINEL_BYTES);
  }

  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(buildAad(ctx));

  const plaintextBytes = Buffer.from(JSON.stringify(plaintext), "utf8");
  const body = Buffer.concat([cipher.update(plaintextBytes), cipher.final()]);
  const tag = cipher.getAuthTag();

  const header = Buffer.alloc(2);
  header[0] = ENVELOPE_VERSION;
  header[1] = ALGORITHM_AES_256_GCM;

  return Buffer.concat([header, nonce, body, tag]);
}

/**
 * Decrypt opaque ciphertext bytes back to a credential object.
 *
 * Mock fallback applies in two ways:
 *   1. When the ciphertext is MOCK_SENTINEL bytes -> return the
 *      deterministic mock map (regardless of whether a key is set —
 *      keeps mocks/seeds usable even when a real key is configured).
 *   2. When no key is set AND the ciphertext is not the sentinel -> throw.
 *      This makes a missing key noisy, not silent.
 *
 * Plaintext never appears in thrown errors.
 */
export function decryptCredentials(
  ciphertext: Buffer,
  ctx: EncryptionContext,
): Record<string, unknown> {
  if (isMockSentinel(ciphertext)) {
    return buildMockCredentials(ctx.provider);
  }

  const key = readKey();
  if (key === null) {
    throw new EncryptionError("encryption key unavailable", {
      accountId: ctx.accountId,
      provider: ctx.provider,
      reason: "missing_key",
    });
  }

  if (ciphertext.length < HEADER_LENGTH + TAG_LENGTH) {
    throw new EncryptionError("ciphertext too short", {
      accountId: ctx.accountId,
      provider: ctx.provider,
      reason: "short_envelope",
    });
  }

  const version = ciphertext[0];
  const algorithm = ciphertext[1];
  if (version !== ENVELOPE_VERSION || algorithm !== ALGORITHM_AES_256_GCM) {
    throw new EncryptionError("unsupported envelope", {
      accountId: ctx.accountId,
      provider: ctx.provider,
      reason: "envelope_version",
    });
  }

  const nonce = ciphertext.subarray(2, 2 + NONCE_LENGTH);
  const body = ciphertext.subarray(HEADER_LENGTH, ciphertext.length - TAG_LENGTH);
  const tag = ciphertext.subarray(ciphertext.length - TAG_LENGTH);

  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(buildAad(ctx));
  decipher.setAuthTag(tag);

  let plaintextBytes: Buffer;
  try {
    plaintextBytes = Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    throw new EncryptionError("decryption failed", {
      accountId: ctx.accountId,
      provider: ctx.provider,
      reason: "auth_tag_mismatch",
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintextBytes.toString("utf8"));
  } catch {
    throw new EncryptionError("plaintext not valid JSON", {
      accountId: ctx.accountId,
      provider: ctx.provider,
      reason: "json_parse",
    });
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new EncryptionError("plaintext shape invalid", {
      accountId: ctx.accountId,
      provider: ctx.provider,
      reason: "shape",
    });
  }

  return parsed as Record<string, unknown>;
}

export class EncryptionError extends Error {
  readonly code = "encryption_error" as const;
  readonly accountId: string;
  readonly provider: string;
  readonly reason: string;
  constructor(
    message: string,
    fields: { accountId: string; provider: string; reason: string },
  ) {
    super(message);
    this.name = "EncryptionError";
    this.accountId = fields.accountId;
    this.provider = fields.provider;
    this.reason = fields.reason;
  }
}

function readKey(): Buffer | null {
  const raw = process.env.RESPONSEOS_PROVIDER_KEY;
  if (!raw || raw.length === 0) return null;
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    return null;
  }
  if (key.length !== KEY_LENGTH) return null;
  return key;
}

function buildAad(ctx: EncryptionContext): Buffer {
  return Buffer.from(`${ctx.accountId}:${ctx.provider}`, "utf8");
}

function isMockSentinel(ciphertext: Buffer): boolean {
  if (ciphertext.length !== MOCK_SENTINEL_BYTES.length) return false;
  return timingSafeEqual(ciphertext, MOCK_SENTINEL_BYTES);
}

function buildMockCredentials(provider: string): Record<string, unknown> {
  return {
    redacted: true,
    provider,
    note: "mock-mode credentials per ADR-0020; no real secret material",
  };
}
