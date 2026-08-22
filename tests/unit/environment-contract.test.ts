import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  assertNoSecretValues,
  configurationFingerprint,
  hashCanonical,
  readJson,
  validateCertificationRecord,
  validateEnvironmentContract,
  validatePromotionPolicy,
  validateRepositoryContracts,
} from "@/scripts/config/environment-contract.mjs";
import { captureEnvironment } from "@/scripts/config/capture-environment.mjs";
import {
  DIFF_STATUS,
  diffEnvironments,
  environmentDiffFails,
  renderEnvironmentDiff,
} from "@/scripts/config/diff-environments.mjs";
import { buildPromotionPlan } from "@/scripts/config/build-promotion-plan.mjs";

const root = process.cwd();
const fixtureRoot = path.join(root, "tests", "fixtures", "environment-contract");
const stagingSecrets = readJson(
  path.join(root, "infra", "environments", "staging", "secret-contract.json"),
);
const productionSecrets = readJson(
  path.join(root, "infra", "environments", "production", "secret-contract.json"),
);
const policy = readJson(
  path.join(
    root,
    "infra",
    "environments",
    "promotion",
    "staging-to-production.rules.json",
  ),
);

type EnvironmentDocument = Record<string, unknown> & {
  authentication: Record<string, unknown> & {
    providerClass: string;
    credentialClass: string;
  };
  providerPosture: Record<string, unknown> & {
    enabledProviders: string[];
    liveExecutionApprovalState: string;
  };
  vercel: Record<string, unknown> & {
    projectId: string | null;
  };
};

type DiffResult = {
  id: string;
  status: string;
};

function mergeDocument(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(overrides)) {
    const current = result[key];
    result[key] =
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      current &&
      typeof current === "object" &&
      !Array.isArray(current)
        ? mergeDocument(
            current as Record<string, unknown>,
            value as Record<string, unknown>,
          )
        : structuredClone(value);
  }
  return result;
}

function materialize(filePath: string): EnvironmentDocument {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(root, filePath);
  const value = readJson(absolutePath);
  if (!value.base) return value as EnvironmentDocument;
  const basePath = path.join(root, value.base);
  return mergeDocument(
    materialize(basePath),
    value.overrides ?? {},
  ) as EnvironmentDocument;
}

const staging = materialize(path.join(fixtureRoot, "valid-staging.json"));
const production = materialize(path.join(fixtureRoot, "valid-production.json"));

function compare(target: EnvironmentDocument): DiffResult[] {
  return diffEnvironments(staging, target, policy) as DiffResult[];
}

