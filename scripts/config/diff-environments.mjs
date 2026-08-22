import { pathToFileURL } from "node:url";
import {
  assertNoSecretValues,
  canonicalJson,
  isUnresolved,
  jsonPointerGet,
  readJson,
  validateEnvironmentContract,
  validatePromotionPolicy,
} from "./environment-contract.mjs";

export const DIFF_STATUS = Object.freeze({
  MATCH: "MATCH",
  EXPECTED_DIFFERENCE: "EXPECTED_DIFFERENCE",
  MISSING: "MISSING",
  UNAUTHORIZED_DIFFERENCE: "UNAUTHORIZED_DIFFERENCE",
  HUMAN_APPROVAL_REQUIRED: "HUMAN_APPROVAL_REQUIRED",
});

export function diffEnvironments(source, target, policy) {
  const sourceErrors = validateEnvironmentContract(source);
  const targetErrors = validateEnvironmentContract(target);
  const policyErrors = validatePromotionPolicy(policy, source);
  try {
    assertNoSecretValues(source, "sourceEnvironment");
    assertNoSecretValues(target, "targetEnvironment");
  } catch (error) {
    targetErrors.push(error instanceof Error ? error.message : "secret_value_detected");
  }
  if (sourceErrors.length || targetErrors.length || policyErrors.length) {
    throw new Error(
      [
        "Environment diff input validation failed:",
        ...sourceErrors,
        ...targetErrors,
        ...policyErrors,
      ].join("\n"),
    );
  }

  return policy.rules.map((rule) => {
    const sourceValue = jsonPointerGet(source, rule.path);
    const targetValue = jsonPointerGet(target, rule.path);
    let status;

    if (rule.classification === "HUMAN_APPROVAL_REQUIRED") {
      status =
        rule.required && isUnresolved(targetValue)
          ? DIFF_STATUS.MISSING
          : DIFF_STATUS.HUMAN_APPROVAL_REQUIRED;
    } else if (
      rule.required &&
      (isUnresolved(sourceValue) || isUnresolved(targetValue))
    ) {
      status = DIFF_STATUS.MISSING;
    } else {
      const equal = canonicalJson(sourceValue) === canonicalJson(targetValue);
      if (rule.classification === "MUST_MATCH") {
        status = equal
          ? DIFF_STATUS.MATCH
          : DIFF_STATUS.UNAUTHORIZED_DIFFERENCE;
      } else {
        status = equal
          ? DIFF_STATUS.UNAUTHORIZED_DIFFERENCE
          : DIFF_STATUS.EXPECTED_DIFFERENCE;
      }
    }

    return {
      id: rule.id,
      label: rule.label,
      path: rule.path,
      classification: rule.classification,
      status,
    };
  });
}

const STATUS_SYMBOLS = Object.freeze({
  MATCH: "✓",
  EXPECTED_DIFFERENCE: "~",
  MISSING: "✗",
  UNAUTHORIZED_DIFFERENCE: "✗",
  HUMAN_APPROVAL_REQUIRED: "!",
});

export function renderEnvironmentDiff(results) {
  return Object.values(DIFF_STATUS)
    .map((status) => {
      const matches = results.filter((result) => result.status === status);
      if (matches.length === 0) return undefined;
      return [
        status,
        ...matches.map(
          (result) => `${STATUS_SYMBOLS[status]} ${result.label} (${result.path})`,
        ),
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

export function environmentDiffFails(results) {
  return results.some((result) =>
    [DIFF_STATUS.MISSING, DIFF_STATUS.UNAUTHORIZED_DIFFERENCE].includes(
      result.status,
    ),
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  const [sourcePath, targetPath, policyPath] = process.argv.slice(2);
  if (!sourcePath || !targetPath || !policyPath) {
    console.error(
      "Usage: node scripts/config/diff-environments.mjs <source-environment.json> <target-environment.json> <promotion-policy.json>",
    );
    process.exit(1);
  }
  try {
    const results = diffEnvironments(
      readJson(sourcePath),
      readJson(targetPath),
      readJson(policyPath),
    );
    console.log(renderEnvironmentDiff(results));
    if (environmentDiffFails(results)) process.exit(1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Environment diff failed");
    process.exit(1);
  }
}
