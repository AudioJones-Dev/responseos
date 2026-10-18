import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { LIVE_DEMO_TARGET as target, validateLiveDemoIdentity, validateQualificationPreflight } from "@/scripts/live-demo-commissioning-contract.mjs";

const control = "a".repeat(40);
const application = "b".repeat(40);
const evidence = () => ({
  project: { id: target.projectId, name: target.projectName, accountId: String(target.orgId) },
  environment: { id: target.environmentId, slug: target.environmentSlug },
  revisions: { control, workflow: control, currentMaster: control, application },
  expectedDeploymentId: "dpl_test123",
  expectedDeploymentHost: "immutable-test.vercel.app",
  deployment: {
    id: "dpl_test123", url: "immutable-test.vercel.app", readyState: "READY", target: null as string | null,
    projectId: target.projectId, ownerId: String(target.orgId), customEnvironment: { id: target.environmentId },
    meta: { responseosApplicationSha: application, responseosControlSha: control },
    alias: [target.alias], automaticAliases: [target.alias], userAliases: [] as string[],
  },
  alias: { alias: target.alias, projectId: target.projectId, deploymentId: "dpl_test123", deployment: { id: "dpl_test123", url: "immutable-test.vercel.app" } },
});
const env = {
  RESPONSEOS_DEPLOYMENT_LANE: "live-demo", RESPONSEOS_REQUIRE_AUTH: "true",
  CLERK_SECRET_KEY: "sk_test_synthetic", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_synthetic",
  AJ_DIGITAL_CLERK_ORG_ID: "org_synthetic",
  RESPONSEOS_LIVE_HUBSPOT_ENABLED: "false", RESPONSEOS_LIVE_EMAIL_ENABLED: "false",
  RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED: "false",
};
const policy = { consent: { recording: { enabled: false } }, qualificationAssignmentActive: true, crmEmailPermanentlyBlocked: true };

describe("closed FRL commissioning contract", () => {
  test("accepts complete synthetic target evidence without granting execution", () => {
    expect(validateLiveDemoIdentity(evidence())).toEqual([]);
    expect(validateQualificationPreflight(env, policy)).toEqual([]);
  });
  test.each(["preview", "production", "unknown"])("rejects %s substitution", value => {
    const input = evidence(); input.deployment.target = value;
    expect(validateLiveDemoIdentity(input).length).toBeGreaterThan(0);
  });
  test.each(["project", "environment", "revisions", "deployment", "alias"])("rejects missing %s evidence", key => {
    const input = { ...evidence(), [key]: undefined };
    expect(validateLiveDemoIdentity(input).length).toBeGreaterThan(0);
  });
  test("rejects stale revision, wrong organization, deployment and alias binding", () => {
    for (const mutate of [
      (input: ReturnType<typeof evidence>) => { input.revisions.currentMaster = application; },
      (input: ReturnType<typeof evidence>) => { input.project.accountId = "other"; },
      (input: ReturnType<typeof evidence>) => { input.deployment.ownerId = "other"; },
      (input: ReturnType<typeof evidence>) => { input.expectedDeploymentId = "dpl_other"; },
      (input: ReturnType<typeof evidence>) => { input.alias.deploymentId = "dpl_other"; },
      (input: ReturnType<typeof evidence>) => { input.deployment.userAliases = ["production.example"]; },
    ]) {
      const input = evidence(); mutate(input);
      expect(validateLiveDemoIdentity(input).length).toBeGreaterThan(0);
    }
  });
  test.each(["false", "0", "", "yes", " true "])("rejects ambiguous/disabled auth %s", value => {
    expect(validateQualificationPreflight({ ...env, RESPONSEOS_REQUIRE_AUTH: value }, policy).length).toBeGreaterThan(0);
  });
  test.each(["RESPONSEOS_DEV_SESSION", "HUBSPOT_ACCESS_TOKEN", "RESEND_API_KEY", "TELNYX_API_KEY", "RESPONSEOS_AUTHORIZED_EXECUTION_GATES"])("rejects %s without disclosing its value", key => {
    const errors = validateQualificationPreflight({ ...env, [key]: "sensitive-synthetic-value" }, policy);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(" ")).not.toContain("sensitive-synthetic-value");
  });
  test("rejects invalid Clerk, recording and incomplete permanent prohibition evidence", () => {
    expect(validateQualificationPreflight({ ...env, RESPONSEOS_DEV_SESSION: " " }, policy).length).toBeGreaterThan(0);
    expect(validateQualificationPreflight({ ...env, CLERK_SECRET_KEY: "placeholder" }, policy).length).toBeGreaterThan(0);
    expect(validateQualificationPreflight({ ...env, CLERK_SECRET_KEY: "sk_live_synthetic" }, policy).length).toBeGreaterThan(0);
    expect(validateQualificationPreflight(env, { ...policy, consent: { recording: { enabled: true } } }).length).toBeGreaterThan(0);
    expect(validateQualificationPreflight(env, { ...policy, crmEmailPermanentlyBlocked: false }).length).toBeGreaterThan(0);
  });
  test("workflow has no secret binding, provider command, migration or deploy step", () => {
    const workflow = readFileSync(".github/workflows/deploy-live-demo.yml", "utf8");
    expect(workflow).toContain("exit 1");
    expect(workflow).not.toMatch(/secrets\.|vercel (pull|build|deploy)|prisma migrate|npm install|uses:/);
  });
});
