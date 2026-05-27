# Deployment

> **v0.2 hard rule:** do NOT deploy from this repo. No Vercel deploy, no AWS deploy — production deploys are gated to v0.3 readiness. This document captures the **target** deployment posture so we can move fast when v0.3 unlocks.
>
> **Current state.** GitHub remote is live (`audiojones-dev/responseos`) and CI runs on every push and PR — `validate` (lint + typecheck + unit test + build) and `integration` (Postgres 16 service container, `prisma migrate diff`, `prisma migrate deploy`, `prisma db seed`, integration tests, DB-backed build). No deploy jobs yet.

## Three deployment lanes

ResponseOS supports three compliance lanes selectable per tenant. Standard mode is the default; the others are upgrade paths.

### Standard mode (default — v0.1/v0.2)

**Stack:** Vercel + Supabase (Postgres + Auth + Storage) + Twilio + Retell + Stripe.

- Frontend + Route Handlers on Vercel.
- Database + auth on Supabase.
- Object storage: Cloudflare R2 (call recordings, quote photos).
- Custom-domain wildcard pattern (`*.responseos.app`) for white-label tenants.

Use for non-medical, non-PHI home services. This is the fastest path to market.

### Privacy-hardened mode

Same infrastructure as Standard, with:
- Retell `Basic Attributes Only` storage mode.
- Post-call PII scrubbing (Retell categories) applied before transcript persistence.
- `call_transcripts.pii_redacted = true`; raw transcripts hidden from client-facing roles by default.
- Short retention on `Call.recording_url` (30/60/90-day options per tenant).

### HIPAA-ready mode (v0.3+, future)

> **Important:** ResponseOS is **not** HIPAA-certified or HIPAA-compliant today. v0.1 ships in Standard mode only. The HIPAA-ready lane is a future architectural pattern, not a current product capability. Do not represent the platform as HIPAA-compliant in marketing, sales, contracts, or onboarding until a deployment in this lane has been independently reviewed and the full vendor BAA chain has been signed and verified for that tenant.

**Stack:** AWS-hosted, no Vercel/Supabase.

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

## CI/CD

GitHub Actions with **OIDC federation to AWS** so the deploy pipeline never needs long-lived cloud secrets. n8n workflow definitions live in Git — n8n source-control mode is downstream of Git, not the source of truth.

Pipeline gates:
| Stage | Gate |
|---|---|
| Lint + type-check | required |
| Unit tests | required |
| Contract tests against connector mocks | required |
| DB migration validation | required |
| Playwright/Cypress e2e on preview env | required |
| Load test on webhook + quote endpoints | staging only |
| Security scan + dependency audit | required |
| Terraform plan | staging/prod required |
| Manual approval | prod and prod-hipaa |
| Blue/green or canary deploy | prod and prod-hipaa |

## Observability

- **OpenTelemetry** as the standard — unified traces, metrics, logs across services.
- **Sentry** for release health and source-mapped stack traces in the portal/admin apps.
- **Cloud-native metrics** (CloudWatch in HIPAA lane, Vercel Analytics in Standard) page on webhook failures, queue backlogs, booking errors.
- **Retell alerting webhooks** wired to ops Slack for call-quality incidents.

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

- `dev` — local + preview deploys per PR.
- `staging` — shared preprod against staging Twilio/Retell sub-accounts.
- `prod` — Standard / Privacy-hardened production.
- `prod-hipaa` — HIPAA-ready production, isolated VPC + db + Twilio HIPAA account.

## Multi-tenant deployment model

Internal AJ instance is a single multi-tenant control plane. The white-label client-facing version reuses the same APIs and worker fleet but varies at domain, branding, RBAC, templates, and connector level. Small tenants share the cluster with strict tenant scoping; larger or regulated tenants get their own database and optionally their own VPC/app stack.
