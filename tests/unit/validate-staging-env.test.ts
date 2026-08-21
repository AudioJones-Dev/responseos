import { describe, expect, test } from "vitest";

import {
  CANONICAL_STAGING_DATABASE,
  createDatabaseIdentityAttestation,
  validateCanonicalStagingDatabaseSource,
  validateStagingEnvironment,
  validateVercelPreviewEnvironment,
  validateVercelPreviewPosture,
} from "@/scripts/validate-staging-env.mjs";

const ENDPOINT_ID = "ep-young-morning-a6oeu9vv";
const DATABASE_NAME = "neondb";
const DATABASE_URL =
  `postgresql://runtime:runtime-secret@${ENDPOINT_ID}-pooler.us-west-2.aws.neon.tech/${DATABASE_NAME}`;
const DIRECT_URL =
  `postgresql://migrator:migration-secret@${ENDPOINT_ID}.us-west-2.aws.neon.tech/${DATABASE_NAME}`;

const VALID_ENV = {
  DATABASE_URL,
  DIRECT_URL,
  RESPONSEOS_DATABASE_IDENTITY: "identity-placeholder",
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

const BASE_PREVIEW_METADATA = {
  envs: Object.keys(VALID_ENV).map((key, index) => ({
    key,
    id: `env-${index}`,
    updatedAt: 1_787_220_000_000 + index,
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

const DATABASE_ATTESTATION = createDatabaseIdentityAttestation(
  { DATABASE_URL, DIRECT_URL },
  BASE_PREVIEW_METADATA,
  1_787_220_100_000,
);

const PULLED_PREVIEW_ENV = {
  RESPONSEOS_DATABASE_IDENTITY: JSON.stringify(DATABASE_ATTESTATION),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_development-placeholder",
  AJ_DIGITAL_CLERK_ORG_ID: VALID_ENV.AJ_DIGITAL_CLERK_ORG_ID,
  NEXT_PUBLIC_APP_URL: VALID_ENV.NEXT_PUBLIC_APP_URL,
  RESPONSEOS_REQUIRE_AUTH: "1",
};

const GITHUB_DATABASE_ENV = {
  DATABASE_URL,
  DIRECT_URL,
};

const NEON_METADATA = {
  project: {
    project: {
      id: CANONICAL_STAGING_DATABASE.projectId,
      name: CANONICAL_STAGING_DATABASE.projectName,
    },
  },
  branch: {
    branch: {
      id: CANONICAL_STAGING_DATABASE.branchId,
      project_id: CANONICAL_STAGING_DATABASE.projectId,
      name: CANONICAL_STAGING_DATABASE.branchName,
    },
  },
  endpoints: {
    endpoints: [
      {
        id: ENDPOINT_ID,
        project_id: CANONICAL_STAGING_DATABASE.projectId,
        branch_id: CANONICAL_STAGING_DATABASE.branchId,
        type: "read_write",
        disabled: false,
      },
    ],
  },
  databases: {
    databases: [
      {
        name: DATABASE_NAME,
        branch_id: CANONICAL_STAGING_DATABASE.branchId,
      },
    ],
  },
};

function validatePreview(
  pulledEnv: Record<string, string | undefined> = PULLED_PREVIEW_ENV,
  metadata: { envs: Array<Record<string, unknown>> } = BASE_PREVIEW_METADATA,
  githubDatabaseEnv: Record<string, string | undefined> = GITHUB_DATABASE_ENV,
  neonMetadata: Record<string, unknown> = NEON_METADATA,
) {
  return validateVercelPreviewEnvironment(
    pulledEnv,
    metadata,
    githubDatabaseEnv,
    neonMetadata,
  );
}

describe("Vercel Preview staging contract", () => {
  test("accepts REST-derived readable posture before database synchronization", () => {
    expect(
      validateVercelPreviewPosture(PULLED_PREVIEW_ENV, BASE_PREVIEW_METADATA),
    ).toEqual([]);
  });

  test.each([
    [
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "pk_live_production-placeholder",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must be a Clerk test-mode key",
    ],
    [
      "AJ_DIGITAL_CLERK_ORG_ID",
      "user_wrong_shape",
      "AJ_DIGITAL_CLERK_ORG_ID must have Clerk organization shape",
    ],
    [
      "NEXT_PUBLIC_APP_URL",
      "https://responseos.ajdigital.app",
      "NEXT_PUBLIC_APP_URL must not use a production hostname",
    ],
    [
      "RESPONSEOS_REQUIRE_AUTH",
      "false",
      "RESPONSEOS_REQUIRE_AUTH must be enabled for hosted staging",
    ],
  ])("rejects unsafe pre-sync readable posture for %s", (name, value, message) => {
    const errors = validateVercelPreviewPosture(
      { ...PULLED_PREVIEW_ENV, [name]: value },
      BASE_PREVIEW_METADATA,
    );

    expect(errors).toContain(message);
  });

  test("rejects forbidden providers before database synchronization", () => {
    const errors = validateVercelPreviewPosture(PULLED_PREVIEW_ENV, {
      envs: [
        ...BASE_PREVIEW_METADATA.envs,
        {
          key: "TELNYX_API_KEY",
          id: "sensitive-provider-id",
          target: ["preview"],
          type: "sensitive",
          gitBranch: null,
        },
      ],
    });

    expect(errors).toContain(
      "Forbidden in mock-only Preview metadata: TELNYX_API_KEY",
    );
  });

  test("accepts the canonical GitHub staging database source before Vercel synchronization", () => {
    expect(
      validateCanonicalStagingDatabaseSource(
        GITHUB_DATABASE_ENV,
        NEON_METADATA,
      ),
    ).toEqual([]);
  });

  test("rejects a non-canonical GitHub staging endpoint before Vercel synchronization", () => {
    const errors = validateCanonicalStagingDatabaseSource(
      {
        DATABASE_URL: DATABASE_URL.replace(
          ENDPOINT_ID,
          "ep-wrong-source-a1b2c3d4",
        ),
        DIRECT_URL: DIRECT_URL.replace(
          ENDPOINT_ID,
          "ep-wrong-source-a1b2c3d4",
        ),
      },
      NEON_METADATA,
    );

    expect(errors).toContain(
      "DATABASE_URL must use the canonical Neon staging endpoint",
    );
    expect(errors).toContain(
      "DIRECT_URL must use the canonical Neon staging endpoint",
    );
  });

  test("rejects reversed pooled and direct GitHub database roles", () => {
    const errors = validateCanonicalStagingDatabaseSource(
      {
        DATABASE_URL: DIRECT_URL,
        DIRECT_URL: DATABASE_URL,
      },
      NEON_METADATA,
    );

    expect(errors).toContain(
      "DATABASE_URL must use the canonical pooled Neon hostname",
    );
    expect(errors).toContain(
      "DIRECT_URL must use the canonical direct Neon hostname",
    );
  });

  test("rejects a non-canonical GitHub staging database", () => {
    const errors = validateCanonicalStagingDatabaseSource(
      {
        DATABASE_URL: DATABASE_URL.replace("/neondb", "/postgres"),
        DIRECT_URL: DIRECT_URL.replace("/neondb", "/postgres"),
      },
      NEON_METADATA,
    );

    expect(errors).toContain(
      "DATABASE_URL must use the canonical Neon staging database",
    );
    expect(errors).toContain(
      "DIRECT_URL must use the canonical Neon staging database",
    );
  });

  test("rejects malformed GitHub staging connection strings", () => {
    const errors = validateCanonicalStagingDatabaseSource(
      {
        DATABASE_URL: "not-a-postgres-url",
        DIRECT_URL: "postgresql://missing-host",
      },
      NEON_METADATA,
    );

    expect(errors).toContain(
      "DATABASE_URL must resolve to an identifiable Neon endpoint and database",
    );
    expect(errors).toContain(
      "DIRECT_URL must resolve to an identifiable Neon endpoint and database",
    );
  });

  test("accepts the canonical staging database identity", () => {
    expect(validatePreview()).toEqual([]);
  });

  test("generates a credential-free canonical attestation", () => {
    expect(DATABASE_ATTESTATION.identity).toEqual(
      CANONICAL_STAGING_DATABASE,
    );
    expect(DATABASE_ATTESTATION.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    const revisions = DATABASE_ATTESTATION.vercel as Record<
      string,
      { envId: string; updatedAt: number }
    >;
    expect(revisions.DATABASE_URL).toEqual({
      envId: BASE_PREVIEW_METADATA.envs.find(
        (entry) => entry.key === "DATABASE_URL",
      )?.id,
      updatedAt: BASE_PREVIEW_METADATA.envs.find(
        (entry) => entry.key === "DATABASE_URL",
      )?.updatedAt,
    });
    expect(JSON.stringify(DATABASE_ATTESTATION)).not.toContain("runtime-secret");
    expect(JSON.stringify(DATABASE_ATTESTATION)).not.toContain("migration-secret");
    expect(JSON.stringify(DATABASE_ATTESTATION)).not.toContain("postgresql://");
  });

  test("rejects migration and Vercel runtime database mismatch", () => {
    const differentEndpoint = "ep-wrong-runtime-a1b2c3d4";
    const runtimeAttestation = {
      ...DATABASE_ATTESTATION,
      identity: {
        ...DATABASE_ATTESTATION.identity,
        endpointId: differentEndpoint,
      },
    };
    const errors = validatePreview({
      ...PULLED_PREVIEW_ENV,
      RESPONSEOS_DATABASE_IDENTITY: JSON.stringify(runtimeAttestation),
    });

    expect(errors).toContain(
      "Vercel runtime database identity does not match the GitHub migration database identity",
    );
    expect(errors.join(" ")).not.toContain("migration-secret");
    expect(errors.join(" ")).not.toContain("runtime-secret");
  });

  test("rejects the separate responseos Neon project", () => {
    const errors = validatePreview(
      PULLED_PREVIEW_ENV,
      BASE_PREVIEW_METADATA,
      GITHUB_DATABASE_ENV,
      {
        ...NEON_METADATA,
        project: {
          project: {
            id: "withered-dream-94312345",
            name: "responseos",
          },
        },
      },
    );

    expect(errors).toContain(
      "Neon project identity is not the canonical mock-staging project",
    );
  });

  test("rejects the wrong Neon branch", () => {
    const errors = validatePreview(
      PULLED_PREVIEW_ENV,
      BASE_PREVIEW_METADATA,
      GITHUB_DATABASE_ENV,
      {
        ...NEON_METADATA,
        branch: {
          branch: {
            id: "br-wrong-branch-a1b2c3d4",
            project_id: CANONICAL_STAGING_DATABASE.projectId,
            name: "demo",
          },
        },
      },
    );

    expect(errors).toContain(
      "Neon branch identity is not the canonical mock-staging branch",
    );
  });

  test("rejects missing database identity evidence", () => {
    const metadata = {
      envs: BASE_PREVIEW_METADATA.envs.filter(
        (entry) => entry.key !== "RESPONSEOS_DATABASE_IDENTITY",
      ),
    };
    const errors = validatePreview(
      {
        ...PULLED_PREVIEW_ENV,
        RESPONSEOS_DATABASE_IDENTITY: "",
      },
      metadata,
    );

    expect(errors).toContain(
      "Missing required Preview variable metadata: RESPONSEOS_DATABASE_IDENTITY",
    );
    expect(errors).toContain(
      "Expected exactly one unbranched Preview identity variable: RESPONSEOS_DATABASE_IDENTITY",
    );
  });

  test("rejects stale database identity evidence", () => {
    const metadata = {
      envs: BASE_PREVIEW_METADATA.envs.map((entry) =>
        entry.key === "DIRECT_URL"
          ? { ...entry, updatedAt: entry.updatedAt + 1 }
          : entry,
      ),
    };

    expect(validatePreview(PULLED_PREVIEW_ENV, metadata)).toContain(
      "Vercel database identity evidence is stale for DIRECT_URL",
    );
  });

  test("rejects a Vercel database variable id mismatch", () => {
    const metadata = {
      envs: BASE_PREVIEW_METADATA.envs.map((entry) =>
        entry.key === "DATABASE_URL"
          ? { ...entry, id: "replacement-database-variable" }
          : entry,
      ),
    };

    expect(validatePreview(PULLED_PREVIEW_ENV, metadata)).toContain(
      "Vercel database identity evidence is stale for DATABASE_URL",
    );
  });

  test("rejects conflicting database identity evidence", () => {
    const metadata = {
      envs: [
        ...BASE_PREVIEW_METADATA.envs,
        {
          ...BASE_PREVIEW_METADATA.envs.find(
            (entry) => entry.key === "RESPONSEOS_DATABASE_IDENTITY",
          ),
          id: "conflicting-identity",
        },
      ],
    };
    const errors = validatePreview(PULLED_PREVIEW_ENV, metadata);

    expect(errors).toContain(
      "Conflicting unbranched Preview variable metadata: RESPONSEOS_DATABASE_IDENTITY",
    );
    expect(errors).toContain(
      "Expected exactly one unbranched Preview identity variable: RESPONSEOS_DATABASE_IDENTITY",
    );
  });

  test("rejects a production Clerk publishable key", () => {
    const errors = validatePreview({
      ...PULLED_PREVIEW_ENV,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_production-placeholder",
    });

    expect(errors).toContain(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must be a Clerk test-mode key",
    );
  });

  test("requires server and database variables to stay Sensitive", () => {
    const metadata = {
      envs: BASE_PREVIEW_METADATA.envs.map((entry) =>
        entry.key === "CLERK_SECRET_KEY"
          ? { ...entry, type: "encrypted" }
          : entry,
      ),
    };

    expect(validatePreview(PULLED_PREVIEW_ENV, metadata)).toContain(
      "Required Preview variable must be Sensitive: CLERK_SECRET_KEY",
    );
  });

  test("rejects branch-scoped required variables and forbidden Preview names", () => {
    const metadata = {
      envs: [
        ...BASE_PREVIEW_METADATA.envs.map((entry) =>
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
    const errors = validatePreview(PULLED_PREVIEW_ENV, metadata);

    expect(errors).toContain(
      "Missing required Preview variable metadata: AJ_DIGITAL_CLERK_ORG_ID",
    );
    expect(errors).toContain(
      "Forbidden in mock-only Preview metadata: TELNYX_API_KEY",
    );
  });

  test("rejects missing or shared GitHub staging database secrets", () => {
    const errors = validatePreview(
      PULLED_PREVIEW_ENV,
      BASE_PREVIEW_METADATA,
      {
        DATABASE_URL,
        DIRECT_URL: DATABASE_URL,
      },
    );

    expect(errors).toContain(
      "DATABASE_URL and DIRECT_URL must be distinct staging secrets",
    );
  });
});
