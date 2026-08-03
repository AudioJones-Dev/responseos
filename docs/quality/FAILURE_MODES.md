# ResponseOS Failure Modes

**Status:** Draft quality baseline. Pending Audio approval.
**Scope:** Known failure modes that must be considered during planning, implementation, validation, and release review.

## Purpose

ResponseOS is event-ledger-first, multi-tenant, and provider-adapter based. Failures should be contained, auditable, and recoverable without bypassing tenant isolation, webhook signature validation, or mock-first safety rules.

## Failure Mode Register

| ID | Failure mode | Impact | Required control |
|---|---|---|---|
| FM-001 | Cross-tenant read/write | P0 data exposure | `accountId` derived from session; tenant isolation tests |
| FM-002 | Unsigned or replayed webhook mutates business state | Corrupt data / budget abuse | Signature validation before parse/mutation; dedupe key |
| FM-003 | Live provider integration starts before v0.3 approval | Cost, data, and reliability risk | DoR gate; mock-first adapters; explicit Audio approval |
| FM-004 | Provider outage or rate limit | Missed calls / delayed follow-up | Adapter fallback, queue/backoff, human escalation path |
| FM-005 | Stale docs guide implementation | Scope drift or wrong stack | Docs reconciliation and source-of-truth hierarchy |
| FM-006 | Secrets committed or printed | Credential exposure | Placeholder-only env docs; secret scan; no value printing |
| FM-007 | DB migration drift | Broken deploy or data loss | Prisma migration review; CI integration job |
| FM-008 | Dashboard status drift | Misleading project health | Update `dashboard/dashboard-data.json` with tracked work |
| FM-009 | Voice/prompt hallucination | Customer trust / compliance risk | Golden-call pack, QA logs, profile rollback |
| FM-010 | Appointment collision | Customer experience failure | Calendar re-read, hold limits, reconciliation path |
| FM-011 | Report calculation error | Incorrect ROI / billing evidence | Test revenue math; recompute from ledger facts |
| FM-012 | Production deploy before readiness | Public instability | No-production gate until v0.3 readiness approval |

## Required Response Pattern

For any failure mode found during review:

1. Identify the affected tenant, provider, route, model, or document.
2. Contain using the least destructive option.
3. Preserve evidence.
4. Update tests, docs, risk register, or runbook as appropriate.
5. Do not disable safety checks to make a test or workflow pass.

## Cross-References

- Security: `docs/SECURITY.md`
- Runbook: `docs/ops/RESPONSEOS_RUNBOOK.md`
- Governance risk register: `docs/governance/RISK_REGISTER.md`
- Definition of Stable: `docs/governance/DEFINITION_OF_STABLE.md`

