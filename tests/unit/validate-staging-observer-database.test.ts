import { describe, expect, test } from "vitest";

import { CANONICAL_STAGING_DATABASE } from "@/scripts/validate-staging-env.mjs";
import { validateStagingObserverDatabase } from "@/scripts/validate-staging-observer-database.mjs";

const ENDPOINT_ID = CANONICAL_STAGING_DATABASE.endpointId;
const OBSERVER_URL = `postgresql://observer:observer-secret@${ENDPOINT_ID}.us-west-2.aws.neon.tech/${CANONICAL_STAGING_DATABASE.databaseName}?sslmode=require`;

const NEON_METADATA = {
  project: { project: { id: CANONICAL_STAGING_DATABASE.projectId, name: CANONICAL_STAGING_DATABASE.projectName } },
  branch: {
    branch: {
      id: CANONICAL_STAGING_DATABASE.branchId,
      project_id: CANONICAL_STAGING_DATABASE.projectId,
      name: CANONICAL_STAGING_DATABASE.branchName,
    },
  },
  endpoints: {
    endpoints: [{
      id: ENDPOINT_ID,
      project_id: CANONICAL_STAGING_DATABASE.projectId,
      branch_id: CANONICAL_STAGING_DATABASE.branchId,
      type: "read_write",
      disabled: false,
    }],
  },
  databases: { databases: [{ name: CANONICAL_STAGING_DATABASE.databaseName, branch_id: CANONICAL_STAGING_DATABASE.branchId }] },
};

describe("A10 observer database binding", () => {
  test("accepts the canonical staging endpoint and database", () => {
    expect(validateStagingObserverDatabase(OBSERVER_URL, NEON_METADATA)).toEqual([]);
  });

  test("rejects another endpoint, another database, or an unparseable URL without echoing it", () => {
    const wrongEndpoint = validateStagingObserverDatabase(OBSERVER_URL.replace(ENDPOINT_ID, "ep-other-a1b2c3d4"), NEON_METADATA);
    expect(wrongEndpoint).toContain("STAGING_READONLY_DATABASE_URL must use the canonical Neon staging endpoint");
    const wrongDatabase = validateStagingObserverDatabase(OBSERVER_URL.replace("/neondb", "/otherdb"), NEON_METADATA);
    expect(wrongDatabase).toContain("STAGING_READONLY_DATABASE_URL must use the canonical Neon staging database");
    const unparseable = validateStagingObserverDatabase("not a url", NEON_METADATA);
    expect(unparseable).toEqual(["STAGING_READONLY_DATABASE_URL must resolve to an identifiable Neon endpoint and database"]);
    for (const message of [...wrongEndpoint, ...wrongDatabase]) expect(message).not.toContain("observer-secret");
  });

  test("rejects Neon evidence that does not bind the endpoint to the staging branch", () => {
    const errors = validateStagingObserverDatabase(OBSERVER_URL, {
      ...NEON_METADATA,
      endpoints: { endpoints: [{ ...NEON_METADATA.endpoints.endpoints[0], branch_id: "br-other" }] },
    });
    expect(errors).toContain("Neon endpoint evidence does not bind the canonical endpoint to the staging branch");
  });
});
