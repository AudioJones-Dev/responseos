import { describe, expect, test } from "vitest";

import {
  validateDeploymentUrl,
  validateStagingDeployment,
} from "@/scripts/validate-staging-deployment-result.mjs";

const applicationSha = "4a5b29b83cb3f18137b0151ae6242b2ac484ef08";
const deploymentHost = "responseos-staging-mock-abc123-audiojones.vercel.app";

function deployment(overrides: Record<string, unknown> = {}) {
  return {
    id: "dpl_test",
    name: "responseos-staging-mock",
    projectId: "prj_pbzqdkzp322jcHWIsi19GhsnWXRm",
    url: deploymentHost,
    target: null,
    readyState: "READY",
    alias: [],
    automaticAliases: [],
    userAliases: [],
    aliasAssigned: false,
    customEnvironment: {
      id: "env_uX6Qp8F6w9aBgx2ikH3BiREB8aHH",
      slug: "staging",
    },
    meta: { responseosApplicationSha: applicationSha },
    gitSource: { ref: applicationSha, sha: applicationSha },
    ...overrides,
  };
}

describe("governed staging deployment result", () => {
  test("accepts the exact environment ID when deployment readback omits the optional slug", () => {
    expect(
      validateStagingDeployment(
        deployment({
          customEnvironment: {
            id: "env_uX6Qp8F6w9aBgx2ikH3BiREB8aHH",
          },
        }),
        applicationSha,
        deploymentHost,
        "ready",
      ),
    ).toEqual([]);
  });

  test("accepts the exact environment ID when deployment readback includes the canonical slug", () => {
    expect(
      validateStagingDeployment(
        deployment(),
        applicationSha,
        deploymentHost,
        "ready",
      ),
    ).toEqual([]);
  });

  test("rejects the wrong environment ID even when the deployment slug says staging", () => {
    expect(
      validateStagingDeployment(
        deployment({ customEnvironment: { id: "env_wrong", slug: "staging" } }),
        applicationSha,
        deploymentHost,
      ).join(" "),
    ).toContain("exact governed custom environment");
  });

  test("rejects deployment readback without a custom environment", () => {
    expect(
      validateStagingDeployment(
        deployment({ customEnvironment: undefined }),
        applicationSha,
        deploymentHost,
      ).join(" "),
    ).toContain("exact governed custom environment");
  });

  test.each([
    ["projectId", "prj_wrong", "canonical staging project"],
    ["target", "production", "must not target Production"],
    ["gitSource", { ref: applicationSha, sha: "f".repeat(40) }, "Git source SHA"],
    ["alias", ["staging.example.com"], "must not have aliases"],
  ])("rejects invalid %s evidence", (field, value, message) => {
    expect(
      validateStagingDeployment(
        deployment({ [field]: value }),
        applicationSha,
        deploymentHost,
      ).join(" "),
    ).toContain(message);
  });

  test("rejects stale application metadata and non-READY final state", () => {
    const errors = validateStagingDeployment(
      deployment({
        readyState: "BUILDING",
        meta: { responseosApplicationSha: "f".repeat(40) },
      }),
      applicationSha,
      deploymentHost,
      "ready",
    );
    expect(errors).toContain(
      "Deployment metadata does not bind the requested application SHA",
    );
    expect(errors).toContain("Deployment is not READY");
  });

  test.each([
    [`https://${deploymentHost}`, []],
    ["http://responseos.vercel.app", ["unique HTTPS vercel.app origin"]],
    ["https://responseos.example.com", ["unique HTTPS vercel.app origin"]],
    ["not-a-url", ["valid absolute URL"]],
  ])("validates candidate URL %s", (url, expectedFragments) => {
    const errors = validateDeploymentUrl(url);
    for (const fragment of expectedFragments) {
      expect(errors.join(" ")).toContain(fragment);
    }
    if (expectedFragments.length === 0) expect(errors).toEqual([]);
  });
});
