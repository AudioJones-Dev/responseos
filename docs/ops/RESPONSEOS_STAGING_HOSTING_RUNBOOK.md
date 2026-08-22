# ResponseOS — Staging Hosting Runbook (Path A)

**Owner:** Audio (AJ Digital LLC) · **Status:** Operator runbook (configuration certified; deployment separately gated)
**Scope:** Hosted **staging only** — Neon + Clerk + Vercel client access while providers remain **mock**.  
**Does not authorize:** live Telnyx/Vapi/Twilio/HubSpot/Calendly, production deploy, or pilot go-live.  
**Canon:** [`../product/responseos-v0.3-founding-pilot-scope.md`](../product/responseos-v0.3-founding-pilot-scope.md) Stage **C**, [`../env-spec.md`](../env-spec.md), [`../DEPLOYMENT.md`](../DEPLOYMENT.md), ADR-0001 / ADR-0019.

---

## 0. What “done” means for Path A

| Gate | Done when |
|---|---|
| Staging environment | Governed Vercel custom environment `staging` (`env_uX6Qp8F6w9aBgx2ikH3BiREB8aHH`), type `preview`; no branch matcher, domain, alias, or deployment |
| Auth | Real Clerk login (no `RESPONSEOS_DEV_SESSION`) |
| Tenant | Clerk org → `Account.clerk_org_id` → membership → portal session with `accountId` |
| Data | Canonical Neon identity proven before migration; staging DB migrated; seed optional for demo fixtures |
| Providers | Still mock (no telephony/CRM/scheduling secrets required) |
| Prod | **Still off** — `vercel.json` disables every automatic Git deployment; no prod GH job |
| Identity | `/api/health` reports the exact reviewed build SHA and staging environment |

Until the staging URL is live with Clerk login, dashboard **L-02** stays partial / In Progress — not Done.

---

## 1. Credential / platform audit (names only — no secrets)

Verified snapshot from the 2026-08-21 remediation (operator must re-check before retry):

| Surface | Observed | Gap for Path A staging |
|---|---|---|
| **GitHub Environment** | `staging` exists with required reviewer `AudioJones-Dev` and a `master`-only deployment branch policy | Keep all deploy credentials Environment-scoped; deployment retry still requires a separate approval. |
| **GitHub staging secrets** | Database URLs, verified Vercel team/project ids, Vercel token, automation-bypass secret, and a secret named `NEON_API_KEY` are present | Values remain unreadable by design. The Neon key's validity and project scope are unverified until the protected configuration-only workflow successfully reads the canonical resources; database identity and attestation must also pass before deployment is authorized. |
| **Vercel** | Dedicated `audiojones/responseos-staging-mock`; Node **24.x**; `live=false`; no deployments, production target, aliases, custom domains, or Git integration | Keep Vercel Authentication enabled (`all_except_custom_domains`). Use only a project-scoped automation bypass for CI smoke. |
| **Neon** | Canonical project `responseos-staging-mock` (`patient-snow-16014934`), branch `main` (`br-mute-boat-a6ylen11`), endpoint `ep-young-morning-a6oeu9vv`, and database `neondb` were verified read-only | Never substitute the separate `responseos` project. The configuration-only workflow must produce live API evidence and the Vercel database revision attestation before retry. |
| **Clerk** | All eight required Preview names and same-development-instance provenance are verified | Do not change Clerk configuration during the database preflight. |
| **Sentry / PostHog** | Env placeholders in `.env.example`; **no SDK packages wired** | Optional for Path A: create projects, set DSNs later; tagging contract documented in §6. |
| **Live providers** | Forbidden until Stage D+ | Leave Telnyx/Vapi/etc. unset. The staging preflight rejects live-provider credentials before migration or build. |

---

## 2. Staging env checklist (placeholders only)

Copy from [`.env.example`](../../.env.example) / [`../env-spec.md`](../env-spec.md). Set values in **Vercel project → Environment (Preview or a dedicated Staging)** and mirror migration URLs into **GitHub Environment `staging` secrets**. Never commit real values.

### Required for Path A portal smoke

