import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  decryptCredentials,
  encryptCredentials,
  EncryptionError,
  isEncryptionLive,
} from "@/lib/providers/encryption";

const ORIGINAL_KEY = process.env.RESPONSEOS_PROVIDER_KEY;
const TEST_KEY = randomBytes(32).toString("base64");
const MOCK_SENTINEL_BYTES = Buffer.from("<MOCK_REDACTED>", "utf8");

function setKey(value: string | undefined): void {
  if (value === undefined) {
    delete process.env.RESPONSEOS_PROVIDER_KEY;
  } else {
    process.env.RESPONSEOS_PROVIDER_KEY = value;
  }
}

beforeEach(() => {
  setKey(undefined);
});

afterEach(() => {
  setKey(ORIGINAL_KEY);
});

describe("encryption / mock-mode fallback (no key)", () => {
  test("isEncryptionLive() returns false when env var is absent", () => {
    expect(isEncryptionLive()).toBe(false);
  });

  test("encryptCredentials returns the mock-sentinel bytes when no key is set", () => {
    const ciphertext = encryptCredentials(
      { api_key: "should-never-leak", secret: "also-secret" },
      { accountId: "acct_test_1", provider: "twilio" },
    );
    expect(ciphertext.equals(MOCK_SENTINEL_BYTES)).toBe(true);
  });

  test("decryptCredentials returns a redacted mock map when given sentinel bytes", () => {
    const result = decryptCredentials(MOCK_SENTINEL_BYTES, {
      accountId: "acct_test_1",
      provider: "hubspot",
    });
    expect(result).toMatchObject({ redacted: true, provider: "hubspot" });
  });

  test("decrypting non-sentinel bytes throws when no key is set", () => {
    expect(() =>
      decryptCredentials(Buffer.from("not-a-sentinel"), {
        accountId: "acct_test_1",
        provider: "twilio",
      }),
    ).toThrow(EncryptionError);
  });
});

describe("encryption / live mode (key set)", () => {
  beforeEach(() => {
    setKey(TEST_KEY);
  });

  test("isEncryptionLive() returns true when a valid 32-byte key is set", () => {
    expect(isEncryptionLive()).toBe(true);
  });

  test("round-trip: encrypt then decrypt returns the same plaintext object", () => {
    const ctx = { accountId: "acct_test_1", provider: "twilio" };
    const plaintext = { account_sid: "AC123", auth_token: "abcdef1234" };
    const ciphertext = encryptCredentials(plaintext, ctx);
    const decrypted = decryptCredentials(ciphertext, ctx);
    expect(decrypted).toEqual(plaintext);
  });

  test("ciphertext envelope has version=1, algorithm=1 prefix", () => {
    const ciphertext = encryptCredentials(
      { secret: "x" },
      { accountId: "acct_test_1", provider: "twilio" },
    );
    expect(ciphertext[0]).toBe(1);
    expect(ciphertext[1]).toBe(1);
  });

  test("ciphertext never contains the plaintext substring as UTF-8 bytes", () => {
    const plaintext = { auth_token: "super-secret-token-do-not-leak-67890" };
    const ciphertext = encryptCredentials(plaintext, {
      accountId: "acct_test_1",
      provider: "twilio",
    });
    expect(ciphertext.includes(Buffer.from(plaintext.auth_token, "utf8"))).toBe(
      false,
    );
  });

  test("AAD binding: decrypting with a different (accountId, provider) fails", () => {
    const ciphertext = encryptCredentials(
      { secret: "x" },
      { accountId: "acct_test_1", provider: "twilio" },
    );
    expect(() =>
      decryptCredentials(ciphertext, {
        accountId: "acct_other",
        provider: "twilio",
      }),
    ).toThrow(EncryptionError);
    expect(() =>
      decryptCredentials(ciphertext, {
        accountId: "acct_test_1",
        provider: "hubspot",
      }),
    ).toThrow(EncryptionError);
  });

  test("tampered ciphertext (flipped byte) fails decryption with auth tag mismatch", () => {
    const ctx = { accountId: "acct_test_1", provider: "twilio" };
    const ciphertext = encryptCredentials({ secret: "x" }, ctx);
    const tampered = Buffer.from(ciphertext);
    // Flip the last byte (part of the auth tag).
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decryptCredentials(tampered, ctx)).toThrow(EncryptionError);
  });

  test("two encryptions of the same plaintext produce different ciphertexts (random nonce)", () => {
    const ctx = { accountId: "acct_test_1", provider: "twilio" };
    const plaintext = { secret: "constant-value" };
    const first = encryptCredentials(plaintext, ctx);
    const second = encryptCredentials(plaintext, ctx);
    expect(first.equals(second)).toBe(false);
  });

  test("mock-sentinel still decrypts to a redacted map even when a key is set", () => {
    const result = decryptCredentials(MOCK_SENTINEL_BYTES, {
      accountId: "acct_test_1",
      provider: "twilio",
    });
    expect(result).toMatchObject({ redacted: true, provider: "twilio" });
  });

  test("EncryptionError never includes the plaintext in its message", () => {
    const ctx = { accountId: "acct_test_1", provider: "twilio" };
    const plaintext = { auth_token: "this-string-must-not-appear" };
    const ciphertext = encryptCredentials(plaintext, ctx);
    const tampered = Buffer.from(ciphertext);
    tampered[tampered.length - 1] ^= 0xff;
    try {
      decryptCredentials(tampered, ctx);
      throw new Error("expected EncryptionError");
    } catch (e) {
      expect(e).toBeInstanceOf(EncryptionError);
      const err = e as EncryptionError;
      expect(err.message).not.toContain(plaintext.auth_token);
      expect(JSON.stringify(err)).not.toContain(plaintext.auth_token);
    }
  });
});

describe("encryption / key validation", () => {
  test("key with wrong length is treated as mock mode", () => {
    setKey(Buffer.alloc(16).toString("base64"));
    expect(isEncryptionLive()).toBe(false);
  });

  test("empty key string is treated as mock mode", () => {
    setKey("");
    expect(isEncryptionLive()).toBe(false);
  });
});
