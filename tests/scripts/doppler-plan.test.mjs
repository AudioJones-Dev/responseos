import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateDopplerPlan } from "../../scripts/validate-doppler-plan.mjs";
const fixture = () => JSON.parse(fs.readFileSync(new URL("../../infra/doppler-plan.json", import.meta.url), "utf8"));
test("repository-backed dormant plan is valid", () => assert.deepEqual(validateDopplerPlan(fixture()), []));
test("activation and guessed source mappings fail closed", () => {
  for (const mutate of [p => p.executionEnabled = true, p => p.syncEnabled = true, p => p.productionIncluded = true, p => p.approvalReference = "claimed", p => p.qualificationRuntime.source = { project: "response-os", config: "dev" }, p => p.qualificationRelease.source = { project: "response-os", config: "prod" }, p => p.historicalDemo.reuseForQualification = true]) {
    const plan = fixture(); mutate(plan); assert.ok(validateDopplerPlan(plan).length);
  }
});
test("wrong or broad destinations and unverified support claims fail", () => {
  for (const mutate of [p => p.qualificationRuntime.destination.environmentSlug = "preview", p => p.qualificationRuntime.destination.projectId = "other", p => p.qualificationRuntime.customEnvironmentSupportDocumented = false, p => p.qualificationRelease.destination.scope = "repository", p => p.qualificationRelease.destination.environment = "production"]) {
    const plan = fixture(); mutate(plan); assert.ok(validateDopplerPlan(plan).length);
  }
});
test("qualification refuses provider credentials, broad names and value-bearing fields", () => {
  for (const secret of ["TELNYX_API_KEY", "HUBSPOT_ACCESS_TOKEN", "RESEND_API_KEY", "DOPPLER_TOKEN", "VERCEL_TOKEN", "STRIPE_SECRET_KEY"]) {
    const plan = fixture(); plan.qualificationRuntime.secretNames.push(secret); assert.ok(validateDopplerPlan(plan).length);
  }
  const plan = fixture(); plan.qualificationRuntime.secretValues = { NEVER_REAL: "synthetic-secret-marker" };
  assert.ok(validateDopplerPlan(plan).length);
  assert.ok(!JSON.stringify(validateDopplerPlan(plan)).includes("synthetic-secret-marker"));
});
test("missing, duplicate and malformed evidence rejects without reflecting input", () => {
  for (const plan of [null, {}, { token: "synthetic-secret-marker" }]) assert.ok(validateDopplerPlan(plan).length);
  const duplicate = fixture(); duplicate.qualificationRuntime.secretNames.push("DATABASE_URL"); assert.ok(validateDopplerPlan(duplicate).length);
  const missing = fixture(); missing.qualificationRuntime.secretNames.pop(); assert.ok(validateDopplerPlan(missing).length);
});
test("runtime URL and current GitHub secrets consumer cannot be omitted or silently changed to variables", () => {
  const url = fixture(); url.qualificationRuntime.configurationNames = url.qualificationRuntime.configurationNames.filter(name => name !== "NEXT_PUBLIC_APP_URL");
  assert.ok(validateDopplerPlan(url).length);
  const github = fixture(); github.qualificationRelease.configurationNames = github.qualificationRelease.nonsecretEnvironmentSecretNames;
  delete github.qualificationRelease.nonsecretEnvironmentSecretNames;
  assert.ok(validateDopplerPlan(github).length);
});
