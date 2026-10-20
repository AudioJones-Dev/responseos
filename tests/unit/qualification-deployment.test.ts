import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, test, vi } from "vitest";
import { LIVE_DEMO_TARGET as t } from "@/scripts/live-demo-commissioning-contract.mjs";
import { deploymentHost, runQualificationDeployment, validateQualificationDispatch } from "@/scripts/qualification-deployment.mjs";
const control = "a".repeat(40), app = "b".repeat(40);
function fixture() {
  const input = { controlSha: control, workflowSha: control, controlHead: control, controlTip: control, applicationSha: app, applicationHead: app, ref: "refs/heads/reviewed-control" };
  const policy = { enabled: true, qualificationMode: "offline", trustedControlRef: input.ref, approvedApplicationSha: app, approvalReference: "synthetic-approval", dependencyInstallationApproved: true, qualificationEvidence: { consent: { recording: { enabled: false } }, qualificationAssignmentActive: true, crmEmailPermanentlyBlocked: true } };
  const env = { VERCEL_ORG_ID: String(t.orgId), VERCEL_PROJECT_ID: String(t.projectId), VERCEL_TOKEN: "synthetic", VERCEL_AUTOMATION_BYPASS_SECRET: "synthetic", DATABASE_URL: "synthetic-db", DIRECT_URL: "synthetic-direct" };
  const pulled = { DATABASE_URL: env.DATABASE_URL, DIRECT_URL: env.DIRECT_URL, NEXT_PUBLIC_APP_URL: `https://${t.alias}`, RESPONSEOS_DEPLOYMENT_LANE: "live-demo", RESPONSEOS_REQUIRE_AUTH: "true", CLERK_SECRET_KEY: "sk_test_synthetic", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_synthetic", CLERK_WEBHOOK_SECRET: "whsec_synthetic", AJ_DIGITAL_CLERK_ORG_ID: "org_synthetic", RESPONSEOS_LIVE_HUBSPOT_ENABLED: "false", RESPONSEOS_LIVE_EMAIL_ENABLED: "false", RESPONSEOS_WEBHOOK_FINGERPRINT_KEY_ID: "synthetic-local-v1", RESPONSEOS_WEBHOOK_FINGERPRINT_KEYS_JSON: JSON.stringify({ "synthetic-local-v1": "42".repeat(32) }), RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS: "86400", RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED: "false" };
  const project = { id: String(t.projectId), name: String(t.projectName), accountId: String(t.orgId), framework: "nextjs", rootDirectory: null, outputDirectory: null, installCommand: "npm --version", buildCommand: "npm run build", nodeVersion: "24.x", ssoProtection: { deploymentType: "all_except_custom_domains" } };
  const environment = { id: String(t.environmentId), slug: String(t.environmentSlug) };
  const deployment = { id: "dpl_synthetic", url: "immutable-test.vercel.app", readyState: "READY", target: null, projectId: String(t.projectId), ownerId: String(t.orgId), customEnvironment: { id: String(t.environmentId) }, meta: { responseosApplicationSha: app, responseosControlSha: control }, alias: [...t.aliases], automaticAliases: [t.alias], userAliases: [] };
  const alias = { alias: t.alias, projectId: String(t.projectId), deploymentId: deployment.id, deployment: { id: deployment.id, url: deployment.url } };
  const io = {
    toolVersions: vi.fn(async () => ({ node: "v24.18.0", npm: "11.16.0", vercel: "41.7.0" })),
    cliVersion: vi.fn(async () => "41.7.0"),
    get: vi.fn(async (resource: string): Promise<unknown> => resource.includes("custom-environments") ? environment : resource.startsWith("/v9/projects") ? project : resource.startsWith("/v13/") ? deployment : resource.includes(t.alias) ? alias : { ...alias, alias: t.aliases[1] }),
    cli: vi.fn(async (args: string[]) => args[0] === "deploy" ? `https://${deployment.url}` : ""),
    assertCleanSource: vi.fn(async () => undefined),
    readProjectLink: vi.fn(async () => ({ orgId: String(t.orgId), projectId: String(t.projectId) })),
    readPulledEnvironment: vi.fn(async () => pulled), prepareApplication: vi.fn(async () => undefined),
    readBuildTarget: vi.fn(async () => String(t.environmentSlug)), revisions: vi.fn(async () => input), health: vi.fn(async () => ({ build_sha: app })),
  };
  return { input, policy, env, pulled, project, environment, deployment, alias, io, run: () => runQualificationDeployment(input, policy, env, io) };
}
describe("qualification deployment orchestration with synthetic I/O only", () => {
  test("missing or unknown trusted mode rejects before any I/O", async () => {
    for (const mode of [undefined, "", "unknown"]) {
      const f=fixture(); Object.assign(f.policy,{qualificationMode:mode});
      await expect(f.run()).rejects.toThrow("qualification_mode_required");
      expect(f.io.toolVersions).not.toHaveBeenCalled(); expect(f.io.cli).not.toHaveBeenCalled();
    }
  });
  test("wrong runtime or missing application install approval rejects before credentialed I/O", async () => {
    const f=fixture(); f.io.toolVersions.mockResolvedValue({node:"v24.21.0",npm:"11.16.0",vercel:"41.7.0"});
    await expect(f.run()).rejects.toThrow("node_version_mismatch"); expect(f.io.cli).not.toHaveBeenCalled();
    const g=fixture(); g.policy.dependencyInstallationApproved=false;
    await expect(g.run()).rejects.toThrow("dependency_installation_not_authorized"); expect(g.io.toolVersions).not.toHaveBeenCalled();
  });
  test("checked-in disabled policy stops before any I/O", async () => {
    const f = fixture();
    await expect(runQualificationDeployment(f.input, JSON.parse(readFileSync("infra/qualification-deployment.json", "utf8")), f.env, f.io)).rejects.toThrow("not_authorized");
    expect(f.io.cliVersion).not.toHaveBeenCalled();
    const result = spawnSync(process.execPath, ["scripts/run-qualification-deployment.mjs", "missing-application"], { encoding: "utf8", env: { NODE_ENV: "test", SystemRoot: process.env.SystemRoot, PATH: process.env.PATH } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("values withheld");
  });
  test("binds every stage and verifies exact deployment and all three health origins", async () => {
    const f = fixture(); expect(await f.run()).toMatchObject({ deploymentId: "dpl_synthetic", applicationSha: app, controlSha: control });
    expect(f.io.cli.mock.calls.map(c => c[0][0])).toEqual(["pull", "build", "deploy"]);
    expect(f.io.cli.mock.calls[0][0]).toContain(`--environment=${String(t.environmentSlug)}`);
    for (const call of f.io.cli.mock.calls.slice(1)) expect(call[0]).toContain(`--target=${String(t.environmentSlug)}`);
    expect(f.io.cli.mock.calls[2][0]).toContain("--prebuilt");
    expect(f.io.health.mock.calls).toHaveLength(3);
    expect(f.io.get).toHaveBeenCalledWith("/v13/deployments/dpl_synthetic?withGitRepoInfo=true");
  });
  test.each(["controlSha", "workflowSha", "controlHead", "controlTip", "applicationSha", "applicationHead", "ref"])("rejects mismatched %s before I/O", async key => {
    const f = fixture(); Object.assign(f.input, { [key]: "invalid" });
    expect(validateQualificationDispatch(f.input, f.policy).length).toBeGreaterThan(0);
    await expect(f.run()).rejects.toThrow(); expect(f.io.cliVersion).not.toHaveBeenCalled();
  });
  test.each(["org", "project", "environment", "runtime", "protection", "version", "binding", "auth", "effects", "link", "buildTarget", "revisionDrift", "buildCommand", "dirtySource", "dirtySourceAfterBuild", "linkDrift", "envDrift"])("stops %s before deploy", async failure => {
    const f = fixture();
    if (failure === "org") f.env.VERCEL_ORG_ID = "wrong";
    if (failure === "project") f.project.name = "wrong";
    if (failure === "environment") f.environment.slug = "preview";
    if (failure === "runtime") f.project.nodeVersion = "22.x";
    if (failure === "protection") f.project.ssoProtection.deploymentType = "none";
    if (failure === "version") f.io.cliVersion.mockResolvedValue("62.4.0");
    if (failure === "binding") f.pulled.DATABASE_URL = "different-db";
    if (failure === "auth") f.pulled.RESPONSEOS_REQUIRE_AUTH = "false";
    if (failure === "effects") f.pulled.RESPONSEOS_LIVE_EMAIL_ENABLED = "true";
    if (failure === "link") f.io.readProjectLink.mockResolvedValue({ orgId: "wrong", projectId: String(t.projectId) });
    if (failure === "buildTarget") f.io.readBuildTarget.mockResolvedValue("preview");
    if (failure === "buildCommand") f.project.buildCommand = "unexpected";
    if (failure === "dirtySourceAfterBuild") f.io.assertCleanSource.mockResolvedValueOnce(undefined).mockRejectedValue(new Error("dirty after build"));
    if (failure === "dirtySource") f.io.assertCleanSource.mockRejectedValue(new Error("dirty"));
    if (failure === "linkDrift") f.io.readProjectLink.mockResolvedValueOnce({ orgId: String(t.orgId), projectId: String(t.projectId) }).mockResolvedValue({ orgId: "wrong", projectId: String(t.projectId) });
    if (failure === "envDrift") f.io.readPulledEnvironment.mockResolvedValueOnce(f.pulled).mockResolvedValue({ ...f.pulled, RESPONSEOS_LIVE_EMAIL_ENABLED: "true" });
    if (failure === "revisionDrift") f.io.revisions.mockResolvedValue({ ...f.input, controlTip: app });
    await expect(f.run()).rejects.toThrow();
    expect(f.io.cli.mock.calls.some(c => c[0][0] === "deploy")).toBe(false);
  });
  test.each(["deployment", "alias", "sha", "health", "owner", "readFailure"])("rejects %s readback without retry or promotion", async failure => {
    const f = fixture();
    if (failure === "deployment") f.deployment.customEnvironment.id = "other";
    if (failure === "alias") f.alias.deploymentId = "dpl_other";
    if (failure === "sha") f.deployment.meta.responseosApplicationSha = control;
    if (failure === "health") f.io.health.mockResolvedValue({ build_sha: control });
    if (failure === "owner") f.deployment.ownerId = "other";
    if (failure === "readFailure") {
      const read = f.io.get.getMockImplementation()!;
      f.io.get.mockImplementation(async resource => {
        if (resource.startsWith("/v13/deployments/")) throw new Error("synthetic post-deployment readback failure");
        return read(resource);
      });
    }
    await expect(f.run()).rejects.toThrow();
    expect(f.io.cli.mock.calls.filter(c => c[0][0] === "deploy")).toHaveLength(1);
  });
  test.each(["http://test.vercel.app", "https://test.vercel.app/path", "https://user@test.vercel.app", "https://test.vercel.app?token=secret", "https://evil.test", `https://${t.alias}`, "noise\nhttps://test.vercel.app"])("rejects ambiguous CLI output %s", value => expect(() => deploymentHost(value)).toThrow());
});
