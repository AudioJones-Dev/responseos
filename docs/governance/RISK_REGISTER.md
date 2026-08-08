# ResponseOS Risk Register

**Status:** Draft governance baseline. Pending Audio approval.
**Review cadence:** Update during planning, before major implementation PRs, and when a risk changes materially.

## Risk Scoring

Likelihood and impact use: Low, Medium, High.

Status values:

- **Open:** active risk.
- **Mitigating:** mitigation is in progress.
- **Accepted:** consciously accepted by Audio.
- **Closed:** no longer active.

## Active Risks

| ID | Risk | Likelihood | Impact | Status | Owner | Mitigation / Next Action |
|---|---|---:|---:|---|---|---|
| RISK-001 | Governance gates are missing or inconsistently applied. | High | High | Mitigating | Codex / Audio | Create DoR, DoD, DoS, constitution, worktree plan, risk register, and RTM. |
| RISK-002 | Stale README, architecture, deployment, or roadmap docs mislead future implementation. | High | High | Open | Codex | Reconcile active docs in Phase 2; mark historical material clearly. |
| RISK-003 | Duplicate PRD, roadmap, and planning sources create unclear canonical authority. | Medium | High | Open | Audio | Decide canonicalization approach before Phase 3/5 cleanup. |
| RISK-004 | Provider integration work starts before v0.3 authorization. | Medium | High | Open | Audio / Codex | Enforce DoR gate and `AGENTS.md` hard rule: mocks only until approved. |
| RISK-005 | Secret or credential values are introduced through env docs or provider setup. | Low | High | Open | All contributors | Keep `.env.example` placeholder-only; never print secret values; use approved secret path. |
| RISK-006 | Tenant isolation assumptions drift across API/data changes. | Medium | High | Open | Codex / Claude Code | Require data/API reconciliation and tenant-scope review for relevant PRs. |
| RISK-007 | Webhook mutation paths bypass signature validation or event-ledger discipline. | Medium | High | Open | Codex / Claude Code | Enforce ADR-0009 and event-ledger-first review for webhook work. |
| RISK-008 | Branch/worktree backlog creates hidden WIP, stale branches, or accidental overwrite. | Medium | Medium | Mitigating | Codex | Use `WORKTREE_PLAN.md`; preserve dirty work before branch cleanup. |
| RISK-009 | Deployment docs imply production readiness before v0.3 gates clear. | Medium | High | Open | Audio / Codex | Reconcile deployment docs and keep no-production language explicit. |
| RISK-010 | Claude/Codex lane ownership remains ambiguous. | Medium | Medium | Open | Audio | Decide whether Claude is active build lane or review-only lane. |
| RISK-011 | API and data docs diverge from `app/api/**` and Prisma migrations. | Medium | High | Open | Codex | Complete Phase 3 reconciliation before new API/data implementation. |
| RISK-012 | Dashboard progress state drifts from actual repo work. | Medium | Medium | Open | Codex / Claude Code | Update `dashboard/dashboard-data.json` when work maps to tracked progress. |

## Review Notes

- This register starts from the documentation governance audit and remediation plan.
- Risks should not be deleted when resolved. Mark them Closed with a short rationale.
- New risks created by implementation PRs should be added before merge.