| Variable | Where | Notes |
|---|---|---|
| `DATABASE_URL` | Governed custom environment Sensitive + `STAGING_DATABASE_URL` (GH) | Neon **pooled** connection string |
| `DIRECT_URL` | Governed custom environment Sensitive + `STAGING_DIRECT_URL` (GH) | Neon **direct** (migrations) |
| `RESPONSEOS_DATABASE_IDENTITY` | Governed custom environment encrypted | Version 2 non-secret JSON attestation binding Neon identity, Vercel project/custom-environment identity, and exact DB variable ids/revisions |
| `CLERK_SECRET_KEY` | Governed custom environment Sensitive | Known `sk_test_` secret from the same development instance as the publishable key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Governed custom environment encrypted | Staging publishable key |
| `CLERK_WEBHOOK_SECRET` | Governed custom environment Sensitive | Svix secret for that development instance's `/api/webhooks/clerk` endpoint |
| `AJ_DIGITAL_CLERK_ORG_ID` | Governed custom environment encrypted | Control-plane Clerk org id (`Session.account = null`) |
| `NEXT_PUBLIC_APP_URL` | Governed custom environment encrypted | Non-production HTTPS base URL |
| `RESPONSEOS_REQUIRE_AUTH` | Governed custom environment encrypted | Set (`1` or `true`) so auth cannot fail-open (ADR-0039) |
| `RESPONSEOS_PROVIDER_KEY` | Not migrated by this gate | Optional mock-only key remains separately gated; it is not one of the nine certified variables |

Vercel does not return values marked Sensitive. The configuration-only workflow validates the complete nine-variable generic Preview source plan before its first mutation, then edits each existing variable by ID using only `target: []` and the exact `customEnvironmentIds`. No Sensitive value is sent. Unfiltered metadata must prove generic Preview applicability is gone, while `customEnvironmentId`-filtered metadata must prove the same IDs are available to governed staging. `decrypt=true` remains restricted to the five exact readable names after encrypted type, exact scope, ID, and uniqueness checks. Temporary readable responses stay under `RUNNER_TEMP` and are never logged or uploaded. The version 2 database attestation binds live canonical Neon evidence, a credential-free fingerprint, DB variable IDs/revisions, the Vercel project, and the exact custom environment. Any partial scope failure SAFE STOPs, reports only changed IDs and observed scopes, and performs no rollback, migration, or deployment.

### Must NOT be set on staging/prod

| Variable | Why |
|---|---|
| `RESPONSEOS_DEV_SESSION` | Hard-fails under `NODE_ENV=production` |

### Deploy job secrets (GitHub Environment `staging`)

| Secret | Purpose |
|---|---|
| `VERCEL_TOKEN` | Vercel deploy token (team-scoped, least privilege) |
| `VERCEL_ORG_ID` | Canonical Vercel team id; configuration verification checks it by REST readback |
| `VERCEL_PROJECT_ID` | Project id |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Must match a Protection Bypass for Automation secret on `responseos-staging-mock`; smoke sends it only as an HTTP header |
| `NEON_API_KEY` | Least-privilege Neon control-plane key used only by preflight to read canonical project, branch, endpoint, and database metadata; never passed to Vercel or the app |
| `STAGING_DATABASE_URL` | Neon pooled URL for `prisma migrate deploy` |
| `STAGING_DIRECT_URL` | Neon direct URL for migrations |

### Optional observability (Path A+)

| Variable | Purpose |
|---|---|
| `SENTRY_DSN` | Error tracking (wire SDK only after DSN exists) |
| `POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_KEY` | Product analytics |

### Explicitly out of Path A

Telephony / voice / CRM / calendar / Stripe / R2 keys — leave blank. The preflight rejects them even though the current CAL factories are mock-only (ADR-0001).

---

## 3. Operator provision sequence

Do these in order. Stop if any step needs a credential you do not have — do not invent secrets in the repo.

### 3.1 Neon staging database

