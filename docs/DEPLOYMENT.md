# Deployment

> **Hard rule:** do NOT deploy production from this repo yet. No Vercel production deploy, no AWS deploy — production deploys are gated to explicit v0.3 readiness approval. This document captures the **target** deployment posture so we can move fast when v0.3 unlocks.
>
> **Current state.** GitHub remote is live (`audiojones-dev/responseos`) and CI runs on every push and PR — `validate` (lint + typecheck + unit test + build) and `integration` (Postgres 16 service container, `prisma migrate diff`, `prisma migrate deploy`, `prisma db seed`, integration tests, DB-backed build). **Staging-only** deploy scaffolding exists as a manual `workflow_dispatch` job (GitHub Environment `staging` + human approval). Automatic production deploy from `master` remains disabled (`vercel.json`). Operator steps: [`ops/RESPONSEOS_STAGING_HOSTING_RUNBOOK.md`](./ops/RESPONSEOS_STAGING_HOSTING_RUNBOOK.md); evidence gates: [`ops/RESPONSEOS_V0_3_READINESS_GATES.md`](./ops/RESPONSEOS_V0_3_READINESS_GATES.md).

## Three deployment lanes

ResponseOS supports three compliance lanes selectable per tenant. Standard mode is the default; the others are upgrade paths.

### Standard mode (default target)

**Target stack:** Vercel + Neon Postgres + Clerk + Cloudflare R2, with live communications/billing providers gated to v0.3 authorization.

- Frontend + Route Handlers target Vercel.
- Database target is Neon Postgres per ADR-0026; local dev and CI continue on plain Postgres 16.
- Auth target is Clerk per ADR-0005.
- Object storage target is Cloudflare R2 (call recordings, quote photos, exports).
- v0.3 communications planning baseline is Telnyx primary carrier, Twilio failover, Vapi primary orchestration, Retell secondary, HubSpot CRM sync, and Calendly scheduling per ADR-0031/0032/0033/0036/0037.
- Custom-domain wildcard pattern (`*.responseos.app`) remains a future white-label target.

Use for non-medical, non-PHI home services. This is the fastest path to market.

### Privacy-hardened mode

Same infrastructure family as Standard, with stricter retention, redaction, and visibility controls:

- Post-call PII scrubbing (Retell categories) applied before transcript persistence.
- `call_transcripts.pii_redacted = true`; raw transcripts hidden from client-facing roles by default.
- Short retention on `Call.recording_url` (30/60/90-day options per tenant).

### HIPAA-ready mode (future)

> **Important:** ResponseOS is **not** HIPAA-certified or HIPAA-compliant today. v0.1 ships in Standard mode only. The HIPAA-ready lane is a future architectural pattern, not a current product capability. Do not represent the platform as HIPAA-compliant in marketing, sales, contracts, or onboarding until a deployment in this lane has been independently reviewed and the full vendor BAA chain has been signed and verified for that tenant.

**Target stack:** AWS-hosted, no Vercel, no shared Standard-lane database.

- **Frontend:** CloudFront + Route 53 + ACM certs.
- **API/workers:** ECS/Fargate behind ALB.
- **Database:** RDS for PostgreSQL (or Aurora) with KMS-encrypted volumes.
- **Object storage:** S3 with KMS, versioning, lifecycle policies.
- **Secrets:** AWS Secrets Manager, automatic rotation.
- **Telephony:** Twilio in a HIPAA-eligible account (BAA in force).
- **Voice:** Retell with BAA executed; private/on-prem deployment if required.
- **Vendor allowlist** enforced per compliance tier — no non-BAA TTS/STT in this lane.

## Infrastructure as code

Future-target Terraform layout (per deep research report):

```
infra/
  terraform/
    modules/        ← reusable network, db, ecs, secrets modules
    envs/
      dev/
      staging/
      prod/         ← Standard / Privacy-hardened
      prod-hipaa/   ← HIPAA-ready lane
```

State lives in S3 with state locking + versioning per AWS prescriptive guidance. No hand-edits to console; everything ships through Terraform plan/apply via CI.

## CI/CD Target

**Today (Path A prep):**

