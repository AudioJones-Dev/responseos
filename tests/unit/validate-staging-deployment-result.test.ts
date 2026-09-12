import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  validateDeploymentUrl,
  validateExistingStagingDeployment,
  validateStagingDeployment,
} from "@/scripts/validate-staging-deployment-result.mjs";
import { CANONICAL_STAGING_VERCEL } from "@/scripts/staging-vercel-custom-environment.mjs";

const applicationSha = "4a5b29b83cb3f18137b0151ae6242b2ac484ef08";
const deploymentHost = "responseos-staging-mock-abc123-audiojones.vercel.app";
const managedAlias = CANONICAL_STAGING_VERCEL.managedEnvironmentAlias;
const fixture = (name: string) =>
  JSON.parse(
    fs.readFileSync(
      path.join(
        process.cwd(),
        "tests",
        "fixtures",
        "vercel-staging",
        name,
      ),
      "utf8",
    ),
  );

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
  test("certifies an exact existing READY deployment ID", () => {
    expect(
      validateExistingStagingDeployment(
        deployment({ id: "dpl_expected" }),
        "dpl_expected",
        applicationSha,
      ),
    ).toEqual([]);
  });

  test("rejects a different existing deployment with the same application SHA", () => {
    expect(
      validateExistingStagingDeployment(
        deployment({ id: "dpl_other" }),
        "dpl_expected",
        applicationSha,
      ),
    ).toContain(
      "Deployment readback does not match the exact requested deployment ID",
    );
  });

  test("rejects the observed first deployment solely for its Production target", () => {
    const observed = fixture("observed-first-deployment.json");
    expect(
      validateStagingDeployment(
        observed,
        applicationSha,
        observed.url,
        "ready",
      ),
    ).toEqual(["Deployment must not target Production"]);
  });

  test("accepts an expected non-Production deployment with the canonical managed alias", () => {
    const expected = fixture("expected-second-deployment.json");
    expect(
      validateStagingDeployment(
        expected,
        applicationSha,
        expected.url,
        "ready",
      ),
    ).toEqual([]);
  });

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

  test("requires explicit target evidence", () => {
    const metadata: Record<string, unknown> = deployment();
    delete metadata.target;
    expect(
      validateStagingDeployment(metadata, applicationSha, deploymentHost),
    ).toContain("Deployment target evidence is missing");
  });

  test("deduplicates the canonical managed alias across provider alias fields", () => {
    expect(
      validateStagingDeployment(
        deployment({
          alias: [managedAlias],
          automaticAliases: [managedAlias],
          aliasAssigned: true,
        }),
        applicationSha,
        deploymentHost,
        "ready",
      ),
    ).toEqual([]);
  });

  test.each([
    [{ alias: ["arbitrary.vercel.app"] }, "canonical managed environment alias"],
    [
      { alias: [managedAlias, "arbitrary.vercel.app"] },
      "canonical managed environment alias",
    ],
    [
      { alias: [managedAlias, managedAlias] },
      "canonical managed environment alias",
    ],
    [{ alias: ["staging.example.com"] }, "canonical managed environment alias"],
    [{ userAliases: [managedAlias] }, "canonical managed environment alias"],
    [{ aliasAssigned: true }, "canonical managed environment alias"],
    [{ alias: managedAlias }, "canonical managed environment alias"],
  ])("rejects unsafe alias evidence %#", (change, message) => {
    expect(
      validateStagingDeployment(
        deployment(change),
        applicationSha,
        deploymentHost,
      ).join(" "),
    ).toContain(message);
  });

  test.each([
    ["projectId", "prj_wrong", "canonical staging project"],
    ["target", "production", "must not target Production"],
    ["gitSource", { ref: applicationSha, sha: "f".repeat(40) }, "Git source SHA"],
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
    [
      `https://${managedAlias}`,
      ["unique HTTPS vercel.app origin"],
    ],
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
