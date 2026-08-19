import { describe, expect, test } from "vitest";
import { sanitizeCrmText } from "@/lib/crm/sanitization";

describe("sanitizeCrmText", () => {
  test("removes email and phone values before CRM export", () => {
    expect(sanitizeCrmText("Call sam@example.com at +1 (786) 555-0100 tomorrow."))
      .toBe("Call [email redacted] at [phone redacted] tomorrow.");
  });

  test("never exports an unbounded summary", () => {
    expect(sanitizeCrmText("x".repeat(2_500))).toHaveLength(2_000);
  });
});
