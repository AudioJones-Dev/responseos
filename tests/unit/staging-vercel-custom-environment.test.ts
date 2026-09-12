import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  CANONICAL_STAGING_VERCEL,
  classifyStagingCustomEnvironmentAliasTelemetry,
  validateStagingCustomEnvironment,
} from "@/scripts/staging-vercel-custom-environment.mjs";

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

const valid = fixture("custom-environment-empty-alias-telemetry.json");

describe("canonical staging custom environment", () => {
  test.each([
    ["omitted", fixture("custom-environment-no-alias-telemetry.json"), "missing"],
    ["null", { ...valid, currentDeploymentAliases: null }, "missing"],
    ["empty", valid, "empty"],
    [
      "canonical",
      fixture("custom-environment-canonical-alias-telemetry.json"),
      "canonical",
    ],
  ])(
    "accepts %s optional alias telemetry before deployment",
    (_label, environment, classification) => {
      expect(validateStagingCustomEnvironment(environment)).toEqual([]);
      expect(
        classifyStagingCustomEnvironmentAliasTelemetry(
          environment.currentDeploymentAliases,
        ),
      ).toBe(classification);
    },
  );

  test.each([
    ["omitted", fixture("custom-environment-no-alias-telemetry.json")],
    ["null", { ...valid, currentDeploymentAliases: null }],
    ["empty", valid],
    [
      "canonical",
      fixture("custom-environment-canonical-alias-telemetry.json"),
    ],
  ])(
    "accepts %s optional alias telemetry after READY",
    (_label, environment) => {
      expect(
        validateStagingCustomEnvironment(environment, "post-ready"),
      ).toEqual([]);
    },
  );

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
      fixture("custom-environment-unsafe-alias-telemetry.json"),
      "unsafe optional alias telemetry",
    ],
    [
      {
        currentDeploymentAliases: [
          CANONICAL_STAGING_VERCEL.managedEnvironmentAlias,
          "arbitrary.vercel.app",
        ],
      },
      "unsafe optional alias telemetry",
    ],
    [
      { currentDeploymentAliases: "arbitrary.vercel.app" },
      "unsafe optional alias telemetry",
    ],
  ])("rejects unsafe custom-environment metadata %#", (change, message) => {
    expect(validateStagingCustomEnvironment({ ...valid, ...change }).join(" ")).toContain(message);
  });

  test("rejects unsafe optional alias telemetry after READY", () => {
    expect(
      validateStagingCustomEnvironment(
        fixture("custom-environment-unsafe-alias-telemetry.json"),
        "post-ready",
      ),
    ).toContain(
      "Vercel staging custom environment has unsafe optional alias telemetry",
    );
  });
});
