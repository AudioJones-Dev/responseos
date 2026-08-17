import { describe, expect, test } from "vitest";
import { AuditRequestSchema } from "@/lib/validation/audit-request";

describe("validation/audit-request", () => {
  const valid = {
    name: "Jordan Vega",
    email: "jordan@acmehvac.com",
    business_name: "Acme HVAC",
  };

  test("accepts the minimal required set", () => {
    const parsed = AuditRequestSchema.parse(valid);
    expect(parsed.name).toBe("Jordan Vega");
    expect(parsed.business_name).toBe("Acme HVAC");
  });

  test("rejects a missing email", () => {
    expect(() =>
      AuditRequestSchema.parse({ name: "x", business_name: "y" }),
    ).toThrow();
  });

  test("rejects a malformed email", () => {
    expect(() =>
      AuditRequestSchema.parse({ ...valid, email: "not-an-email" }),
    ).toThrow();
  });

  test("rejects blank required strings", () => {
    expect(() =>
      AuditRequestSchema.parse({ ...valid, business_name: "   " }),
    ).toThrow();
  });

  test("coerces numeric strings and drops empty optionals", () => {
    const parsed = AuditRequestSchema.parse({
      ...valid,
      phone: "",
      monthly_missed_calls: "42",
      avg_job_value_usd: "850",
      close_rate_pct: "35",
    });
    expect(parsed.monthly_missed_calls).toBe(42);
    expect(parsed.avg_job_value_usd).toBe(850);
    expect(parsed.close_rate_pct).toBe(35);
    expect(parsed.phone).toBeUndefined();
  });

  test("rejects an unknown industry", () => {
    expect(() =>
      AuditRequestSchema.parse({ ...valid, industry: "crypto" }),
    ).toThrow();
  });

  test("rejects negative missed-call counts", () => {
    expect(() =>
      AuditRequestSchema.parse({ ...valid, monthly_missed_calls: "-5" }),
    ).toThrow();
  });

  test("rejects close rates outside 0 through 100", () => {
    expect(() =>
      AuditRequestSchema.parse({ ...valid, close_rate_pct: "100.1" }),
    ).toThrow();
    expect(() =>
      AuditRequestSchema.parse({ ...valid, close_rate_pct: "-1" }),
    ).toThrow();
  });
});
