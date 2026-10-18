import { beforeEach } from "vitest";

beforeEach(() => {
  process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_KEY_ID = "synthetic-local-v1";
  process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_KEYS_JSON = JSON.stringify({ "synthetic-local-v1": "42".repeat(32) });
  process.env.RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS = "3600";
});
