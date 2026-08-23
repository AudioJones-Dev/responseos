import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  classifyStagingManagedAlias,
  validateStagingManagedAlias,
} from "@/scripts/validate-staging-managed-alias.mjs";
import { CANONICAL_STAGING_VERCEL } from "@/scripts/staging-vercel-custom-environment.mjs";

const expectedDeploymentId = "dpl_expected_second";
const expectedDeploymentHost =
  "responseos-staging-mock-second-audiojones.vercel.app";
const applicationSha = "4a5b29b83cb3f18137b0151ae6242b2ac484ef08";
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

function managedAlias(overrides: Record<string, unknown> = {}) {
  return {
    alias: CANONICAL_STAGING_VERCEL.managedEnvironmentAlias,
    deploymentId: expectedDeploymentId,
    projectId: CANONICAL_STAGING_VERCEL.projectId,
    redirect: null,
    deployment: {
      id: expectedDeploymentId,
      url: expectedDeploymentHost,
    },
    ...overrides,
  };
}

describe("managed staging alias binding", () => {
  test("accepts the exact managed alias bound to the exact new deployment", () => {
    expect(
      validateStagingManagedAlias(
        fixture("managed-alias-bound-to-second.json"),
        expectedDeploymentId,
        expectedDeploymentHost,
      ),
    ).toEqual([]);
  });

  test("rejects the quarantined first deployment for the new deployment gate", () => {
    const errors = validateStagingManagedAlias(
      fixture("managed-alias-bound-to-first.json"),
      expectedDeploymentId,
      expectedDeploymentHost,
    );
    expect(errors).toContain(
      "Managed alias does not target the exact READY deployment ID",
    );
    expect(
      classifyStagingManagedAlias(
        fixture("managed-alias-bound-to-first.json"),
        expectedDeploymentId,
        expectedDeploymentHost,
      ).status,
    ).toBe("pending");
  });

  test("same application SHA cannot compensate for the wrong deployment ID", () => {
    const stale = fixture("managed-alias-bound-to-first.json");
    expect(stale.deployment.meta.responseosApplicationSha).toBe(applicationSha);
    expect(
      validateStagingManagedAlias(
        stale,
        expectedDeploymentId,
        expectedDeploymentHost,
      ),
    ).toContain("Managed alias does not target the exact READY deployment ID");
  });

  test.each([
    [{ projectId: "prj_wrong" }, "canonical staging project"],
    [{ alias: "arbitrary.vercel.app" }, "does not name canonical staging"],
    [{ deploymentId: undefined }, "exact READY deployment ID"],
    [{ redirect: "redirect.example.com" }, "must not be a redirect"],
    [
      { deployment: { id: expectedDeploymentId, url: "wrong.vercel.app" } },
      "wrong immutable URL",
    ],
    [{ deployment: [] }, "must be a JSON object"],
  ])("rejects unsafe alias readback %#", (change, message) => {
    expect(
      validateStagingManagedAlias(
        managedAlias(change),
        expectedDeploymentId,
        expectedDeploymentHost,
      ).join(" "),
    ).toContain(message);
  });

  test.each([null, [], "not-an-object"])(
    "rejects malformed alias response %#",
    (value) => {
      expect(
        validateStagingManagedAlias(
          value,
          expectedDeploymentId,
          expectedDeploymentHost,
        ),
      ).toContain("Managed alias readback must be a JSON object");
    },
  );

  test("rejects ambiguous deployment identity evidence", () => {
    expect(
      validateStagingManagedAlias(
        managedAlias({ deployment: {} }),
        expectedDeploymentId,
        expectedDeploymentHost,
      ),
    ).toContain("Managed alias deployment object lacks identity evidence");
  });

  test("treats conflicting stale deployment ID and new URL as unsafe", () => {
    const stale = fixture("managed-alias-bound-to-first.json");
    stale.deployment.url = expectedDeploymentHost;
    expect(
      classifyStagingManagedAlias(
        stale,
        expectedDeploymentId,
        expectedDeploymentHost,
      ).status,
    ).toBe("unsafe");
  });
});
