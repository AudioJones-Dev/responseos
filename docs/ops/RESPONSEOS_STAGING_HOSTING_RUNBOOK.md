# ResponseOS — Staging Hosting Runbook (Path A)

**Owner:** Audio (AJ Digital LLC) · **Status:** Operator runbook (Phase 2 prep)  
**Scope:** Hosted **staging only** — Neon + Clerk + Vercel client access while providers remain **mock**.  
**Does not authorize:** live Telnyx/Vapi/Twilio/HubSpot/Calendly, production deploy, or pilot go-live.  
**Canon:** [`../product/responseos-v0.3-founding-pilot-scope.md`](../product/responseos-v0.3-founding-pilot-scope.md) Stage **C**, [`../env-spec.md`](../env-spec.md), [`../DEPLOYMENT.md`](../DEPLOYMENT.md), ADR-0001 / ADR-0019.

---

## 0. What “done” means for Path A

| Gate | Done when |
|---|---|
| Staging URL | HTTPS URL you can open (Vercel staging alias or preview URL aliased) |
| Auth | Real Clerk login (no `RESPONSEOS_DEV_SESSION`) |
| Tenant | Clerk org → `Account.clerk_org_id` → membership → portal session with `accountId` |
| Data | Neon staging DB migrated; seed optional for demo fixtures |
| Providers | Still mock (no telephony/CRM/scheduling secrets required) |
| Prod | **Still off** — `vercel.json` keeps `master` auto-deploy disabled; no prod GH job |

Until the staging URL is live with Clerk login, dashboard **L-02** stays partial / In Progress — not Done.

---

## 1. Credential / platform audit (names only — no secrets)

Snapshot from Phase 2 prep (operator may re-run):

| Surface | Observed | Gap for Path A staging |
|---|---|---|
| **GitHub Environments** | `Preview`, `Production`, `github-pages`, `copilot` | **Create `staging`** with required reviewers (human approval). Do not wire auto-prod. |
| **GitHub Actions secrets (repo)** | `NEON_API_KEY`, `NOTION_TOKEN` present | Add staging deploy secrets below (prefer **Environment `staging`** scope, not repo-wide). |
| **Vercel** | Project `audiojones/responseos` exists (`responseos.vercel.app`); CLI user can link; `vercel.json` disables auto-deploy from `master` | Confirm Preview/Production env vars; create staging alias hostname; set Node **24.x** to match `package.json` engines (`24.18.0`). Production auto-deploy must stay off. |
| **Neon** | Repo has `NEON_API_KEY` (API access possible) | Create **staging** project or branch DB; copy pooled + direct URLs into GH/Vercel (never into git). |
| **Clerk** | App code ready (`lib/auth/session.ts`, `clerk-sync.ts`, webhook) | Staging Clerk application (or staging instance) + org + webhook to staging URL. |
| **Sentry / PostHog** | Env placeholders in `.env.example`; **no SDK packages wired** | Optional for Path A: create projects, set DSNs later; tagging contract documented in §6. |
| **Live providers** | Forbidden until Stage D+ | Leave Telnyx/Vapi/etc. unset → mock fallback. |

---

## 2. Staging env checklist (placeholders only)

Copy from [`.env.example`](../../.env.example) / [`../env-spec.md`](../env-spec.md). Set values in **Vercel project → Environment (Preview or a dedicated Staging)** and mirror migration URLs into **GitHub Environment `staging` secrets**. Never commit real values.

### Required for Path A portal smoke

| Variable | Where | Notes |
|---|---|---|
| `DATABASE_URL` | Vercel + `STAGING_DATABASE_URL` (GH) | Neon **pooled** connection string |
| `DIRECT_URL` | Vercel + `STAGING_DIRECT_URL` (GH) | Neon **direct** (migrations) |
| `CLERK_SECRET_KEY` | Vercel only | Staging Clerk secret |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Vercel only | Staging publishable key |
| `CLERK_WEBHOOK_SECRET` | Vercel only | Svix secret for `/api/webhooks/clerk` |
| `AJ_DIGITAL_CLERK_ORG_ID` | Vercel only | Control-plane Clerk org id (`Session.account = null`) |
| `NEXT_PUBLIC_APP_URL` | Vercel only | Public staging base URL (e.g. `https://staging.example`) |
| `RESPONSEOS_REQUIRE_AUTH` | Vercel only | Set (`1` or `true`) on hosted staging so auth cannot fail-open (ADR-0039) |
| `RESPONSEOS_PROVIDER_KEY` | Vercel only | Optional for Path A mock; base64 32-byte AES if encrypting stored creds later |

