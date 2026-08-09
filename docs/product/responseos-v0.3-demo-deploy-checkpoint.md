# ResponseOS v0.3 Mock-First Demo Deploy Checkpoint

**Status:** Operator checkpoint after deployment-readiness review. This document selects the recommended next path: **mock-first demo deployment readiness**, not live production traffic.
**Date:** 2026-07-04
**Related:** [`ROADMAP.md`](../ROADMAP.md), [`responseos-v0.3-authorization-brief.md`](./responseos-v0.3-authorization-brief.md), [`responseos-v0.3-provider-readiness.md`](./responseos-v0.3-provider-readiness.md), GitHub issue #27.

## 1. Review / Diagnosis

Facts verified in the local review:

- v0.2 closeout is shipped in the repo docs and codebase: Postgres schema, deterministic seed, tenant-aware data access, Clerk session derivation and route protection, expanded v0.2 substrate models, and mock-safe marketing/demo surfaces are present.
- Local `npm run lint`, `npm run typecheck`, `npm run build`, and `npm audit --omit=dev` passed.
- `npm test` hit two default 5-second timeout failures, but the timed-out files passed when rerun with a longer Vitest timeout. This is a release-hygiene issue, not proof of broken assertions.
- `npm run test:integration` and `npx prisma validate` require `DATABASE_URL` and `DIRECT_URL`; they were not fully runnable from the reviewed shell.
- Only the Clerk webhook currently verifies signatures before mutation. Twilio, Vapi, Retell, Stripe, GHL, and n8n webhook routes remain mock acknowledgements with TODO signature verification.
- Live provider integrations, production secrets, and production deploys remain gated by ADR-0001, ADR-0019, and the repo agent contract.

Inference:

- The repo is suitable to advance toward a **mock-first demo deployment**.
- The repo is not suitable for **real live traffic** until v0.3 provider, signature, environment, observability, rollback, and tenant-safety gates are complete.

## 2. Decision

Proceed with the **mock-first demo deploy path** as the next controlled milestone.

This decision means:

- The deploy target is a safe, non-production-like public demo/preview experience backed by mock data.
- No real Telnyx, Twilio, Vapi, Retell, HubSpot, GHL, Stripe, n8n, Calendly, OpenAI, or CRM traffic is authorized.
- No live provider secrets, account setup, billing, SMS, phone calls, CRM sync, or production customer data are authorized.
- The goal is to prove deployment mechanics, route behavior, auth boundary behavior, public demo UX, and release operations before live integrations.

## 3. Minimum PRD

### Problem

ResponseOS has a substantial v0.2 foundation, but deployment status is blocked by unclear v0.3 scope and by live-provider gates that should not be collapsed into a first deploy.

### Desired Outcome

A controlled mock-first demo deployment readiness package that can be reviewed, validated, and later deployed without opening live-provider or production-data risk.

### Success Criteria

- v0.3 demo scope is explicit and bounded.
- Demo routes and marketing routes build and run from mock data with no secrets.
- Protected admin/client surfaces do not expose real tenant data.
- Webhooks remain mock-only or fail closed where configured.
- Required validation commands are documented and passing in the correct environment.
- No production deploy is performed without a separate explicit approval.

### Scope

In scope:

- Mock-first demo deployment readiness checklist.
- Validation runbook for local, CI, and preview.
- Demo route smoke test plan.
- Dashboard progress update for v0.3 scope planning.
- Issue #27 comment or follow-up PR description that records the selected path.

### Out of Scope

- Live provider integrations.
- Provider credentials or secret values.
- Production deployment.
- Webhook business mutations.
- Stripe billing.
- HIPAA-ready lane implementation.
- v0.4 knowledge/RAG/vector work.

### Constraints

- No Firebase.
- No real secrets in the repo.
- No production deploy from this repo until v0.3 readiness gates clear.
- Provider adapters must keep mock fallback.
- Tenant isolation remains non-negotiable.
- Webhook signature validation must precede any business mutation.

### Existing Assets / Prior Work To Inspect

- `docs/ROADMAP.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`
- `docs/product/responseos-v0.3-authorization-brief.md`
- `docs/product/responseos-v0.3-provider-readiness.md`
- `dashboard/dashboard-data.json`
- `.github/workflows/ci.yml`

### Proposed Plan

1. Sync branch to current `origin/master`.
2. Record this mock-first demo deploy checkpoint.
3. Update the dashboard so v0.3 scope selection and acceptance-gate documentation reflect current progress.
4. Run non-DB local gates: lint, typecheck, unit test with stabilized timeout if needed, build, audit.
5. Run DB-backed gates in a shell with `DATABASE_URL` and `DIRECT_URL`, or rely on CI if the branch PR runs the integration workflow.
6. After review, use a separate approval to execute any actual preview/demo deployment.

