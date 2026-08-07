# Deployment

> **Hard rule:** do NOT deploy production from this repo yet. No Vercel production deploy, no AWS deploy — production deploys are gated to explicit v0.3 readiness approval. This document captures the **target** deployment posture so we can move fast when v0.3 unlocks.
>
> **Current state.** GitHub remote is live (`audiojones-dev/responseos`) and CI runs on every push and PR — `validate` (lint + typecheck + unit test + build) and `integration` (Postgres 16 service container, `prisma migrate diff`, `prisma migrate deploy`, `prisma db seed`, integration tests, DB-backed build). No deploy jobs yet.

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

Current GitHub Actions run validation only; there are no deploy jobs yet. The target deployment pipeline uses GitHub Actions with **OIDC federation to AWS** so the deploy pipeline never needs long-lived cloud secrets. n8n workflow definitions live in Git — n8n source-control mode is downstream of Git, not the source of truth.

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
- `preview` — future per-PR preview target once deploy jobs are approved.
- `staging` — future shared preprod against staging Telnyx/Vapi/Twilio/HubSpot/Calendly accounts (Path A host first; live providers one-at-a-time per founding-pilot staged auths).
- `prod` — future Standard / Privacy-hardened production after v0.3 readiness approval ([`product/responseos-v0.3-founding-pilot-scope.md`](./product/responseos-v0.3-founding-pilot-scope.md)).
- `prod-hipaa` — future HIPAA-ready production, isolated VPC + database + eligible provider accounts after independent review.

## Multi-tenant deployment model

Internal AJ instance is a single multi-tenant control plane. The white-label client-facing version reuses the same APIs and worker fleet but varies at domain, branding, RBAC, templates, and connector level. Small tenants share the cluster with strict tenant scoping; larger or regulated tenants get their own database and optionally their own VPC/app stack.
