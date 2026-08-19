import { describe, expect, test } from "vitest";
import {
  hashProspectPayload,
  isValidIdempotencyKey,
} from "@/lib/data/prospectIntakes";

describe("prospect intake contract", () => {
  test("accepts bounded opaque idempotency keys", () => {
    expect(isValidIdempotencyKey("audit:12345678")).toBe(true);
    expect(isValidIdempotencyKey("short")).toBe(false);
    expect(isValidIdempotencyKey("contains spaces")).toBe(false);
  });

  test("hashes identical validated payloads deterministically", () => {
    const payload = { name: "Jordan", email: "jordan@example.com", business_name: "Example" };
    expect(hashProspectPayload(payload)).toBe(hashProspectPayload({ ...payload }));
  });
});