### Risks

- A public mock demo can be mistaken for live production if copy is not explicit.
- Current non-Clerk fallback defaults to an AJ admin mock session when Clerk is absent; this is acceptable for local/mock but not for a live authenticated production surface.
- Webhook routes are public and mostly mock-ack only; they must not mutate business data before signature validation lands.
- Local Node/runtime differences can create test timeouts that CI on Node 20 may not reproduce.

### Open Questions

- Will the first deploy target be Vercel preview under a non-customer domain, or another demo host?
- Should protected admin/client surfaces be disabled, Clerk-gated, or hidden for the public mock demo?
- Should `/api/webhooks/*` return fail-closed for the demo deploy except Clerk, or remain mock acknowledgements?
- What exact domain/copy should identify the experience as a mock demo?

## 4. Required Gates Before Any Demo Deploy

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:integration` with Postgres 16, `DATABASE_URL`, and `DIRECT_URL`
- Verify no real secrets in Git or logs.
- Verify `RESPONSEOS_DEV_SESSION` is not set in any deployed production-like environment.
- Verify demo copy says mock/demo where needed.
- Verify no route performs live provider calls.

## 5. Neon Demo Branch

Created on 2026-07-04 for mock-first demo validation:

- Neon project: `responseos`
- Neon project ID: `quiet-band-27365020`
- Branch name: `demo`
- Branch ID: `br-polished-waterfall-aq2q98bf`
- Endpoint ID: `ep-odd-mode-aqcdbajt`
- Database: `neondb`
- Role: `neondb_owner`
- Doppler config holding connection URLs: `response-os/stg_staging_demo`

Stored in Doppler without printing values:

- `DATABASE_URL` — pooled Neon connection URI
- `DIRECT_URL` — direct Neon connection URI for Prisma migrations
- `NEON_PROJECT_ID`
- `NEON_BRANCH_ID`
- `NEON_ENDPOINT_ID`

Provisioning completed:

- `doppler run --project response-os --config stg_staging_demo -- npx prisma validate`
- `doppler run --project response-os --config stg_staging_demo -- npx prisma migrate deploy`
- `doppler run --project response-os --config stg_staging_demo -- npx prisma db seed`
- `doppler run --project response-os --config stg_staging_demo -- npm run build`

## 6. Required Gates Before Live Production Traffic

These are explicitly **not** satisfied by the mock-first demo path:

- v0.3 scope approved beyond demo.
- CAL/provider interface and adapters implemented behind mocks first.
- Telnyx/Twilio/Vapi/Retell/HubSpot/Stripe/n8n signatures verified before mutation.
- Provider account ownership, A2P registration, and failover tested.
- Secrets injected through approved runtime storage only.
- Observability, alerts, kill switch, rollback, and incident process ready.
- Tenant isolation extended and tested for every new write path.
- Compliance lane and vendor allowlist decided per tenant.

## 7. Vercel Demo Project Checkpoint

Provisioned on 2026-07-04 for the mock-first demo path:

- Vercel team: `audiojones`
- Vercel project: `responseos`
- Project ID: `prj_yfk70Hr49dG7IwIPg4EiymB6elEk`
- Framework preset: Next.js
- Node.js version: `22.x`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `.next`
- Demo domain attached in Vercel: `responseos.ajdigital.app`
- Cloudflare DNS record created:
  - `A responseos.ajdigital.app 76.76.21.21`
  - Proxied: `false`
  - TTL: automatic
  - Cloudflare record ID: `fb8a09edffd27dce4e7e8f791e5db379`
- Runtime envs added to Vercel Production without printing values:
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `NEXT_PUBLIC_APP_URL=https://responseos.ajdigital.app`
- Runtime envs added to Vercel Preview without printing values:
  - `DATABASE_URL`
  - `DIRECT_URL`

Verified:

- `responseos.ajdigital.app` resolves to `76.76.21.21`.
- Vercel no longer reports the domain as missing the required A record.

Pending before Git-based preview branch envs and automatic deployments:

- Resolved after this checkpoint was first written: the Vercel project connected to GitHub repo `AudioJones-Dev/responseos`.
- Vercel automatically deployed commit `4578cd91a56be792f83b7ca9d5a6cc49d9c1db49` from branch `codex/v0-3-demo-deploy-checkpoint`.
- Vercel classified that deployment as `production` and assigned:
  - `https://responseos.ajdigital.app`
  - `https://responseos.vercel.app`
  - `https://responseos-git-codex-v0-3-demo-deploy-checkpoint-audiojones.vercel.app`
- This was an automatic Git/Vercel promotion, not a manual `vercel --prod` command.

Operator decision after the automatic deployment: keep the public site live as a mock-first demo while hardening the demo surface and scoping the v0.3 live-call demo slice separately.
