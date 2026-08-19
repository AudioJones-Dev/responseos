import { describe, expect, test } from "vitest";
import { validateLiveDemoEnvironment } from "@/scripts/validate-live-demo-env.mjs";

const VALID = {
  DATABASE_URL: "postgresql://pooled.example/db",
  DIRECT_URL: "postgresql://direct.example/db",
  CLERK_SECRET_KEY: "placeholder",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "placeholder",
  CLERK_WEBHOOK_SECRET: "placeholder",
  AJ_DIGITAL_CLERK_ORG_ID: "org_control",
  NEXT_PUBLIC_APP_URL: "https://responseos-live-demo.example",
  RESPONSEOS_REQUIRE_AUTH: "1",
  RESPONSEOS_DEPLOYMENT_LANE: "live-demo",
  RESPONSEOS_DEMO_ACCOUNT_ID: "demo-account",
  RESPONSEOS_DEMO_PHONE_E164: "+17867560897",
  TELNYX_PUBLIC_KEY: "placeholder",
  HUBSPOT_ACCESS_TOKEN: "placeholder",
  RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED: "true",
  RESPONSEOS_LIVE_HUBSPOT_ENABLED: "true",
};

describe("live-demo environment contract", () => {
  test("accepts only the isolated explicit live-demo configuration", () => {
    expect(validateLiveDemoEnvironment(VALID)).toEqual([]);
  });

  test("rejects wrong number, disabled execution, and deferred providers", () => {
    const errors = validateLiveDemoEnvironment({
      ...VALID,
      RESPONSEOS_DEMO_PHONE_E164: "+15555550100",
      RESPONSEOS_LIVE_HUBSPOT_ENABLED: "false",
      VAPI_API_KEY: "secret-placeholder",
    });
    expect(errors).toContain("RESPONSEOS_DEMO_PHONE_E164 must equal the authorized demo number");
    expect(errors).toContain("RESPONSEOS_LIVE_HUBSPOT_ENABLED must equal true");
    expect(errors).toContain("Forbidden in live-demo staging: VAPI_API_KEY");
    expect(errors.join(" ")).not.toContain("secret-placeholder");
  });

  test("rejects database drift between GitHub and Vercel", () => {
    expect(
      validateLiveDemoEnvironment(VALID, {
        DATABASE_URL: "postgresql://different.example/db",
        DIRECT_URL: VALID.DIRECT_URL,
      }),
    ).toContain(
      "DATABASE_URL in Vercel must match the GitHub live-demo-staging Environment",
    );
  });
});
