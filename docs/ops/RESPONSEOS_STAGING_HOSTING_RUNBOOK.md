# ResponseOS — Staging Hosting Runbook (Path A)

**Owner:** Audio (AJ Digital LLC) · **Status:** Operator runbook (staging remediation in review)
**Scope:** Hosted **staging only** — Neon + Clerk + Vercel client access while providers remain **mock**.  
**Does not authorize:** live Telnyx/Vapi/Twilio/HubSpot/Calendly, production deploy, or pilot go-live.  
**Canon:** [`../product/responseos-v0.3-founding-pilot-scope.md`](../product/responseos-v0.3-founding-pilot-scope.md) Stage **C**, [`../env-spec.md`](../env-spec.md), [`../DEPLOYMENT.md`](../DEPLOYMENT.md), ADR-0001 / ADR-0019.

---

## 0. What “done” means for Path A

| Gate | Done when |
|---|---|
| Staging URL | Protected HTTPS Vercel Preview URL; no production alias required |
| Auth | Real Clerk login (no `RESPONSEOS_DEV_SESSION`) |
| Tenant | Clerk org → `Account.clerk_org_id` → membership → portal session with `accountId` |
| Data | Canonical Neon identity proven before migration; staging DB migrated; seed optional for demo fixtures |
| Providers | Still mock (no telephony/CRM/scheduling secrets required) |
| Prod | **Still off** — `vercel.json` keeps `master` auto-deploy disabled; no prod GH job |
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
| `DATABASE_URL` | Vercel Preview Sensitive + `STAGING_DATABASE_URL` (GH) | Neon **pooled** connection string |
| `DIRECT_URL` | Vercel Preview Sensitive + `STAGING_DIRECT_URL` (GH) | Neon **direct** (migrations) |
| `RESPONSEOS_DATABASE_IDENTITY` | Vercel Preview encrypted, unbranched | Non-secret JSON attestation binding project/branch/endpoint/database fingerprint to the exact Vercel `DATABASE_URL` and `DIRECT_URL` ids and `updatedAt` revisions |
| `CLERK_SECRET_KEY` | Vercel Preview Sensitive | Known `sk_test_` secret from the same development instance as the publishable key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Vercel only | Staging publishable key |
| `CLERK_WEBHOOK_SECRET` | Vercel Preview Sensitive | Svix secret for that development instance's `/api/webhooks/clerk` endpoint |
| `AJ_DIGITAL_CLERK_ORG_ID` | Vercel only | Control-plane Clerk org id (`Session.account = null`) |
| `NEXT_PUBLIC_APP_URL` | Vercel only | Public staging base URL (e.g. `https://staging.example`) |
| `RESPONSEOS_REQUIRE_AUTH` | Vercel only | Set (`1` or `true`) on hosted staging so auth cannot fail-open (ADR-0039) |
| `RESPONSEOS_PROVIDER_KEY` | Vercel only | Optional for Path A mock; base64 32-byte AES if encrypting stored creds later |

Vercel does not return values marked Sensitive. The configuration-only workflow therefore verifies those variables by name, unbranched Preview scope, and Sensitive type through authenticated REST metadata; it sends `decrypt=true` only for the exact allowlist of readable flags, HTTPS app URL, `pk_test_` publishable key, control-org id, and final non-secret database attestation after each entry passes name, encrypted type, scope, and uniqueness checks. Readable responses exist only under `RUNNER_TEMP` and are never logged or uploaded. Database URLs, Clerk private keys, webhook secrets, and arbitrary variables cannot enter the decrypted-fetch path. For the database pair, existence is insufficient: the workflow requires a readable non-secret identity attestation bound to each Sensitive variable's exact Vercel id and `updatedAt` revision, derives the migration target from the GitHub URLs in memory, and verifies project/branch/endpoint/database ownership against the Neon API. The private Clerk key/webhook provenance remains a human same-instance gate. Missing, mismatched, stale, duplicated, or unverifiable configuration stops the job before database migration.

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
3. Keep the existing Vercel `DATABASE_URL` and `DIRECT_URL` variables Sensitive and unbranched Preview-scoped. Their values are write-only.
4. Add a project-scoped Neon API key to GitHub Environment `staging` as `NEON_API_KEY`. Neon project-scoped keys are the narrowest available project boundary; the verification workflow uses only `GET` requests and never passes the key to Vercel or the app.
5. After the configuration workflow is merged under a separately reviewed workflow-control SHA, run **Verify Staging Configuration** from `master` with confirmation `configuration-only` and that exact control SHA. The application SHA reserved for a later separately authorized deployment remains `4a5b29b83cb3f18137b0151ae6242b2ac484ef08`; the preflight never checks out, builds, migrates, or deploys it. The protected job validates the GitHub URLs against live canonical Neon metadata before any write, synchronizes those same verified values to the two existing Vercel Preview Sensitive variables, then creates/updates encrypted `RESPONSEOS_DATABASE_IDENTITY` against their new ids/revisions.
6. Confirm the job ends with the configuration-only success notice. It contains no migration or deployment step; **Deploy Staging** remains a separate authorization.
7. If either GitHub database URL changes, rerun configuration verification before any deployment. The Vercel ids/`updatedAt` bindings intentionally make old evidence stale.
8. Never print, persist, diff, hash in full, or compare plaintext connection strings. The workflow streams values between protected stores and emits only resource identity and a credential-free SHA-256 fingerprint.

