import { LIVE_DEMO_TARGET as target, validateLiveDemoIdentity, validateQualificationPreflight } from "./live-demo-commissioning-contract.mjs";

const fullSha = value => typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
export function validateQualificationDispatch(input, policy) {
  const errors = [];
  if (policy?.enabled !== true) errors.push("qualification_deployment_not_authorized");
  if (!/^refs\/heads\/[A-Za-z0-9][A-Za-z0-9/_-]*$/.test(policy?.trustedControlRef ?? "") || input.ref !== policy.trustedControlRef) errors.push("unapproved_control_ref");
  if (!fullSha(input.controlSha) || input.controlSha !== input.workflowSha || input.controlSha !== input.controlHead || input.controlSha !== input.controlTip) errors.push("control_revision_mismatch");
  if (!fullSha(input.applicationSha) || input.applicationSha !== input.applicationHead || input.applicationSha !== policy?.approvedApplicationSha) errors.push("application_revision_mismatch");
  if (typeof policy?.approvalReference !== "string" || !policy.approvalReference.trim()) errors.push("approval_reference_missing");
  return errors;
}

export function validateQualificationTarget(project, environment, env) {
  const errors = [];
  if (env.VERCEL_ORG_ID !== target.orgId || env.VERCEL_PROJECT_ID !== target.projectId) errors.push("configured_target_mismatch");
  if (project?.id !== target.projectId || project?.name !== target.projectName || project?.accountId !== target.orgId) errors.push("project_identity_mismatch");
  if (environment?.id !== target.environmentId || environment?.slug !== target.environmentSlug) errors.push("custom_environment_mismatch");
  if (project?.ssoProtection?.deploymentType !== "all_except_custom_domains") errors.push("deployment_protection_required");
  if (project?.nodeVersion !== "24.x") errors.push("project_runtime_mismatch");
  if (project?.framework !== "nextjs" || project?.rootDirectory !== null || project?.outputDirectory !== null || project?.installCommand !== "npm --version" || project?.buildCommand !== "npm run build") errors.push("unapproved_project_build_settings");
  return errors;
}

function requireValid(errors) {
  if (errors.length) throw new Error(errors.join(","));
}

export function deploymentHost(output) {
  const value = String(output).trim();
  let url;
  try { url = new URL(value); } catch { throw new Error("invalid_deployment_url"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/.test(url.hostname) || target.aliases.includes(url.hostname)) throw new Error("invalid_deployment_url");
  return url.hostname;
}

/** All I/O is explicit so the complete sequence can run against synthetic adapters. */
export async function runQualificationDeployment(input, policy, env, io) {
  requireValid(validateQualificationDispatch(input, policy));
  if (env.VERCEL_ORG_ID !== target.orgId || env.VERCEL_PROJECT_ID !== target.projectId || !env.VERCEL_TOKEN || !env.VERCEL_AUTOMATION_BYPASS_SECRET) throw new Error("configured_target_or_token_missing");
  if ((await io.cliVersion()).trim() !== "41.7.0") throw new Error("vercel_cli_version_mismatch");
  const projectPath = `/v9/projects/${target.projectId}`;
  const environmentPath = `${projectPath}/custom-environments/${target.environmentId}`;
  const project = await io.get(projectPath);
  const environment = await io.get(environmentPath);
  requireValid(validateQualificationTarget(project, environment, env));
  await io.cli(["pull", "--yes", `--environment=${target.environmentSlug}`]);
  const link = await io.readProjectLink();
  if (link?.orgId !== target.orgId || link?.projectId !== target.projectId) throw new Error("pulled_project_link_mismatch");
  const pulled = await io.readPulledEnvironment(target.environmentSlug);
  requireValid(validateQualificationPreflight(pulled, policy.qualificationEvidence));
  if (pulled.NEXT_PUBLIC_APP_URL !== `https://${target.alias}`) throw new Error("application_origin_mismatch");
  for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
    if (!env[name] || pulled[name] !== env[name]) throw new Error("database_binding_mismatch");
  }
  // Dependency installation is an explicit future approval, never a CLI fallback.
  if (policy.dependencyInstallationApproved !== true) throw new Error("dependency_installation_not_authorized");
  await io.assertCleanSource();
  await io.prepareApplication();
  await io.cli(["build", `--target=${target.environmentSlug}`], { RESPONSEOS_BUILD_SHA: input.applicationSha });
  if (await io.readBuildTarget() !== target.environmentSlug) throw new Error("prebuilt_target_mismatch");
  await io.assertCleanSource();
  const finalLink = await io.readProjectLink();
  if (finalLink?.orgId !== target.orgId || finalLink?.projectId !== target.projectId) throw new Error("pulled_project_link_mismatch");
  const finalEnv = await io.readPulledEnvironment(target.environmentSlug);
  if (JSON.stringify(Object.entries(finalEnv).sort()) !== JSON.stringify(Object.entries(pulled).sort())) throw new Error("pulled_environment_changed");
  requireValid(validateQualificationDispatch(await io.revisions(), policy));
  requireValid(validateQualificationTarget(await io.get(projectPath), await io.get(environmentPath), env));
  const host = deploymentHost(await io.cli([
    "deploy", "--prebuilt", "--yes", `--target=${target.environmentSlug}`,
    "--meta", `responseosApplicationSha=${input.applicationSha}`,
    "--meta", `responseosControlSha=${input.controlSha}`,
    "--env", `RESPONSEOS_BUILD_SHA=${input.applicationSha}`,
  ]));
  const deployment = await io.get(`/v13/deployments/${host}?withGitRepoInfo=true`);
  if (typeof deployment?.id !== "string" || !/^dpl_[A-Za-z0-9]+$/.test(deployment.id)) throw new Error("deployment_id_missing");
  const byId = await io.get(`/v13/deployments/${deployment.id}?withGitRepoInfo=true`);
  if (byId.id !== deployment.id || byId.url !== host) throw new Error("deployment_readback_conflict");
  const alias = await io.get(`/v4/aliases/${target.alias}?projectId=${target.projectId}`);
  const aliases = [alias];
  for (const host of target.aliases.filter(value => value !== target.alias)) aliases.push(await io.get(`/v4/aliases/${host}?projectId=${target.projectId}`));
  requireValid(validateLiveDemoIdentity({
    project, environment, deployment: byId, alias, aliases,
    expectedDeploymentId: deployment.id, expectedDeploymentHost: host,
    revisions: { control: input.controlSha, workflow: input.workflowSha, trustedControlTip: input.controlTip, application: input.applicationSha },
  }));
  for (const origin of [`https://${host}`, ...target.aliases.map(value => `https://${value}`)]) {
    const health = await io.health(origin);
    if (health?.build_sha !== input.applicationSha) throw new Error("health_revision_mismatch");
  }
  return { deploymentId: deployment.id, host, applicationSha: input.applicationSha, controlSha: input.controlSha };
}
