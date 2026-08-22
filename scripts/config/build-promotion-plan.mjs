import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertNoSecretValues,
  configurationFingerprint,
  hashCanonical,
  isUnresolved,
  jsonPointerGet,
  prettyCanonicalJson,
  readJson,
  validateCertificationRecord,
  validateEnvironmentContract,
  validatePromotionPolicy,
} from "./environment-contract.mjs";

export function buildPromotionPlan(
  sourceEnvironment,
  sourceSecretContract,
  sourceCertification,
  targetTemplate,
  policy,
  targetSecretContract,
) {
  const errors = [
    ...validateEnvironmentContract(sourceEnvironment, sourceSecretContract),
    ...validateEnvironmentContract(targetTemplate, targetSecretContract),
    ...validatePromotionPolicy(policy, sourceEnvironment),
    ...validateCertificationRecord(
      sourceCertification,
      sourceEnvironment,
      sourceSecretContract,
    ),
  ];
  if (sourceCertification?.certificationStatus !== "CONFIGURATION_CERTIFIED") {
    errors.push(
      "certification:source status must be CONFIGURATION_CERTIFIED before planning",
    );
  }
  if (errors.length > 0) {
    throw new Error(["Promotion plan input validation failed:", ...errors].join("\n"));
  }
  if (
    sourceEnvironment.identity?.name !== "staging" ||
    targetSecretContract.environment !== "production"
  ) {
    throw new Error("Promotion plan requires staging source and Production target metadata");
  }

  const mustMatch = policy.rules
    .filter((rule) => rule.classification === "MUST_MATCH")
    .map(({ id, label, path: rulePath, rationale }) => ({
      id,
      label,
      path: rulePath,
      rationale,
    }));
  const mustDiffer = policy.rules
    .filter((rule) => rule.classification === "MUST_DIFFER")
    .map(({ id, label, path: rulePath, rationale }) => ({
      id,
      label,
      path: rulePath,
      unresolved: isUnresolved(jsonPointerGet(targetTemplate, rulePath)),
      rationale,
    }));
  const approvals = policy.rules
    .filter((rule) => rule.classification === "HUMAN_APPROVAL_REQUIRED")
    .map(({ id, label, path: rulePath, rationale }) => ({
      id,
      label,
      path: rulePath,
      state: "pending",
      rationale,
    }));
  const resourcesToProvision = mustDiffer
    .filter((item) => item.unresolved)
    .map(({ id, label, path: rulePath }) => ({ id, label, path: rulePath }));
  const independentSecrets = targetSecretContract.variables
    .filter((variable) => variable.independentProductionValueRequired)
    .map((variable) => ({
      name: variable.name,
      classification: variable.classification,
      required: variable.required,
      scope: variable.scope,
      providerOwner: variable.providerOwner,
      rotationRequired: variable.rotationRequired,
      activationEffect: variable.activationEffect,
    }));

  const plan = {
    schemaVersion: "responseos.environment-promotion-plan.v1",
    sourceEnvironment: sourceEnvironment.identity.name,
    targetEnvironment: targetSecretContract.environment,
    sourceEnvironmentFingerprint: hashCanonical(sourceEnvironment),
    sourceConfigurationFingerprint: configurationFingerprint(
      sourceEnvironment,
      sourceSecretContract,
    ),
    sourceCertificationProvenance: {
      certificationWorkflow: sourceCertification.certificationWorkflow,
      workflowRunId: sourceCertification.workflowRunId,
      workflowControlSha: sourceCertification.workflowControlSha,
    },
    targetTemplateFingerprint: hashCanonical(targetTemplate),
    executionMode: "planning-only",
    resourcesToProvision,
    settingsMustMatch: mustMatch,
    settingsMustDiffer: mustDiffer,
    independentProductionSecrets: independentSecrets,
    humanApprovalsRequired: approvals,
    certificationChecks: [
      "Provision independent Vercel, Neon, Clerk, and approved provider resources.",
      "Install environment-specific variables through protected platform stores; never through Git.",
      "Capture a fresh non-secret Production readback contract.",
      "Validate schemas, semantic constraints, identity separation, and provider gates.",
      "Diff Production readback against the certified staging contract and promotion policy.",
      "Generate SHA-256 environment and combined configuration fingerprints.",
      "Create a configuration-only certification record bound to exact workflow and application SHAs.",
      "Obtain explicit human Production-promotion approval before any deploy.",
    ],
    forbiddenActions: [
      "create resources",
      "install secrets",
      "dispatch workflows",
      "deploy",
      "activate providers",
      "assign domains or phone numbers",
    ],
  };
  assertNoSecretValues(plan, "promotionPlan");
  return plan;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  const [sourcePath, targetPath, policyPath, outputPath] = process.argv.slice(2);
  if (!sourcePath || !targetPath || !policyPath) {
    console.error(
      "Usage: node scripts/config/build-promotion-plan.mjs <certified-staging-environment.json> <production-template.json> <promotion-policy.json> [output.json]",
    );
    process.exit(1);
  }
  try {
    const sourceDirectory = path.dirname(sourcePath);
    const secretContractPath = path.join(
      path.dirname(targetPath),
      "secret-contract.json",
    );
    const plan = buildPromotionPlan(
      readJson(sourcePath),
      readJson(path.join(sourceDirectory, "secret-contract.json")),
      readJson(path.join(sourceDirectory, "certification.json")),
      readJson(targetPath),
      readJson(policyPath),
      readJson(secretContractPath),
    );
    const output = prettyCanonicalJson(plan);
    if (outputPath) {
      fs.writeFileSync(outputPath, output);
      console.log(`Secret-free Production promotion plan written: ${outputPath}`);
    } else {
      process.stdout.write(output);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Promotion plan failed");
    process.exit(1);
  }
}
