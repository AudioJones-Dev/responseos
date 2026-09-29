import { describe, expect, test } from "vitest";
import { sanitizeCrmText } from "@/lib/crm/sanitization";

describe("sanitizeCrmText", () => {
  test("removes email and phone values before CRM export", () => {
    expect(sanitizeCrmText("Call sam@example.com at +1 (786) 555-0100 tomorrow."))
      .toBe("Call [email redacted] at [phone redacted] tomorrow.");
  });

  test("removes international numbers written with a country code", () => {
    expect(sanitizeCrmText("Call +44 20 7946 0958 or +33 1 42 68 53 00."))
      .toBe("Call [phone redacted] or [phone redacted].");
  });

  test("leaves dates and amounts alone", () => {
    expect(sanitizeCrmText("Booked 2026-09-28 for $1,250.")).toBe("Booked 2026-09-28 for $1,250.");
  });

  test("never exports an unbounded summary", () => {
    expect(sanitizeCrmText("x".repeat(2_500))).toHaveLength(2_000);
  });
});
