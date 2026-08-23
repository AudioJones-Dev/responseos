import { describe, expect, test } from "vitest";

import {
  CANONICAL_STAGING_VERCEL,
  validateStagingCustomEnvironment,
} from "@/scripts/staging-vercel-custom-environment.mjs";

const valid = {
  id: "env_uX6Qp8F6w9aBgx2ikH3BiREB8aHH",
  slug: "staging",
  type: "preview",
  branchMatcher: null,
  domains: [],
  currentDeploymentAliases: [],
};

describe("canonical staging custom environment", () => {
  test("accepts the exact empty governed environment", () => {
    expect(validateStagingCustomEnvironment(valid)).toEqual([]);
  });

  test("accepts only the canonical Vercel-managed environment alias", () => {
    expect(
      validateStagingCustomEnvironment({
        ...valid,
        currentDeploymentAliases: [
          CANONICAL_STAGING_VERCEL.managedEnvironmentAlias,
        ],
      }),
    ).toEqual([]);
  });

  test("requires the canonical staging slug during pre-deployment REST certification", () => {
    expect(
      validateStagingCustomEnvironment({ ...valid, slug: undefined }).join(" "),
    ).toContain("slug");
  });

  test.each([
    [{ id: "env_wrong" }, "id"],
    [{ slug: "preview" }, "slug"],
    [{ type: "production" }, "type"],
    [{ branchMatcher: { type: "equals", pattern: "master" } }, "track a branch"],
    [{ domains: ["staging.example.com"] }, "must not have domains"],
    [{ domains: "staging.example.com" }, "must not have domains"],
    [
      { currentDeploymentAliases: ["arbitrary.vercel.app"] },
      "canonical managed environment alias",
    ],
    [
      {
        currentDeploymentAliases: [
          CANONICAL_STAGING_VERCEL.managedEnvironmentAlias,
          "arbitrary.vercel.app",
        ],
      },
      "canonical managed environment alias",
    ],
    [
      { currentDeploymentAliases: "arbitrary.vercel.app" },
      "canonical managed environment alias",
    ],
  ])("rejects unsafe custom-environment metadata %#", (change, message) => {
    expect(validateStagingCustomEnvironment({ ...valid, ...change }).join(" ")).toContain(message);
  });
});
