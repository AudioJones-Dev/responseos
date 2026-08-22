import { describe, expect, test } from "vitest";

import {
  REQUIRED_STAGING_VARIABLES,
  createScopePatchBody,
  createStagingMigrationPlan,
  verifyStagingMigrationReadback,
} from "@/scripts/staging-custom-environment-migration.mjs";

const customId = "env_uX6Qp8F6w9aBgx2ikH3BiREB8aHH";
const source = {
  envs: Object.entries(REQUIRED_STAGING_VARIABLES).map(([key, type], index) => ({
    key, type, id: `env-${index}`, target: ["preview"], gitBranch: null,
  })),
};
const plan = createStagingMigrationPlan(source);
const migrated = {
  envs: plan.variables.map((entry) => ({
    ...entry, target: [], customEnvironmentIds: [customId], gitBranch: null, updatedAt: 100,
  })),
};

describe("staging custom-environment migration", () => {
  test("plans exactly the canonical nine existing variables", () => {
    expect(plan.variables).toHaveLength(9);
    expect(plan.variables.map(({ key }) => key)).toEqual(Object.keys(REQUIRED_STAGING_VARIABLES));
  });

  test.each([
    ["missing", { envs: source.envs.slice(1) }, "DATABASE_URL"],
    ["duplicate", { envs: [...source.envs, source.envs[0]] }, "DATABASE_URL"],
    ["wrong type", { envs: source.envs.map((item) => item.key === "DIRECT_URL" ? { ...item, type: "encrypted" } : item) }, "wrong type"],
    ["wrong custom environment", { envs: source.envs.map((item) => item.key === "DIRECT_URL" ? { ...item, customEnvironmentIds: ["env_wrong"] } : item) }, "certified generic Preview"],
  ])("fails the full plan for %s", (_label, metadata, message) => {
    expect(() => createStagingMigrationPlan(metadata)).toThrow(message);
  });

  test("scope PATCH body contains no value or credential material", () => {
    expect(createScopePatchBody()).toEqual({ target: [], customEnvironmentIds: [customId] });
    expect(createScopePatchBody()).not.toHaveProperty("value");
    expect(createScopePatchBody()).not.toHaveProperty("type");
  });

  test("forbidden provider variables invalidate the source plan", () => {
    expect(() => createStagingMigrationPlan({
      envs: [...source.envs, { key: "TELNYX_API_KEY", id: "provider", type: "sensitive", target: ["preview"], gitBranch: null }],
    })).toThrow("Forbidden live-provider source variable");
  });

  test("proves filtered availability and generic Preview removal", () => {
    expect(verifyStagingMigrationReadback({ plan, unfilteredMetadata: migrated, filteredMetadata: migrated })).toEqual([]);
  });

  test("rejects generic Preview scope remaining", () => {
    const unsafe = { envs: migrated.envs.map((item) => item.key === "DATABASE_URL" ? { ...item, target: ["preview"] } : item) };
    expect(verifyStagingMigrationReadback({ plan, unfilteredMetadata: unsafe, filteredMetadata: migrated }).join(" ")).toContain("Generic Preview scope remains");
  });

  test("rejects wrong filtered custom-environment attachment", () => {
    const wrong = { envs: migrated.envs.map((item) => item.key === "DIRECT_URL" ? { ...item, customEnvironmentIds: ["env_wrong"] } : item) };
    expect(verifyStagingMigrationReadback({ plan, unfilteredMetadata: migrated, filteredMetadata: wrong }).join(" ")).toContain("not available only");
  });
});
