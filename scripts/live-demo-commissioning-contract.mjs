export const LIVE_DEMO_TARGET = Object.freeze({
  orgId: "team_BHxIkAGPW6qEKKQBAt9c0NGz",
  projectId: "prj_Pm88ysh24EgV1DEIcvaE9r2Xd28A",
  projectName: "responseos-frl-live-demo",
  environmentId: "env_k4aq29aq3e4XqcKuaNyRYyOJ7YkV",
  environmentSlug: "frl-live-demo",
  alias: "responseos-frl-live-demo-env-frl-live-demo-audiojones.vercel.app",
});

const sha = value => typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
const present = value => typeof value === "string" && value.trim().length > 0;

// Collected evidence only: this never fetches provider data or authorizes execution.
export function validateLiveDemoIdentity(evidence) {
  const errors = [];
  const target = LIVE_DEMO_TARGET;
  const { project, environment, deployment, alias, revisions } = evidence ?? {};
  if (project?.id !== target.projectId || project?.name !== target.projectName || project?.accountId !== target.orgId) errors.push("Project/team identity mismatch");
  if (environment?.id !== target.environmentId || environment?.slug !== target.environmentSlug) errors.push("Custom environment identity mismatch");
  if (!sha(revisions?.control) || revisions.control !== revisions?.workflow || revisions.control !== revisions?.currentMaster || !sha(revisions?.application)) errors.push("Exact revision binding missing or mismatched");
  if (deployment?.projectId !== target.projectId || deployment?.ownerId !== target.orgId || deployment?.customEnvironment?.id !== target.environmentId) errors.push("Deployment target identity mismatch");
  if (!Object.hasOwn(deployment ?? {}, "target") || ![null, target.environmentSlug].includes(deployment?.target)) errors.push("Preview/Production or unknown deployment target is forbidden");
  if (deployment?.meta?.responseosApplicationSha !== revisions?.application || deployment?.meta?.responseosControlSha !== revisions?.control || (deployment?.gitSource?.sha != null && deployment.gitSource.sha !== revisions?.application)) errors.push("Deployment revision mismatch");
  if (typeof deployment?.id !== "string" || !/^dpl_[A-Za-z0-9]+$/.test(deployment.id) || deployment.id !== evidence?.expectedDeploymentId || deployment?.readyState !== "READY") errors.push("Exact READY deployment identity missing");
  if (typeof deployment?.url !== "string" || !/^[a-z0-9-]+\.vercel\.app$/.test(deployment.url) || deployment.url === target.alias || deployment.url !== evidence?.expectedDeploymentHost) errors.push("Immutable deployment host mismatch");
  if (alias?.alias !== target.alias || alias?.projectId !== target.projectId || alias?.deploymentId !== deployment?.id || alias?.deployment?.id !== deployment?.id || alias?.deployment?.url !== deployment?.url || alias?.redirect != null || alias?.redirectStatusCode != null) errors.push("Managed alias binding mismatch");
  for (const key of ["alias", "automaticAliases", "userAliases"]) {
    const values = deployment?.[key];
    if (!Array.isArray(values) || values.some(value => value !== target.alias) || values.length > 1 || (key === "userAliases" && values.length !== 0)) errors.push(`Deployment ${key} evidence missing or unsafe`);
  }
  return errors;
}

export function validateQualificationPreflight(env, policy) {
  const errors = [];
  if (env.RESPONSEOS_DEPLOYMENT_LANE !== "live-demo") errors.push("Wrong deployment lane");
  if (!["1", "true"].includes(env.RESPONSEOS_REQUIRE_AUTH)) errors.push("Explicit authentication required");
  if (env.RESPONSEOS_DEV_SESSION !== undefined && env.RESPONSEOS_DEV_SESSION !== "") errors.push("Development session override forbidden");
  if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(env.CLERK_SECRET_KEY ?? "")) errors.push("Clerk secret key shape invalid");
  if (!/^pk_(test|live)_[A-Za-z0-9=]+$/.test(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "")) errors.push("Clerk publishable key shape invalid");
  if ((env.CLERK_SECRET_KEY ?? "").split("_")[1] !== (env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").split("_")[1]) errors.push("Clerk key modes mismatch");
  if (!/^org_[A-Za-z0-9]+$/.test(env.AJ_DIGITAL_CLERK_ORG_ID ?? "")) errors.push("Operator organization required");
  for (const key of ["RESPONSEOS_LIVE_HUBSPOT_ENABLED", "RESPONSEOS_LIVE_EMAIL_ENABLED"]) {
    if (env[key] !== "false") errors.push(`${key} must explicitly equal false`);
  }
  for (const key of ["HUBSPOT_ACCESS_TOKEN", "RESEND_API_KEY", "RESPONSEOS_AUTHORIZED_EXECUTION_GATES"]) {
    if (present(env[key])) errors.push(`${key} forbidden in qualification`);
  }
  if (policy?.consent?.recording?.enabled !== false) errors.push("Recording must be disabled in tenant consent policy");
  if (policy?.qualificationAssignmentActive !== true || policy?.crmEmailPermanentlyBlocked !== true) errors.push("Qualification assignment and permanent CRM/email prohibition evidence required");
  if (env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED !== "false" || present(env.TELNYX_API_KEY)) errors.push("Offline qualification preflight requires carrier effects disabled");
  return errors;
}
