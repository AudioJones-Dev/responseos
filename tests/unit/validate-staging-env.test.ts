import { describe, expect, test } from "vitest";

import { validateStagingEnvironment } from "@/scripts/validate-staging-env.mjs";

const VALID_ENV = {
  DATABASE_URL: "postgresql://staging-pooled.example/db",
  DIRECT_URL: "postgresql://staging-direct.example/db",
  CLERK_SECRET_KEY: "clerk-secret-placeholder",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "clerk-public-placeholder",
  CLERK_WEBHOOK_SECRET: "clerk-webhook-placeholder",
  AJ_DIGITAL_CLERK_ORG_ID: "org_staging_control",
  NEXT_PUBLIC_APP_URL: "https://responseos-staging.example",
  RESPONSEOS_REQUIRE_AUTH: "1",
};

describe("staging environment contract", () => {
  test("accepts a mock-only authenticated staging configuration", () => {
    expect(validateStagingEnvironment(VALID_ENV)).toEqual([]);
  });

  test("reports missing names without exposing values", () => {
    const errors = validateStagingEnvironment({
      ...VALID_ENV,
      CLERK_SECRET_KEY: "",
    });

    expect(errors).toContain("Missing required staging variable: CLERK_SECRET_KEY");
    expect(errors.join(" ")).not.toContain("clerk-secret-placeholder");
  });

  test.each(["0", "false", "FALSE", ""])(
    "rejects disabled auth value %o",
    (value) => {
      const errors = validateStagingEnvironment({
        ...VALID_ENV,
        RESPONSEOS_REQUIRE_AUTH: value,
      });
      expect(errors).toContain(
        "RESPONSEOS_REQUIRE_AUTH must be enabled for hosted staging",
      );
    },
  );

  test("rejects dev sessions and live-provider credentials", () => {
    const errors = validateStagingEnvironment({
      ...VALID_ENV,
      RESPONSEOS_DEV_SESSION: "aj_admin",
      TELNYX_API_KEY: "provider-secret-placeholder",
    });

    expect(errors).toContain("Forbidden in mock-only staging: RESPONSEOS_DEV_SESSION");
    expect(errors).toContain("Forbidden in mock-only staging: TELNYX_API_KEY");
    expect(errors.join(" ")).not.toContain("provider-secret-placeholder");
  });

  test("rejects database targets that differ between GitHub and Vercel", () => {
    const errors = validateStagingEnvironment(VALID_ENV, {
      DATABASE_URL: "postgresql://different-pooled.example/db",
      DIRECT_URL: VALID_ENV.DIRECT_URL,
    });

    expect(errors).toContain(
      "DATABASE_URL in Vercel must match the GitHub staging Environment",
    );
    expect(errors.join(" ")).not.toContain("different-pooled.example");
  });

  test.each([
    "http://responseos-staging.example",
    "https://responseos.ajdigital.app",
    "https://responseos.vercel.app",
  ])("rejects unsafe staging URL %s", (url) => {
    expect(
      validateStagingEnvironment({ ...VALID_ENV, NEXT_PUBLIC_APP_URL: url }),
    ).not.toEqual([]);
  });
});
