# ResponseOS Acceptance Test Plan

**Status:** Draft quality baseline. Pending Audio approval.
**Scope:** Acceptance testing expectations for documentation, code, API/data changes, and future v0.3 live-provider work.

## Purpose

Acceptance tests prove that a change satisfies its intended business, technical, and governance outcome. Passing lint/build alone is not enough for user-facing, tenant-facing, provider, or governance-sensitive work.

## Universal Acceptance Gates

Every PR must answer:

- What changed?
- Why is it in scope?
- What was validated?
- What was not validated?
- What risks remain?
- Which docs changed or intentionally did not change?

## Baseline Validation

Run when applicable:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration
```

`npm run test:integration` requires Postgres 16. If the database is unavailable, record the blocker rather than claiming green health.

## Acceptance Matrix

| Change type | Required acceptance evidence |
|---|---|
| Documentation-only | Scope is clear; stale/conflicting docs addressed or deferred; `git diff --check`; relevant JSON parses when touched |
| Governance docs | DoR/DoD/DoS/risk/worktree/RTM implications reviewed; Audio approval decisions listed |
| README / deployment docs | Active stack, branch, env, deploy, and validation claims match repo evidence |
| API docs | Route inventory checked against `app/api/**/route.ts` |
| Data docs | Prisma models/migrations checked against `prisma/schema.prisma` and `prisma/migrations/**` |
| Code change | Lint, typecheck, unit tests, build, and relevant focused tests pass |
| Data/API change | Integration tests pass; tenant isolation and error envelopes reviewed |
| Webhook/provider change | Signature validation, dedupe, mock fallback, and event-ledger behavior validated |
| Voice/conversation change | Golden-call pack and QA scoring evidence, not only code tests |
| Deployment change | Rollback plan, env/secret path, and explicit Audio approval |

## Milestone Acceptance

### v0.2 foundation

Accepted status is based on shipped migrations, Clerk auth wiring, tenant-aware data access, DB-backed routes, integration tests, and mock provider preservation.

### v0.3 live-provider readiness

Not accepted until:

- Provider-readiness gate passes.
- Live provider work is explicitly authorized.
- Signature validation is implemented for live webhook routes.
- Event persistence and dedupe are validated.
- Mock fallback remains available.
- No production deploy occurs without readiness approval.

### Production readiness

Production readiness requires a separate approval gate and must include:

- CI green.
- Integration green.
- Security review.
- Environment/secret path approved.
- Rollback plan.
- Observability/alerting path.
- Runbook updates.

## Acceptance Output

The PR description or final report should include:

- Validation commands and results.
- Skipped validation with reason.
- Remaining risks.
- Required human approvals.
- Linked dashboard task when applicable.

