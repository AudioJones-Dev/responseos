import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { validateStagingDeployEnvironmentContract } from "@/scripts/validate-staging-deploy-environment-contract.mjs";

const currentWorkflow = fs.readFileSync(
  path.join(process.cwd(), ".github", "workflows", "deploy-staging.yml"),
  "utf8",
);

const validFutureWorkflow = `
name: Deploy Staging
jobs:
  deploy:
    env:
      EXPECTED_VERCEL_CUSTOM_ENV_ID: env_uX6Qp8F6w9aBgx2ikH3BiREB8aHH
      EXPECTED_VERCEL_CUSTOM_ENV_SLUG: staging
    steps:
      - run: |
          curl "https://api.vercel.com/v9/projects/project/custom-environments/$EXPECTED_VERCEL_CUSTOM_ENV_ID"
          vercel pull --environment="$EXPECTED_VERCEL_CUSTOM_ENV_SLUG"
          vercel deploy --target="$EXPECTED_VERCEL_CUSTOM_ENV_SLUG"
`;

describe("Deploy Staging custom-environment compatibility", () => {
  test("rejects the current generic Preview deployment workflow", () => {
    const errors = validateStagingDeployEnvironmentContract(currentWorkflow);
    expect(errors).toContain("Deploy Staging must not pull generic Preview configuration");
    expect(errors).toContain("Deploy Staging must not target generic Preview");
  });

  test.each([
    ["--environment=preview", "must not pull generic Preview"],
    ["--target=preview", "must not target generic Preview"],
  ])("rejects generic option %s", (option, message) => {
    const source = validFutureWorkflow.replace(
      'vercel deploy --target="$EXPECTED_VERCEL_CUSTOM_ENV_SLUG"',
      `${option}\n          vercel deploy --target="$EXPECTED_VERCEL_CUSTOM_ENV_SLUG"`,
    );
    expect(validateStagingDeployEnvironmentContract(source).join(" ")).toContain(message);
  });

  test.each([
    ["env_uX6Qp8F6w9aBgx2ikH3BiREB8aHH", "env_wrong", "exact governed custom environment id"],
    ["EXPECTED_VERCEL_CUSTOM_ENV_SLUG: staging", "EXPECTED_VERCEL_CUSTOM_ENV_SLUG: other", "exact governed custom environment slug"],
  ])("rejects wrong canonical binding", (from, to, message) => {
    expect(validateStagingDeployEnvironmentContract(validFutureWorkflow.replace(from, to)).join(" ")).toContain(message);
  });

  test("rejects a workflow with no explicit custom-environment deployment target", () => {
    const source = validFutureWorkflow.replace(
      'vercel deploy --target="$EXPECTED_VERCEL_CUSTOM_ENV_SLUG"',
      "vercel deploy",
    );
    expect(validateStagingDeployEnvironmentContract(source)).toContain(
      "Deploy Staging must explicitly target the governed custom environment",
    );
  });

  test("rejects a workflow without exact-id REST readback", () => {
    const source = validFutureWorkflow.replace(
      'curl "https://api.vercel.com/v9/projects/project/custom-environments/$EXPECTED_VERCEL_CUSTOM_ENV_ID"',
      "echo no-readback",
    );
    expect(validateStagingDeployEnvironmentContract(source).join(" ")).toContain(
      "verify the exact governed custom environment id",
    );
  });

  test("accepts a future workflow with exact-id readback and staging targeting", () => {
    expect(validateStagingDeployEnvironmentContract(validFutureWorkflow)).toEqual([]);
  });
});