The Environment currently contains a secret named `NEON_API_KEY`, but GitHub metadata cannot prove its value, validity, or Neon project scope. Treat provisioning/verification as incomplete until an authorized configuration-only run proves read access to the canonical project, branch, endpoint, and database.

The repository also contains an older repository-level `NEON_API_KEY`. Repository search finds no legitimate consumer outside jobs that declare `environment: staging`, where GitHub resolves the Environment-scoped secret of the same name. The broader repository secret is redundant and should be removed under a separate credential-cleanup authorization only after the Environment credential passes the protected preflight; do not rotate or delete it as part of this change.

Configuration-only run [`32530229689`](https://github.com/AudioJones-Dev/responseos/actions/runs/32530229689) proved the Environment Neon key could read the canonical project, branch, endpoint, and database; verified the pooled/direct GitHub pair; synchronized both Vercel Preview Sensitive variables; and stored a current revision-bound attestation. Final certification then stopped solely at `vercel link` with `User not found. (404)`. The remediation removes CLI user/link state from this lane: project and environment metadata use `GET /v9/projects/...`, `GET /v9/projects/.../domains`, and `GET /v10/projects/.../env`; only allowlisted encrypted/readable values use `GET /v1/projects/.../env/{id}`. Database values and private Clerk values are never requested from that endpoint.

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
2. Merge the reviewed Stage B/staging-hardening PR when separately authorized.
3. Actions → **Deploy Staging** → Run workflow.
4. Confirmation input: type exactly `staging`.
5. Approve the Environment gate when prompted.
6. On success: record the unique protected Preview URL. Alias/promotion remains a separate operator action and is not part of the first retry.
7. Confirm the automated database-identity, health/build-identity, public-demo, and anonymous protected-route smoke checks passed.
8. Run tenant bootstrap smoke (§4).

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
- Behavior: exact control SHA → protected Vercel posture → REST-derived readable Preview posture → canonical Neon control-plane evidence → GitHub database source verification → Preview Sensitive-variable synchronization → non-secret attestation → REST-derived final mock-only validator
- Explicit non-goals: no migration, deploy, alias, production target, provider activation, phone routing, or prospect exposure

Deployment gate:

- Workflow file: [`.github/workflows/deploy-staging.yml`](../../.github/workflows/deploy-staging.yml)
- Trigger: **manual** `workflow_dispatch` only
- Guard: confirmation string must equal `staging`
- Environment: `staging` (approval gate)
- Behavior: control/source dual checkout → exact project/Node/protection/bypass identity → explicit-token `vercel link` + `pull` → Vercel database-revision attestation + live canonical Neon identity preflight → mock-only Preview preflight → `prisma migrate deploy` → Vercel-hosted Preview build/deploy → bypass-header build-identity/auth smoke
- Explicit non-goals: no `on: push` to `master`; no production target; no live provider cutover

The Vercel-hosted build is deliberate: Preview database and Clerk server values are marked Sensitive and cannot be downloaded for a local prebuilt build. Vercel consumes them inside its protected build/runtime boundary while GitHub retains only the migration database URLs and deploy credentials.

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