describe("ResponseOS Environment Contract v1", () => {
  test("validates the certified staging manifest and secret metadata", () => {
    expect(validateEnvironmentContract(staging, stagingSecrets)).toEqual([]);
  });

  test("validates a fully resolved Production contract", () => {
    expect(validateEnvironmentContract(production, productionSecrets)).toEqual([]);
  });

  test("validates every canonical repository artifact and its certification hashes", () => {
    expect(validateRepositoryContracts()).toEqual([]);
  });

  test("rejects malformed contracts", () => {
    const malformed = structuredClone(staging);
    malformed.unexpected = true;
    expect(validateEnvironmentContract(malformed).join(" ")).toContain(
      "additional properties",
    );
  });

  test("rejects unknown schema versions", () => {
    const unknown = structuredClone(staging);
    unknown.schemaVersion = "responseos.environment.v2";
    expect(validateEnvironmentContract(unknown).join(" ")).toContain(
      "must be equal to constant",
    );
  });

  test("produces deterministic SHA-256 hashes across key order and whitespace", () => {
    const first = { z: [3, { b: 2, a: 1 }], a: "same" };
    const second = JSON.parse('{\n  "a": "same", "z": [3, {"a":1,"b":2}]\n}');
    expect(hashCanonical(first)).toBe(hashCanonical(second));
    expect(hashCanonical(first)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test("binds the combined configuration fingerprint to secret metadata", () => {
    const original = configurationFingerprint(staging, stagingSecrets);
    const changed = structuredClone(stagingSecrets);
    changed.variables[0].required = false;
    expect(configurationFingerprint(staging, changed)).not.toBe(original);
  });

  test("rejects explicit credential fields recursively", () => {
    expect(() =>
      assertNoSecretValues({ nested: { apiKey: "not-allowed" } }),
    ).toThrow("secret_value_field_forbidden:document.nested.apiKey");
    expect(() =>
      assertNoSecretValues({ nested: { tokens: ["not-allowed"] } }),
    ).toThrow("secret_value_field_forbidden:document.nested.tokens");
  });

  test("rejects credential-bearing connection strings", () => {
    const credentialBearingUrl = ["postgresql://user", "pass@example.invalid/db"].join(
      ":",
    );
    expect(() =>
      assertNoSecretValues({ note: credentialBearingUrl }),
    ).toThrow("credential-bearing database URL");
  });

  test("allows safe secret metadata names and classifications", () => {
    expect(() =>
      assertNoSecretValues({
        secretName: "CLERK_SECRET_KEY",
        classification: "credential",
        provider: "Clerk",
        transferableValue: false,
      }),
    ).not.toThrow();
  });

  test("requires exactly one promotion classification per path", () => {
    const duplicate = structuredClone(policy);
    duplicate.rules.push({ ...duplicate.rules[0], id: "duplicate-path" });
    expect(validatePromotionPolicy(duplicate, staging).join(" ")).toContain(
      "path has more than one classification",
    );
  });

  test("classifies compliant MUST_MATCH rules as MATCH", () => {
    const results = compare(production);
    expect(
      results.find((result) => result.id === "application-node")?.status,
    ).toBe(DIFF_STATUS.MATCH);
  });

  test("classifies independent identities as EXPECTED_DIFFERENCE", () => {
    const results = compare(production);
    expect(
      results.find((result) => result.id === "vercel-project-id")?.status,
    ).toBe(DIFF_STATUS.EXPECTED_DIFFERENCE);
  });

  test("rejects unauthorized MUST_MATCH drift", () => {
    const drift = materialize(
      path.join(fixtureRoot, "unauthorized-drift.json"),
    );
    const results = compare(drift);
    expect(
      results.find((result) => result.id === "application-node")?.status,
    ).toBe(DIFF_STATUS.UNAUTHORIZED_DIFFERENCE);
    expect(environmentDiffFails(results)).toBe(true);
  });

  test("rejects accidental staging resource reuse under MUST_DIFFER", () => {
    const drift = materialize(
      path.join(fixtureRoot, "unauthorized-drift.json"),
    );
    const results = compare(drift);
    expect(
      results.find((result) => result.id === "vercel-project-id")?.status,
    ).toBe(DIFF_STATUS.UNAUTHORIZED_DIFFERENCE);
  });

  test("reports missing required Production configuration", () => {
    const missing = materialize(
      path.join(fixtureRoot, "missing-production.json"),
    );
    const results = compare(missing);
    expect(
      results.find((result) => result.id === "database-endpoint-id")?.status,
    ).toBe(DIFF_STATUS.MISSING);
    expect(environmentDiffFails(results)).toBe(true);
  });

  test("reports HUMAN_APPROVAL_REQUIRED without treating it as certification success", () => {
    const approvalFixture = materialize(
      path.join(fixtureRoot, "human-approval-required.json"),
    );
    const results = compare(approvalFixture);
    expect(
      results.find((result) => result.id === "approve-promotion")?.status,
    ).toBe(DIFF_STATUS.HUMAN_APPROVAL_REQUIRED);
  });

  test("reports a missing required human-gated SHA selection as MISSING", () => {
    const missingApprovalInput = structuredClone(production);
    missingApprovalInput.deploymentControls = {
      ...(missingApprovalInput.deploymentControls as Record<string, unknown>),
      workflowControlSha: null,
    };
    const results = compare(missingApprovalInput);
    expect(
      results.find((result) => result.id === "workflow-control-sha")?.status,
    ).toBe(DIFF_STATUS.MISSING);
    expect(environmentDiffFails(results)).toBe(true);
  });

  test("accepts expected differences without missing or unauthorized results", () => {
    const expected = materialize(
      path.join(fixtureRoot, "expected-differences.json"),
    );
    expect(environmentDiffFails(compare(expected))).toBe(
      false,
    );
  });

  test("rejects Production development/test authentication posture", () => {
    const invalid = structuredClone(production);
    invalid.authentication.providerClass = "development";
    invalid.authentication.credentialClass = "test";
    expect(validateEnvironmentContract(invalid).join(" ")).toContain(
      "development or test authentication posture is forbidden",
    );
  });

  test("rejects RESPONSEOS_DEV_SESSION from Production secret metadata", () => {
    const invalidSecrets = structuredClone(productionSecrets);
    invalidSecrets.variables.push({
      ...invalidSecrets.variables[0],
      name: "RESPONSEOS_DEV_SESSION",
      classification: "configuration",
    });
    expect(validateEnvironmentContract(production, invalidSecrets).join(" ")).toContain(
      "RESPONSEOS_DEV_SESSION is forbidden",
    );
  });

  test("rejects provider activation without explicit provider and execution approvals", () => {
    const invalid = structuredClone(production);
    invalid.providerPosture.enabledProviders = ["telnyx"];
    invalid.providerPosture.liveExecutionApprovalState = "pending";
    expect(validateEnvironmentContract(invalid).join(" ")).toContain(
      "enabled provider lacks explicit live-execution approval",
    );
  });

  test("renders classifications without printing compared values", () => {
    const output = renderEnvironmentDiff(
      compare(production),
    );
    expect(output).toContain("MATCH");
    expect(output).toContain("EXPECTED_DIFFERENCE");
    expect(output).toContain("HUMAN_APPROVAL_REQUIRED");
    expect(output).not.toContain(staging.vercel.projectId as string);
    expect(output).not.toContain(production.vercel.projectId as string);
  });

  test("builds a planning-only manifest with resources, invariants, secrets, approvals, and checks", () => {
    const template = readJson(
      path.join(
        root,
        "infra",
        "environments",
        "production",
        "environment.template.json",
      ),
    );
    const plan = buildPromotionPlan(
      staging,
      template,
      policy,
      productionSecrets,
    );
    expect(plan.executionMode).toBe("planning-only");
    expect(plan.resourcesToProvision.length).toBeGreaterThan(0);
    expect(plan.settingsMustMatch.length).toBeGreaterThan(0);
    expect(plan.settingsMustDiffer.length).toBeGreaterThan(0);
    expect(
      plan.independentProductionSecrets.some(
        (variable: { name: string }) => variable.name === "CLERK_SECRET_KEY",
      ),
    ).toBe(true);
    expect(plan.humanApprovalsRequired.length).toBeGreaterThan(0);
    expect(plan.certificationChecks.length).toBeGreaterThan(0);
  });

  test("generates deterministic secret-free promotion plans", () => {
    const template = readJson(
      path.join(
        root,
        "infra",
        "environments",
        "production",
        "environment.template.json",
      ),
    );
    const first = buildPromotionPlan(staging, template, policy, productionSecrets);
    const second = buildPromotionPlan(staging, template, policy, productionSecrets);
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).not.toContain("postgresql://");
    expect(() => assertNoSecretValues(first)).not.toThrow();
  });

  test("captures and normalizes only repository-controlled non-secret input", () => {
    const readback = structuredClone(staging);
    delete readback.schemaVersion;
    delete readback.contractVersion;
    const captured = captureEnvironment(readback);
    expect(captured).toEqual(staging);
  });

  test("keeps every MUST_DIFFER staging identity out of the Production template", () => {
    const template = readJson(
      path.join(
        root,
        "infra",
        "environments",
        "production",
        "environment.template.json",
      ),
    );
    for (const rule of policy.rules.filter(
      (candidate: { classification: string }) =>
        candidate.classification === "MUST_DIFFER",
    )) {
      const sourceValue = rule.path
        .slice(1)
        .split("/")
        .reduce(
          (current: unknown, key: string) =>
            (current as Record<string, unknown> | undefined)?.[key],
          staging,
        );
      const targetValue = rule.path
        .slice(1)
        .split("/")
        .reduce(
          (current: unknown, key: string) =>
            (current as Record<string, unknown> | undefined)?.[key],
          template,
        );
      expect(targetValue).not.toEqual(sourceValue);
    }
  });

  test("capture rejects supplied readback containing a secret value field", () => {
    const readback = structuredClone(staging);
    readback.vercel.apiKey = "forbidden-fixture-value";
    expect(() => captureEnvironment(readback)).toThrow("secret_value_field_forbidden");
  });

  test("validates certification as configuration evidence, not deployment evidence", () => {
    const certification = readJson(
      path.join(
        root,
        "infra",
        "environments",
        "staging",
        "certification.json",
      ),
    );
    expect(
      validateCertificationRecord(certification, staging, stagingSecrets),
    ).toEqual([]);
    certification.environmentContractHash = `sha256:${"0".repeat(64)}`;
    expect(
      validateCertificationRecord(certification, staging, stagingSecrets).join(" "),
    ).toContain("environment contract hash mismatch");
  });

  test("CLI validation passes all schemas and example manifests", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/config/validate-environment.mjs", "--repository"],
      { cwd: root, encoding: "utf8" },
    );
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("repository artifacts are valid");
  });

  test("CLI diff exits non-zero for unauthorized drift and never prints identities", () => {
    const drift = materialize(
      path.join(fixtureRoot, "unauthorized-drift.json"),
    );
    const temporaryPath = path.join(
      root,
      "tests",
      "fixtures",
      "environment-contract",
      ".generated-unauthorized-drift.json",
    );
    fs.writeFileSync(temporaryPath, JSON.stringify(drift));
    try {
      const result = spawnSync(
        process.execPath,
        [
          "scripts/config/diff-environments.mjs",
          "infra/environments/staging/environment.json",
          path.relative(root, temporaryPath),
          "infra/environments/promotion/staging-to-production.rules.json",
        ],
        { cwd: root, encoding: "utf8" },
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("UNAUTHORIZED_DIFFERENCE");
      expect(result.stdout).not.toContain(staging.vercel.projectId as string);
    } finally {
      fs.rmSync(temporaryPath, { force: true });
    }
  });
});