1. Use only project `responseos-staging-mock` (`patient-snow-16014934`) and branch `main` (`br-mute-boat-a6ylen11`). The separate `responseos` project must never satisfy this gate.
2. From that branch, set **pooled** only in GitHub staging `STAGING_DATABASE_URL` and **direct** only in GitHub staging `STAGING_DIRECT_URL`.
3. Before the one-time migration, keep the existing Vercel `DATABASE_URL` and `DIRECT_URL` variables Sensitive and unbranched in their certified generic Preview source scope. The authorized configuration workflow changes scope by ID without reading or sending either value.
4. Add a project-scoped Neon API key to GitHub Environment `staging` as `NEON_API_KEY`. Neon project-scoped keys are the narrowest available project boundary; the verification workflow uses only `GET` requests and never passes the key to Vercel or the app.
5. Before authorizing the one-time migration, merge a separately reviewed deployment-workflow hardening PR that makes **Deploy Staging** verify the exact custom-environment ID and explicitly target slug `staging`. The configuration workflow rejects generic `--environment=preview` or `--target=preview` controls before it builds a migration plan or PATCHes scope.
6. After both workflow-control changes are merged, run **Verify Staging Configuration** from `master` with confirmation `configuration-only` and that exact control SHA. The reserved application SHA remains `4a5b29b83cb3f18137b0151ae6242b2ac484ef08`; this lane never checks out, builds, migrates, or deploys it. It verifies deployment compatibility, the complete source plan, readable posture, live Neon identity, and GitHub DB roles before re-scoping the nine existing variables without values. It then proves generic Preview removal, creates version 2 environment-bound identity evidence, certifies the governed custom environment, and stops.
7. Confirm the job ends with the configuration-only success notice. It contains no migration or deployment step; **Deploy Staging** remains a separate authorization.
8. If either GitHub database URL changes, rerun configuration verification before any deployment. The Vercel ids/`updatedAt` bindings intentionally make old evidence stale.
9. Never print, persist, diff, hash in full, or compare plaintext connection strings. The workflow streams values between protected stores and emits only resource identity and a credential-free SHA-256 fingerprint.

Protected run `32538420957` proved the staging Environment `NEON_API_KEY` can read the canonical project, branch, endpoint, and database. The key remains confined to the GitHub Environment and is never sent to Vercel or the application.

The repository also contains an older repository-level `NEON_API_KEY`. Repository search finds no legitimate consumer outside jobs that declare `environment: staging`, where GitHub resolves the Environment-scoped secret of the same name. The broader repository secret is redundant and should be removed under a separate credential-cleanup authorization only after the Environment credential passes the protected preflight; do not rotate or delete it as part of this change.

