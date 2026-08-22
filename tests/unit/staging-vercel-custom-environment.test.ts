import { describe, expect, test } from "vitest";

import { validateStagingCustomEnvironment } from "@/scripts/staging-vercel-custom-environment.mjs";

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

  test.each([
    [{ id: "env_wrong" }, "id"],
    [{ slug: "preview" }, "slug"],
    [{ type: "production" }, "type"],
    [{ branchMatcher: { type: "equals", pattern: "master" } }, "track a branch"],
    [{ domains: ["staging.example.com"] }, "must not have domains"],
    [{ currentDeploymentAliases: ["alias.example.com"] }, "must not have deployment aliases"],
  ])("rejects unsafe custom-environment metadata %#", (change, message) => {
    expect(validateStagingCustomEnvironment({ ...valid, ...change }).join(" ")).toContain(message);
  });
});
