import { describe, expect, test } from "vitest";

import {
  CANONICAL_STAGING_VERCEL,
  validateStagingVercelProject,
} from "@/scripts/validate-staging-vercel-project.mjs";

const BYPASS = "automation-bypass-placeholder";
const VALID_ENV = {
  VERCEL_ORG_ID: CANONICAL_STAGING_VERCEL.accountId,
  VERCEL_PROJECT_ID: CANONICAL_STAGING_VERCEL.projectId,
  VERCEL_AUTOMATION_BYPASS_SECRET: BYPASS,
};
const VALID_PROJECT = {
  id: CANONICAL_STAGING_VERCEL.projectId,
  accountId: CANONICAL_STAGING_VERCEL.accountId,
  name: CANONICAL_STAGING_VERCEL.projectName,
  nodeVersion: CANONICAL_STAGING_VERCEL.nodeVersion,
  live: false,
  alias: [],
  targets: {},
  ssoProtection: { deploymentType: "all_except_custom_domains" },
  protectionBypass: { [BYPASS]: { scope: "automation-bypass" } },
};
const SYSTEM_DOMAIN_ONLY = {
  domains: [{ name: `${CANONICAL_STAGING_VERCEL.projectName}.vercel.app` }],
};

describe("staging Vercel project contract", () => {
  test("accepts the canonical protected non-production project", () => {
    expect(
      validateStagingVercelProject(
        VALID_PROJECT,
        SYSTEM_DOMAIN_ONLY,
        VALID_ENV,
      ),
    ).toEqual([]);
  });

  test("rejects a Vercel project mismatch", () => {
    const errors = validateStagingVercelProject(
      { ...VALID_PROJECT, id: "prj_other", name: "responseos" },
      SYSTEM_DOMAIN_ONLY,
      VALID_ENV,
    );

    expect(errors).toContain(
      "Vercel project identity is not the canonical mock-staging target",
    );
  });

  test("rejects repository ids that do not name the canonical target", () => {
    const errors = validateStagingVercelProject(
      VALID_PROJECT,
      SYSTEM_DOMAIN_ONLY,
      { ...VALID_ENV, VERCEL_PROJECT_ID: "prj_other" },
    );

    expect(errors).toContain(
      "GitHub staging Vercel ids do not match the canonical target",
    );
  });

  test("rejects production state, aliases, domains, or weakened protection", () => {
    const errors = validateStagingVercelProject(
      {
        ...VALID_PROJECT,
        live: true,
        alias: ["production.example"],
        targets: { production: { id: "dpl_production" } },
        ssoProtection: { deploymentType: "none" },
      },
      { domains: [{ name: "production.example" }] },
      VALID_ENV,
    );

    expect(errors).toContain("Vercel project must remain non-production");
    expect(errors).toContain("Vercel mock-staging project must not have aliases");
    expect(errors).toContain(
      "Vercel mock-staging project must not have custom domains",
    );
    expect(errors).toContain(
      "Vercel Deployment Protection must remain enabled",
    );
  });
});