Configuration-only run [`32538420957`](https://github.com/AudioJones-Dev/responseos/actions/runs/32538420957) passed the earlier REST-only generic Preview certification. Configuration-only run [`32586167278`](https://github.com/AudioJones-Dev/responseos/actions/runs/32586167278), controlled by `6202da68cb9b517b39814bab5b1542fd65adae22`, is the certified governed-custom-environment baseline recorded by [Environment Promotion Contract v1](../../infra/environments/staging/certification.json). It certifies configuration only and preserves the separately reviewed intended application SHA `4a5b29b83cb3f18137b0151ae6242b2ac484ef08`; it is not deployment evidence. **Deploy Staging** remains a separate authorization.

Both **Verify Staging Configuration** and **Deploy Staging** use the top-level concurrency group `responseos-staging-exclusive` with `cancel-in-progress: false`. One run queues behind the other, so database synchronization/attestation cannot overlap deployment preflight, migration, build, or staging deployment.

### 3.2 Clerk staging application

1. Create or select a **development/staging** Clerk application (prefer separate from future prod).
2. Enable Organizations.
3. Note `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
4. Create the AJ Digital **control** organization → copy its id to `AJ_DIGITAL_CLERK_ORG_ID`.
5. After the staging URL exists: add webhook endpoint  
   `https://<STAGING_HOST>/api/webhooks/clerk`  
   for `organization.*`, `organizationMembership.*`, `user.*` (as implemented by `lib/auth/clerk-sync.ts`). Copy signing secret → `CLERK_WEBHOOK_SECRET`.
6. Set allowed origins / redirect URLs to the staging host.
7. Before approving a retry, verify the secret key is `sk_test_`, the publishable key is `pk_test_`, and both plus the webhook and control org belong to the same Clerk development instance. Vercel metadata cannot prove write-only secret provenance.

### 3.3 Vercel staging surface

1. Use only the dedicated `responseos-staging-mock` project. The workflow fails closed on any name, team, project-id, or account-id mismatch.
2. Keep **all automatic Git-triggered Vercel deployments disabled** (`vercel.json` → `git.deploymentEnabled: false`). Explicit governed deployment workflows remain separately gated.
3. Set Path A env vars for Preview (or Staging) — values live only in the platform store, never in git.
4. Add the database identity attestation from §3.1 as readable encrypted metadata. Do not mark it Sensitive because the workflow must read it; it contains no credential material.
5. Keep Vercel Authentication enabled. Create one Protection Bypass for Automation secret for GitHub staging smoke; do not create a public exception domain or disable protection.
6. Preserve the verified project Node version **24.x** (`24.18.0` in CI/`package.json`).

### 3.4 GitHub Environment protection

1. Repo → Settings → Environments → **New environment: `staging`**.
2. Enable **Required reviewers** (Audio or designated operator).
3. Optional: deployment branch policy limiting to `master` + release tags (never open to arbitrary forks).
4. Add the deploy secrets from §2 (environment-scoped), including the read-only `NEON_API_KEY`.
5. Do **not** add an automatic production deploy workflow. `Production` environment may exist historically — leave it unused until Stage I authorization.

### 3.5 First staging deploy

1. Confirm `NEON_API_KEY` and `RESPONSEOS_DATABASE_IDENTITY` are configured and the private Clerk same-instance gate is cleared.
2. Confirm the one-time custom-environment scope migration and version 2 recertification run succeeded after the deployment-control PR merged.
3. Actions → **Deploy Staging** → Run workflow.
4. Confirmation input: type exactly `staging`.
5. Control input: enter the exact current `master` workflow-control SHA. Application input: enter the separately reviewed application SHA; the workflow never substitutes one for the other.
6. Approve the Environment gate when prompted.
7. On success: record the unique protected custom-environment deployment URL. Alias/promotion remains a separate operator action and is not part of this workflow.
8. Confirm the automated database-identity, health/build-identity, public-demo, and anonymous protected-route smoke checks passed.
9. Run tenant bootstrap smoke (§4).

---

## 4. Tenant bootstrap smoke (Clerk org → Account → portal)

Providers remain mock. Goal: prove auth + tenant isolation path on hosted staging.

### 4.1 Happy path

1. **Migrate** — ensured by the deploy job (`prisma migrate deploy`) or run locally against staging URLs (operator machine only; never commit URLs).
2. **Optional seed** — `npx prisma db seed` against staging for demo fixtures (`org_mock_1` / Sunshine HVAC). Seeded accounts use fixed ids without `clerk_org_id`; real Clerk orgs create **new** `Account` rows via webhook.
3. **Create pilot Clerk organization** (e.g. “Sunshine HVAC Staging”) and invite a test user as org admin.
4. **Confirm webhook delivery** — Clerk dashboard shows `organization.created` / `organizationMembership.created` / `user.created` → `2xx` from staging.
5. **DB check** (Neon SQL console; placeholders):

   ```sql
   SELECT id, name, slug, clerk_org_id, status
   FROM "Account"
   WHERE clerk_org_id IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 10;

   SELECT id, email, role, account_id, clerk_user_id
   FROM "User"
   WHERE clerk_user_id IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 10;
   ```

6. **Portal login** — open `NEXT_PUBLIC_APP_URL`, sign in with the invited user, select the tenant org.
7. **Session expectation** — tenant user sees client portal scoped to that `Account`; control-org members (`AJ_DIGITAL_CLERK_ORG_ID`) resolve `Session.account = null` (cross-tenant AJ roles).
8. **Negative check** — user in org A must not see org B data (existing isolation tests cover the data layer; spot-check UI).

### 4.2 Failure cheatsheet

| Symptom | Likely cause |
|---|---|
| Webhook `503` | `CLERK_WEBHOOK_SECRET` or `DATABASE_URL` missing |
| Org created but no `Account` | Webhook not configured / wrong URL / signature fail |
| User logs in but no tenant | Membership synced before org, or user row missing `clerk_user_id` — Clerk redelivery / retryable sync |
| Redirect loop / open portal without auth | `RESPONSEOS_REQUIRE_AUTH` unset on hosted surface |
| Dev-session error in logs | `RESPONSEOS_DEV_SESSION` set under production Node env — remove it |

### 4.3 Scripts

No new bootstrap script ships in this phase. Use:

- `npx prisma migrate deploy` (CI job or operator)
- `npx prisma db seed` (optional fixtures; mock-friendly; safe only against **staging** DB)
- Clerk Dashboard + Neon SQL for verification

Do not run seed/migrate against production until Stage I.

---

## 5. Deploy workflow reference

Configuration gate:

- Workflow file: [`.github/workflows/verify-staging-configuration.yml`](../../.github/workflows/verify-staging-configuration.yml)
- Trigger: manual `workflow_dispatch` from `master` only, with `configuration-only` plus the exact current master SHA
- Behavior: exact control SHA → protected project + exact custom-environment posture → deployment-workflow compatibility → complete generic Preview source plan → allowlisted readable posture → canonical Neon/GitHub database evidence → value-less nine-variable scope migration → filtered/unfiltered readback → version 2 environment-bound attestation → final custom-environment certification
- Compatibility stop: this gate fails before migration planning or scope mutation unless the exact checked-out Deploy Staging controls verify custom environment `env_uX6Qp8F6w9aBgx2ikH3BiREB8aHH` and explicitly target its `staging` slug without a generic Preview fallback.
- Explicit non-goals: no migration, deploy, alias, production target, provider activation, phone routing, or prospect exposure

Deployment gate:

- Workflow file: [`.github/workflows/deploy-staging.yml`](../../.github/workflows/deploy-staging.yml)
- Trigger: **manual** `workflow_dispatch` from `master` only, with `staging`, exact current `control_sha`, and separate exact reviewed `application_sha`
- Guard: both SHAs must be lowercase 40-character values; the control SHA must equal the dispatched workflow SHA and current remote `master` before and after the protected Environment wait
- Environment: `staging` (approval gate)
- Behavior: control/source dual checkout → REST-only exact project/custom-environment/protection/bypass/posture checks → canonical Neon and GitHub pooled/direct identity → current version 2 DB-variable revision attestation → dependency/Prisma setup → migration status → immediate REST recertification → `prisma migrate deploy` → pinned CLI deployment to REST-verified slug `staging` with exact-checked `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`, no link/pull, and `--skip-domain` → exact environment/source/alias readback → READY → bypass-header build-identity/auth smoke
- Explicit non-goals: no `on: push`; no generic Preview or Production target; no seed; no alias/promotion; no live provider cutover

The Vercel-hosted build is deliberate: custom-environment database and Clerk server values are marked Sensitive and cannot be downloaded for a local prebuilt build. Vercel consumes them inside its protected build/runtime boundary while GitHub retains only the migration database URLs and deploy credentials. `vercel link` and `vercel pull` are not used. The workflow first proves the exact environment ID maps to slug `staging`, then targets that slug explicitly while injecting the non-secret application SHA into build/runtime health evidence.

If migration succeeds but deployment, readiness, or smoke fails, the workflow SAFE STOPs. It records non-secret migration/deployment outcome evidence, performs no automatic schema rollback, creates no alias, and requires separate remediation authorization.

Rollback: redeploy the previous **staging** deployment from the Vercel UI, or re-run the workflow on a known-good SHA. Production aliases are never part of this workflow. The app continues to boot with mock providers because the staging preflight rejects live-provider credentials.

---

## 6. Observability baseline (docs-first)

SDK wiring is deferred until DSNs exist (no Sentry/PostHog packages in `package.json` today). Contract for when wired:

| Tool | Env | Tenant tag | PII rule |
|---|---|---|---|
| Sentry | `SENTRY_DSN` | `accountId` (or `account_id`) tag / context on every event | No names, phones, transcripts |
| PostHog | `POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_KEY` | `account_id` group/property | No raw PII (ADR-0018) |
| Better Stack (optional) | operator console | uptime on staging URL | — |

Until SDKs land: rely on Vercel runtime logs + Clerk webhook logs + Neon metrics. See [`RESPONSEOS_OBSERVABILITY_AND_GOVERNANCE.md`](./RESPONSEOS_OBSERVABILITY_AND_GOVERNANCE.md) § A7.

---

## 7. Authorization reminder

Repository-side Stage C hardening was authorized on 2026-08-18. Creating platform resources, injecting secret values, and running the actual staging deployment remain operator/platform steps and are not implied by that code authorization.

The [Environment Promotion Runbook](./RESPONSEOS_ENVIRONMENT_PROMOTION_RUNBOOK.md) governs any future staging-to-Production planning. It does not alter this first-staging-deployment path and does not authorize a Production resource, secret, alias, provider, or deploy action.

| Stage | This runbook |
|---|---|
| A Mock CAL | Out of scope (PR #108) |
| B Schema/env placeholders | Not required for Path A if schema already on Neon |
| **C Staging host** | **This document** |
| D–H Live providers | Forbidden here |
| I Production pilot | Forbidden here |

---

## 8. Merge / rebase notes for parallel PRs

| Open PR | Overlap with this prep |
|---|---|
| [#109](https://github.com/AudioJones-Dev/responseos/pull/109) Phase 0 docs | `CHANGELOG.md`, `DEPLOYMENT.md`, `dashboard-data.json`, ops deployment plan — rebase/merge carefully |
| [#108](https://github.com/AudioJones-Dev/responseos/pull/108) Phase 1 CAL mocks | Mostly `lib/providers/*` — low conflict; keep mocks |

Prefer merging #109 → #108 → this staging prep, or rebase this branch onto the updated default after those land.

---

*Placeholders only in git. No production deploy. Providers stay mock until later stages.*
