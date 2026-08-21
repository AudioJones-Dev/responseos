import { describe, expect, test } from "vitest";

import {
  validateStagingEnvironment,
  validateVercelPreviewEnvironment,
} from "@/scripts/validate-staging-env.mjs";

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

const PREVIEW_METADATA = {
  envs: Object.keys(VALID_ENV).map((key) => ({
    key,
    target: ["preview"],
    type: [
      "DATABASE_URL",
      "DIRECT_URL",
      "CLERK_SECRET_KEY",
      "CLERK_WEBHOOK_SECRET",
    ].includes(key)
      ? "sensitive"
      : "encrypted",
    gitBranch: null,
  })),
};

const PULLED_PREVIEW_ENV = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_development-placeholder",
  AJ_DIGITAL_CLERK_ORG_ID: VALID_ENV.AJ_DIGITAL_CLERK_ORG_ID,
  NEXT_PUBLIC_APP_URL: VALID_ENV.NEXT_PUBLIC_APP_URL,
  RESPONSEOS_REQUIRE_AUTH: "1",
};

const GITHUB_DATABASE_ENV = {
  DATABASE_URL: VALID_ENV.DATABASE_URL,
  DIRECT_URL: VALID_ENV.DIRECT_URL,
};

describe("Vercel Preview staging contract", () => {
  test("accepts Sensitive server variables by metadata and readable test auth values", () => {
    expect(
      validateVercelPreviewEnvironment(
        PULLED_PREVIEW_ENV,
        PREVIEW_METADATA,
        GITHUB_DATABASE_ENV,
      ),
    ).toEqual([]);
  });

  test("rejects a production Clerk publishable key", () => {
    const errors = validateVercelPreviewEnvironment(
      {
        ...PULLED_PREVIEW_ENV,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_production-placeholder",
      },
      PREVIEW_METADATA,
      GITHUB_DATABASE_ENV,
    );

    expect(errors).toContain(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must be a Clerk test-mode key",
    );
  });

  test("requires server and database variables to stay Sensitive", () => {
    const metadata = {
      envs: PREVIEW_METADATA.envs.map((entry) =>
        entry.key === "CLERK_SECRET_KEY"
          ? { ...entry, type: "encrypted" }
          : entry,
      ),
    };

    expect(
      validateVercelPreviewEnvironment(
        PULLED_PREVIEW_ENV,
        metadata,
        GITHUB_DATABASE_ENV,
      ),
    ).toContain("Required Preview variable must be Sensitive: CLERK_SECRET_KEY");
  });

  test("rejects branch-scoped required variables and forbidden Preview names", () => {
    const metadata = {
      envs: [
        ...PREVIEW_METADATA.envs.map((entry) =>
          entry.key === "AJ_DIGITAL_CLERK_ORG_ID"
            ? { ...entry, gitBranch: "feature" }
            : entry,
        ),
        {
          key: "TELNYX_API_KEY",
          target: ["preview"],
          type: "sensitive",
          gitBranch: null,
        },
      ],
    };
    const errors = validateVercelPreviewEnvironment(
      PULLED_PREVIEW_ENV,
      metadata,
      GITHUB_DATABASE_ENV,
    );

    expect(errors).toContain(
      "Missing required Preview variable metadata: AJ_DIGITAL_CLERK_ORG_ID",
    );
    expect(errors).toContain(
      "Forbidden in mock-only Preview metadata: TELNYX_API_KEY",
    );
  });

  test("rejects missing or shared GitHub staging database secrets", () => {
    const errors = validateVercelPreviewEnvironment(
      PULLED_PREVIEW_ENV,
      PREVIEW_METADATA,
      {
        DATABASE_URL: VALID_ENV.DATABASE_URL,
        DIRECT_URL: VALID_ENV.DATABASE_URL,
      },
    );

    expect(errors).toContain(
      "DATABASE_URL and DIRECT_URL must be distinct staging secrets",
    );
  });
});