| Workflow | Trigger | Gate |
|---|---|---|
| `.github/workflows/ci.yml` | push + PR | `validate` + `integration` (required) |
| `.github/workflows/deploy-staging.yml` | **manual** `workflow_dispatch` only | confirmation input `staging` + GitHub Environment **`staging`** (required reviewers) |
| Production deploy | **none** | Forbidden until founding-pilot readiness + human prod approval |

`vercel.json` sets `git.deploymentEnabled: false` so Vercel does not automatically create deployments for Git pushes or pull requests. Separately authorized explicit deployment workflows remain available.

**Future target** (post–Stage I): GitHub Actions with **OIDC federation to AWS** for HIPAA-lane primitives so the deploy pipeline never needs long-lived cloud secrets. n8n workflow definitions live in Git — n8n source-control mode is downstream of Git, not the source of truth.

Pipeline gates:
| Stage | Gate |
|---|---|
| Lint + type-check | required |
| Unit tests | required |
| Contract tests against connector mocks | required |
| DB migration validation | required |
| Staging deploy (Path A) | manual + Environment approval |
| Playwright/Cypress e2e on preview env | required |
| Load test on webhook + quote endpoints | staging only |
| Security scan + dependency audit | required |
| Terraform plan | staging/prod required |
| Manual approval | staging (now); prod and prod-hipaa (later) |
| Blue/green or canary deploy | prod and prod-hipaa |

## Observability

- **OpenTelemetry** as the standard — unified traces, metrics, logs across services.
- **Sentry** for release health and source-mapped stack traces in the portal/admin apps.
- **Cloud-native metrics** (CloudWatch in HIPAA lane, Vercel Analytics in Standard) page on webhook failures, queue backlogs, booking errors.
- **Provider alerting webhooks** (Vapi primary; Retell secondary) wired to ops Slack for call-quality incidents.

## SLOs (v0.3 targets)

| SLO | Target |
|---|---|
| Signed webhook validation success | >99.9% |
| Missed-call text-back latency | <60s |
| Inbound call handoff to agent | <3s avg |
| Calendar-slot response latency | <1.5s p95 |
| Booking success after slot selection | >98% |
| Weekly report generation completion | >99% |

## Rollback plan

- Revert prompt version to last known good.
- Disable self-schedule for the affected tenant.
- Route inbound calls to human backup (transfer rule).
- Replay event ledger into corrected state.
- Publish incident timeline in admin portal.

## Environments

- `dev` — local development plus CI validation.
- `preview` — Vercel preview deployments (connected branches); may host Path A while a stable staging alias is set.
- `staging` — shared preprod for Path A (Clerk + Neon + portal smoke; providers mock). Operator checklist + tenant bootstrap: [`ops/RESPONSEOS_STAGING_HOSTING_RUNBOOK.md`](./ops/RESPONSEOS_STAGING_HOSTING_RUNBOOK.md). Live providers arrive **one at a time** per the staged authorizations in [`product/responseos-v0.3-founding-pilot-scope.md`](./product/responseos-v0.3-founding-pilot-scope.md) §5 — Telnyx and Vapi first. HubSpot, Calendly, and Twilio failover are **deferred-live** per §1.1 and are not Demo-MVP dependencies.
- `prod` — Standard / Privacy-hardened production **after** v0.3 readiness approval ([`product/responseos-v0.3-founding-pilot-scope.md`](./product/responseos-v0.3-founding-pilot-scope.md) §4). Not enabled from this repo yet.
- `prod-hipaa` — future HIPAA-ready production, isolated VPC + database + eligible provider accounts after independent review.

### Staging env vars (Path A — placeholders)

Required on the staging host (see [`env-spec.md`](./env-spec.md); never commit real values):

`DATABASE_URL`, `DIRECT_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`, `AJ_DIGITAL_CLERK_ORG_ID`, `NEXT_PUBLIC_APP_URL`, `RESPONSEOS_REQUIRE_AUTH`, optional `RESPONSEOS_PROVIDER_KEY`.

Never set `RESPONSEOS_DEV_SESSION` on hosted staging/prod.

## Multi-tenant deployment model

Internal AJ instance is a single multi-tenant control plane. The white-label client-facing version reuses the same APIs and worker fleet but varies at domain, branding, RBAC, templates, and connector level. Small tenants share the cluster with strict tenant scoping; larger or regulated tenants get their own database and optionally their own VPC/app stack.
