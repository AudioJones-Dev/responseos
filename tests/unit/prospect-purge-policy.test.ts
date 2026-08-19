import { describe, expect, test } from "vitest";
import { assertProspectPurgeAllowed } from "@/lib/prospects/purgePolicy";

describe("assertProspectPurgeAllowed", () => {
  test("requires an explicit enable flag and account", () => {
    expect(() => assertProspectPurgeAllowed({})).toThrow(
      "RESPONSEOS_PROSPECT_PURGE_ENABLED=true",
    );
    expect(() =>
      assertProspectPurgeAllowed({ RESPONSEOS_PROSPECT_PURGE_ENABLED: "true" }),
    ).toThrow("RESPONSEOS_INBOUND_ACCOUNT_ID");
  });

  test("refuses production", () => {
    expect(() =>
      assertProspectPurgeAllowed({
        RESPONSEOS_PROSPECT_PURGE_ENABLED: "true",
        RESPONSEOS_INBOUND_ACCOUNT_ID: "demo-account",
        VERCEL_ENV: "production",
      }),
    ).toThrow("disabled in production");
  });

  test("returns the scoped non-production account", () => {
    expect(
      assertProspectPurgeAllowed({
        RESPONSEOS_PROSPECT_PURGE_ENABLED: "true",
        RESPONSEOS_INBOUND_ACCOUNT_ID: "demo-account",
        VERCEL_ENV: "preview",
      }),
    ).toBe("demo-account");
  });
});
