# ResponseOS Performance

**Status:** Draft quality baseline. Pending Audio approval.
**Scope:** Performance expectations for ResponseOS app, API, webhook, reporting, and future v0.3 live-provider surfaces.

## Purpose

This document defines the performance targets that future implementation and release work should validate against. It does not authorize production deploys or live provider integrations.

## Current Performance Posture

Current code is mock-first and CI-backed. Local and CI validation cover build correctness and DB-backed integration behavior, not production load or live-provider latency.

Current validation sources:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:integration`
- GitHub Actions `validate` and `integration`

Production performance targets remain v0.3-gated.

## Core Targets

| Surface | Target | Applies When | Evidence |
|---|---:|---|---|
| Web app build | Build completes without type/lint/test failures | Every PR | CI `validate` |
| DB-backed app build | Build succeeds after migration + seed | Every PR | CI `integration` |
| API p95 latency | < 500 ms for DB-backed reads | Pre-production and later | Load test / traces |
| Health endpoint | < 100 ms p95 | Pre-production and later | Synthetic check |
| Webhook acknowledgement | < 1 s p95 after signature validation | v0.3 provider work | Integration/load test |
| Missed-call text-back latency | < 60 s | v0.3 live recovery | Observability dashboard |
| Inbound call handoff | < 3 s average | v0.3 voice path | Golden-call / provider-readiness gate |
| Calendar-slot response | < 1.5 s p95 | v0.3 scheduling | Integration/load test |
| Monthly report generation | > 99% completion | Reporting release | Scheduled-job evidence |

## Required Performance Evidence

Before a surface is considered stable:

- The target is named in the PR or release note.
- The validation method is documented.
- Failures are captured in the risk register or open questions register.
- Any skipped performance check has a reason and an owner.

## Load-Test Scope

Load tests are required before:

- Live webhook traffic.
- Live voice / SMS provider traffic.
- Client-facing report generation.
- Production deploy.
- Any tenant-count or concurrency increase that changes operational risk.

Minimum load-test dimensions:

- Tenant count.
- Request rate.
- Concurrent sessions.
- DB connection pressure.
- Queue depth / retry behavior.
- Provider rate limits.
- Error rate and p95/p99 latency.

## Non-Goals

- This document does not choose a load-testing tool.
- This document does not authorize live provider keys.
- This document does not replace `docs/ops/RESPONSEOS_OBSERVABILITY_AND_GOVERNANCE.md`.

