# ResponseOS — Deployment Plan

**Owner:** AJ Digital LLC / Audio Jones
**Status:** Canonical (go-forward). Extends [`../DEPLOYMENT.md`](../DEPLOYMENT.md) (three lanes, IaC, CI/CD, SLOs, rollback) with the go-forward topology: the **voice gateway as a second deployable**, Redis, and the Grok/OpenAI providers.
**Anchored by:** ADR-0001 (no deploy until v0.3) · ADR-0013 (gateway) · ADR-0014 (Redis) · ADR-0004 (lanes)

> **Hard rule (unchanged):** do **not** deploy from this repo until v0.3 readiness gates clear. This document is the **target** posture so we can move fast when v0.3 unlocks. Current state: GitHub remote live (`audiojones-dev/responseos`); CI runs `validate` + `integration` on every push/PR; **no deploy jobs yet**.

---

## 1. Services to deploy (go-forward)

| Service | Runtime | Scales on | Notes |
|---|---|---|---|
| **Next.js app** | App Router (console + portal + marketing + API + webhooks) | request load | existing |
| **Voice gateway** | Node.js service | concurrent calls | **new at v0.3** (ADR-0013); separate deployable |
| **Async workers** | Node.js workers + n8n | queue depth | n8n out of the audio loop (ADR-0017) |
| Postgres | managed | data | event ledger = recoverable truth |
| Redis | managed | sessions/queue | ephemeral (ADR-0014) |
| Object storage | R2 (Standard) / S3+KMS (HIPAA) | — | tenant-prefixed keys |

```mermaid
flowchart TB
  subgraph Deploy[Standard lane target topology]
    APP[Next.js app]
    GW[Voice gateway]
    WRK[Async workers + n8n]
    PG[(Postgres)]
    RS[(Redis)]
    OBJ[(Object storage R2)]
  end
  APP --- PG
  GW --- PG
  GW --- RS
  WRK --- PG
  WRK --- RS
  APP --- OBJ
  GW --- OBJ
```

---

## 2. Three compliance lanes (per tenant, ADR-0004)

| Lane | Stack | Voice providers |
|---|---|---|
| **Standard** (default, MVP) | App + gateway + Postgres + Redis + R2 (Vercel/managed) | Grok (primary) / OpenAI (fallback) |
| **Privacy-hardened** | Same + PII scrubbing + short retention + raw-transcript hiding | Permitted with scrubbing; review per provider |
| **HIPAA-ready** (pattern only) | AWS-hosted (CloudFront + Route 53 + ECS/Fargate + RDS + S3 + KMS + Secrets Manager) | **Blocked** until provider BAA/retention verified (ADR-0012) |

The gateway deploys per lane alongside the app; on the HIPAA lane it runs on AWS primitives with BAA-eligible services only.

---

## 3. Environments

| Env | Purpose | Providers |
|---|---|---|
| `dev` | local + preview per PR | mock adapters (zero keys) |
| `staging` | preprod; provider-readiness gate; golden calls | staging Twilio + verified Grok/OpenAI keys |
| `prod` | Standard / Privacy-hardened | live |
| `prod-hipaa` | HIPAA-ready (future) | per BAA; voice blocked until verified |

Mock-first everywhere keys are absent (ADR-0001).

---

## 4. CI/CD

Current CI (unchanged): `validate` + `integration`. Target deploy pipeline (v0.3+):

| Stage | Gate | Env |
|---|---|---|
| Lint + typecheck | required | all |
| Unit tests | required | all |
| Integration tests (Postgres) | required | all |
| Contract tests (gateway↔core, provider mocks) | required | all |
| DB migration validation (`prisma migrate diff/deploy`) | required | all |
| Golden-call regression | required before prompt/voice release | staging |
| Provider-readiness gate | required before live voice | staging |
| Security scan + dependency audit | required | all |
| E2E (Playwright/Cypress) | required (target) | preview/staging |
| Manual human approval | required | prod / prod-hipaa |
| Blue/green or canary | required | prod / prod-hipaa |

- **GitHub Actions with OIDC federation** to the cloud (no long-lived cloud secrets), per `../DEPLOYMENT.md`.
- n8n workflow definitions are versioned in Git (Git upstream of n8n).
- The voice gateway and the app deploy **independently** (separate pipelines), so one can roll back without the other.

---

## 5. Release process

1. Feature branch → draft PR → CI green → human approval → merge (Governance B1/B2).
2. Schema change = Prisma migration; applied via `prisma migrate deploy` in the pipeline.
3. Profile changes (prompt/policy/routing/workflow) are **data + versioned**, not deploys — they roll forward/back instantly via version.
4. Voice/provider release: golden-call pack + provider-readiness gate must pass.
5. Production deploy: manual approval + canary/blue-green; watch realtime + ingest SLOs post-deploy.
6. CHANGELOG line on merge.

---

## 6. SLOs (v0.3 targets)

| SLO | Target |
|---|---|
| Signed webhook validation success | > 99.9% |
| Missed-call text-back latency | < 60s |
| Inbound call → agent handoff | < 3s avg |
| Voice provider failover completes call | > 99% |
| Calendar-slot response latency | < 1.5s p95 |
| Booking success after slot selection | > 98% |
| Monthly report generation | > 99% |
| Client portal uptime | 99.5% |
| Voice gateway availability | target defined at gate (new service) |

---

## 7. Rollback (per `../SECURITY.md` + gateway)

Revert profile version → disable a tenant feature → fail over voice provider / route to human backup → roll back the offending **service** deploy (app or gateway independently) → replay the ledger into corrected state → publish incident timeline. Details: [`RESPONSEOS_RUNBOOK.md`](./RESPONSEOS_RUNBOOK.md) § 7.

---

## 8. Multi-tenant deployment model

One multi-tenant control plane; the white-label client-facing version reuses the same APIs + worker fleet + gateway, varying only at domain, branding, RBAC, templates, and connector level. Small tenants share the cluster with strict scoping; larger/regulated tenants get their own DB and optionally VPC/app stack (inherited from `../DEPLOYMENT.md`). **No deploy-per-customer; no repo-per-customer.**

---

## 9. Infrastructure as code

Future-target Terraform layout (per `../DEPLOYMENT.md`): `infra/terraform/{modules,envs/{dev,staging,prod,prod-hipaa}}`, state in S3 with locking + versioning, everything via plan/apply in CI (no console hand-edits). The voice gateway gets its own module (service + autoscaling on concurrency + Redis).

---

## 10. Pre-deploy checklist (v0.3 go-live)

- [ ] Provider-readiness gate passed (Grok + OpenAI).
- [ ] Golden-call regression green.
- [ ] Tenant-isolation + signature-validation tests green.
- [ ] Secrets in the secret store (none in repo); tenant creds DB-encrypted.
- [ ] Rollback paths verified (profile + both service deploys + ledger replay).
- [ ] Observability + alerting wired (PostHog/Sentry/Better Stack), tagged `account_id`.
- [ ] Standard lane only; regulated lanes deferred; voice blocked on HIPAA lane.
- [ ] Human approval recorded.

---

## 11. Assumptions & open questions

**Assumptions:** the gateway can run on the Standard-lane host platform; managed Redis/Postgres available per lane; OIDC federation usable for deploys.
**Open questions:** (1) gateway hosting target (co-located vs separate container platform); (2) canary strategy for a realtime service (call-draining on deploy); (3) RTO/RPO targets per lane.

---

*ResponseOS Deployment Plan — AJ Digital LLC / Audio Jones. Documentation phase only. No production deploys until v0.3 gates clear.*