### Must NOT be set on staging/prod

| Variable | Why |
|---|---|
| `RESPONSEOS_DEV_SESSION` | Hard-fails under `NODE_ENV=production` |

### Deploy job secrets (GitHub Environment `staging`)

| Secret | Purpose |
|---|---|
| `VERCEL_TOKEN` | Vercel deploy token (team-scoped, least privilege) |
| `VERCEL_ORG_ID` | Team id (from `.vercel/project.json` after `vercel link`) |
| `VERCEL_PROJECT_ID` | Project id |
| `STAGING_DATABASE_URL` | Neon pooled URL for `prisma migrate deploy` |
| `STAGING_DIRECT_URL` | Neon direct URL for migrations |

### Optional observability (Path A+)

| Variable | Purpose |
|---|---|
| `SENTRY_DSN` | Error tracking (wire SDK only after DSN exists) |
| `POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_KEY` | Product analytics |

### Explicitly out of Path A

Telephony / voice / CRM / calendar / Stripe / R2 keys — leave blank; adapters stay mock (ADR-0001).

---

## 3. Operator provision sequence

Do these in order. Stop if any step needs a credential you do not have — do not invent secrets in the repo.

### 3.1 Neon staging database

1. In Neon console: create a **staging** project (or a `staging` branch of the ResponseOS project).
2. Copy **pooled** → `DATABASE_URL` / `STAGING_DATABASE_URL`.
3. Copy **direct** → `DIRECT_URL` / `STAGING_DIRECT_URL`.
4. Do not reuse a production database for staging.

### 3.2 Clerk staging application

1. Create or select a **development/staging** Clerk application (prefer separate from future prod).
2. Enable Organizations.
3. Note `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
4. Create the AJ Digital **control** organization → copy its id to `AJ_DIGITAL_CLERK_ORG_ID`.
5. After the staging URL exists: add webhook endpoint  
   `https://<STAGING_HOST>/api/webhooks/clerk`  
   for `organization.*`, `organizationMembership.*`, `user.*` (as implemented by `lib/auth/clerk-sync.ts`). Copy signing secret → `CLERK_WEBHOOK_SECRET`.
6. Set allowed origins / redirect URLs to the staging host.

### 3.3 Vercel staging surface

1. Confirm project `responseos` under the AudioJones Vercel team.
2. Keep **Production auto-deploy from `master` disabled** (`vercel.json` → `git.deploymentEnabled.master: false`).
3. Set Path A env vars for Preview (or Staging) — placeholders never in git.
4. Prefer a stable alias (e.g. `responseos-staging.vercel.app` or custom domain) after the first successful deploy.
5. Align Node version to **24.x** (`24.18.0` in CI/`package.json`).

### 3.4 GitHub Environment protection

1. Repo → Settings → Environments → **New environment: `staging`**.
2. Enable **Required reviewers** (Audio or designated operator).
3. Optional: deployment branch policy limiting to `master` + release tags (never open to arbitrary forks).
4. Add the deploy secrets from §2 (environment-scoped).
5. Do **not** add an automatic production deploy workflow. `Production` environment may exist historically — leave it unused until Stage I authorization.

### 3.5 First staging deploy

1. Merge this prep PR (and preferably Phase 0/1 PRs #109 / #108) to `master` when ready.
2. Actions → **Deploy Staging** → Run workflow.
3. Confirmation input: type exactly `staging`.
4. Approve the Environment gate when prompted.
5. On success: note the deployment URL; alias it if needed; set `NEXT_PUBLIC_APP_URL` to that host; re-deploy if the URL changed.
6. Run tenant bootstrap smoke (§4).

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

- Workflow file: [`.github/workflows/deploy-staging.yml`](../../.github/workflows/deploy-staging.yml)
- Trigger: **manual** `workflow_dispatch` only
- Guard: confirmation string must equal `staging`
- Environment: `staging` (approval gate)
- Behavior: `prisma migrate deploy` → `vercel pull` (preview metadata) → `vercel build` → `vercel deploy --prebuilt`
- Explicit non-goals: no `on: push` to `master`; no production target; no live provider cutover

Rollback: redeploy previous Vercel deployment from the Vercel UI, or re-run the workflow on a known-good SHA. App continues to boot with mock providers if provider secrets are absent.

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

Staging host cutover still needs **written Stage C** authorization per founding-pilot scope §5–§6. This runbook is reversible prep only.

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
