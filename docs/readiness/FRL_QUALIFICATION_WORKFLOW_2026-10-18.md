# Qualification workflow successor — local development only

Base: 457e568b7c9d771da9f7882c9470d8f657e0f841. The prior checkpoint is preserved in its own worktree. This successor does not activate deployment.

## Implemented local package

A separately checked-out control revision verifies its equality with workflow_sha and the approved control branch tip; application checkout must equal its separately approved full SHA. Fixed team/project/environment tuple, downloaded linkage/environment, auth/effects-disabled preflight, DB URL equality, build settings, source cleanliness, prebuilt target, provider deployment/alias identities and health build SHA are wired through one orchestration function and the protected workflow adapter. Synthetic I/O tests exercise the sequence and negative paths. No migration command exists in this workflow.

The checked-in activation policy is disabled. This is an implemented but inactive workflow, not a hosted acceptance result. No deployment, CLI install, dependency install, credential access, provider operation, schema edit, model invocation or live call was performed during development. Local tests use copied dependencies and disposable PostgreSQL with existing migrations only.

## Activation dependencies — owner approval required

Audio owns approval of control ref, application SHA, approval record, protected environment reviewers and dependency preparation. An activated runner must already provide Node 24.18.0/npm 11.16.0/Vercel 41.7.0; no automatic CLI installer exists. Installed CLI 41.7 compatibility still needs explicit approved verification. Dependency preparation would run npm ci with scripts disabled, the reviewed minimatch patch and Prisma generation. No packages were installed for this work.

The expected project settings are Next.js, Node 24.x, null root/output directories, installCommand `npm --version` (dependencies prepared separately), buildCommand `npm run build`, and protection all_except_custom_domains. These are conservative required settings, not a claim about current hosted settings. Any necessary hosted change needs separate approval. Downloaded local settings must match. The application vercel.json may contain only its current schema and disabled Git-deployment configuration. Application and dependency code execute on the same runner: separate directories are not a sandbox or a substitute for reviewing the exact application and lockfile.

The offline qualification preflight intentionally requires Telnyx ingest false and no Telnyx API key, as well as CRM/email false and absent business-provider keys/gates. The resulting deployment cannot itself authorize a live carrier qualification. Qualification assignment booleans in the activation evidence are owner assertions; real durable assignment and DB role/schema verification remain hosted gates.

Vercel owner-response schema is documented in the official SDK vercel-spec.json, GET /v13/deployments/{idOrUrl}, response oneOf owner variant: projectId and ownerId required; customEnvironment and alias arrays optional. This workflow deliberately requires complete alias arrays and customEnvironment.id and rejects incomplete/public variants without filling missing evidence. Such a post-deploy refusal may occur after a deployment/alias change has already happened; there is no automatic retry, promotion or rollback. Health with a bypass header proves revision reachability only. Anonymous, invalid/unmapped Clerk, operator positive control and cross-tenant hosted checks remain mandatory. Pulled environment equality does not establish effective deployed configuration: remote variables may change during the build; verify the deployment retains auth/effects-disabled settings before any qualification call.

## Additional evidence and remaining gates

Session tests exercise Clerk configuration/auth errors without privileged fallback and operator/aj_admin versus own/foreign tenant review authorization. A real-database regression ends qualification, activates the tenant normally, then verifies the original call still cannot obtain either CRM or email provider or create an effect attempt, even with approved review and prior CRM success status.

Immutable raw webhook identity remains a separately proposed schema change; see the external CHECKPOINT-REVIEW.md. No fingerprint migration/backfill/key provisioning is included. Manual operator summary and qualification remain the demonstration path; deterministic Analysis unavailable is unchanged. Two consecutive complete internal live rehearsals, human-approved frozen content and real HubSpot/message/inbox readbacks remain required before Mike-demo readiness.

Acceptance evidence must identify the final commit and tree, quality command exit codes, unit count, PostgreSQL 16/17/18 counts and disposable cleanup. Hosted CI and commissioning are not inferred from those local results.
