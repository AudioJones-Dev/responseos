# ResponseOS Documentation Index

**Status:** Draft reference baseline. Pending Audio approval.
**Purpose:** Map existing ResponseOS docs to the AJ Digital OS Documentation Governance Stack without renaming files, deleting docs, or promoting a final canonical naming model.

## Current Authority Rule

Until Audio approves a final canonicalization decision:

1. `AGENTS.md` controls repo operating rules for agents.
2. `docs/DECISIONS.md` controls accepted architecture and governance decisions.
3. `docs/PRD.md` is the short operational PRD.
4. `docs/ROADMAP.md` is the operational roadmap.
5. `docs/reference/DOCUMENTATION_INDEX.md` is a navigation map only.

Supporting `RESPONSEOS_*` docs provide expanded detail. If a supporting doc conflicts with the authority sources above, the authority source wins until a reconciliation PR resolves the conflict.

## Status Labels

- **Current:** active operational source.
- **Equivalent:** covers the governance-stack requirement under a ResponseOS-specific name.
- **Draft:** newly created baseline pending Audio approval.
- **Supporting:** useful detail, not the primary operational source.
- **Historical:** retained for provenance, not active guidance.
- **Open:** not yet fully resolved.

## Layer 0 - Strategy

| Governance artifact | Current ResponseOS doc | Status | Notes |
|---|---|---|---|
| Vision | `docs/product-spec.md`, `docs/brand/RESPONSEOS_POSITIONING.md` | Equivalent | Product vision exists, but no numbered `00-VISION.md` has been adopted. |
| PRD | `docs/PRD.md` | Current | Short operational PRD. |
| Expanded PRD | `docs/product/RESPONSEOS_PRD.md` | Supporting | Expanded companion; not a replacement for `docs/PRD.md`. |
| Business case | `docs/client-facing-offer.md`, `docs/pricing-and-onboarding.md` | Equivalent | Commercial case is split across offer and pricing docs. |
| Success metrics | `docs/PRD.md`, `docs/product-spec.md`, dashboard docs | Equivalent | Metrics exist across product and dashboard docs. |
| Stakeholders | `AGENTS.md`, `docs/governance/PROJECT_CONSTITUTION.md` | Draft | Owner and operator roles are documented; standalone stakeholder doc remains optional. |
| Assumptions | `docs/reference/OPEN_QUESTIONS.md`, ADRs | Draft | Assumptions should be tracked through open questions and ADRs. |

## Layer 1 - Specification

| Governance artifact | Current ResponseOS doc | Status | Notes |
|---|---|---|---|
| Architecture | `docs/architecture.md`, `docs/architecture/RESPONSEOS_SYSTEM_ARCHITECTURE.md` | Current / Supporting | Root architecture is the operational entry point; `RESPONSEOS_*` architecture docs add detail. |
| Data model | `docs/data-schema.md`, `docs/architecture/RESPONSEOS_DATA_MODEL.md` | Current / Supporting | Root data schema now includes a current Prisma snapshot. |
| API spec | `docs/api-spec.md`, `docs/architecture/RESPONSEOS_API_CONTRACTS.md` | Current / Supporting | Root API spec now reflects current route inventory. |
| Workflows | `docs/automation-flows.md` | Current | RECOVER workflow source. |
| Agents | `AGENTS.md`, `CLAUDE.md` | Current / Open | `AGENTS.md` is active. Claude lane decision remains open. |
| Prompts | `docs/product/RESPONSEOS_EXEC_*_PROMPT.md` | Supporting | Execution prompt history; not all are active build instructions. |
| Business rules | `docs/PRD.md`, `docs/DECISIONS.md`, `docs/pricing-and-onboarding.md` | Equivalent | Rules are distributed across product, ADR, and commercial docs. |
| Scoring | `lib/scoring/*`, `docs/PRD.md` | Open | Scoring logic exists in code; standalone scoring doc remains future cleanup. |
| Calibration | `docs/quality/ACCEPTANCE_TEST_PLAN.md`, QA docs | Draft | Calibration still needs tighter voice/QA thresholds before v0.3. |
| Knowledge model | `docs/ROADMAP.md`, `docs/data-schema.md` future section | Supporting | v0.4-gated planning only. |

## Layer 2 - Quality

| Governance artifact | Current ResponseOS doc | Status | Notes |
|---|---|---|---|
| Security | `docs/SECURITY.md` | Current | Active security baseline. |
| Observability | `docs/ops/RESPONSEOS_OBSERVABILITY_AND_GOVERNANCE.md` | Supporting | Expanded ops observability/governance plan. |
| Test strategy | `docs/ops/RESPONSEOS_QA_VALIDATION_PLAN.md` | Supporting | Existing QA plan; acceptance doc references it. |
| Acceptance test plan | `docs/quality/ACCEPTANCE_TEST_PLAN.md` | Draft | New governance-facing acceptance baseline. |
| Performance | `docs/quality/PERFORMANCE.md` | Draft | New quality baseline. |
| Failure modes | `docs/quality/FAILURE_MODES.md` | Draft | New quality baseline. |
| Runbooks | `docs/ops/RESPONSEOS_RUNBOOK.md` | Supporting | Existing ops runbook. |

## Layer 3 - Delivery

| Governance artifact | Current ResponseOS doc | Status | Notes |
|---|---|---|---|
| Deployment | `docs/DEPLOYMENT.md`, `docs/ops/RESPONSEOS_DEPLOYMENT_PLAN.md` | Current / Supporting | Root deployment doc is active and production-gated. |
| Roadmap | `docs/ROADMAP.md` | Current | Operational roadmap. |
| Expanded roadmap | `docs/product/RESPONSEOS_ROADMAP.md` | Supporting | Planning view; not a replacement for root roadmap. |
| Changelog | `docs/CHANGELOG.md` | Current | Per-PR history. |
| Release plan | `docs/ROADMAP.md`, `docs/quality/ACCEPTANCE_TEST_PLAN.md` | Open | No standalone release plan yet. |
| Migration plan | `docs/data-schema.md`, `prisma/migrations/**` | Equivalent | Migrations are code source; docs summarize current state. |

## Layer 4 - Governance

| Governance artifact | Current ResponseOS doc | Status | Notes |
|---|---|---|---|
| Project constitution | `docs/governance/PROJECT_CONSTITUTION.md` | Draft | Pending Audio approval. |
| Definition of Ready | `docs/governance/DEFINITION_OF_READY.md` | Draft | Pending Audio approval. |
| Definition of Done | `docs/governance/DEFINITION_OF_DONE.md` | Draft | Pending Audio approval. |
| Definition of Stable | `docs/governance/DEFINITION_OF_STABLE.md` | Draft | Pending Audio approval. |
| ADRs | `docs/DECISIONS.md` | Current | Monolithic ADR/decision log. Future `docs/adr/` decision remains open. |
| Decision log | `docs/DECISIONS.md` | Current | Accepted decision source. |
| Risk register | `docs/governance/RISK_REGISTER.md` | Draft | Pending Audio approval. |

## Layer 5 - Execution

| Governance artifact | Current ResponseOS doc | Status | Notes |
|---|---|---|---|
| Codex build plan | `docs/governance/RESPONSEOS_DOCUMENTATION_REMEDIATION_PLAN.md`, `docs/product/RESPONSEOS_EXEC_*` | Draft / Supporting | Current remediation plan plus historical execution prompts. |
| Claude build plan | `CLAUDE.md` | Open | Claude active vs review-only lane remains unresolved. |
| Task breakdown | `docs/product/RESPONSEOS_BACKLOG.md`, dashboard | Supporting | Dashboard task list is live progress surface. |
| Implementation sequence | `docs/product/RESPONSEOS_IMPLEMENTATION_PLAN.md`, remediation plan | Supporting | Use with roadmap and ADRs. |
| Dependency graph | `docs/architecture/RESPONSEOS_INTEGRATION_MAP.md` | Supporting | A formal graph doc remains optional. |
| Worktree plan | `docs/governance/WORKTREE_PLAN.md` | Draft | Pending Audio approval. |
| Requirements traceability matrix | `docs/governance/REQUIREMENTS_TRACEABILITY_MATRIX.md` | Draft | Pending Audio approval. |

## Layer 6 - Reference

| Governance artifact | Current ResponseOS doc | Status | Notes |
|---|---|---|---|
| Glossary | `docs/reference/GLOSSARY.md` | Draft | New reference baseline. |
| Dependency map | `docs/architecture/RESPONSEOS_INTEGRATION_MAP.md`, `package.json` | Supporting | Formal dependency map remains optional. |
| Open questions | `docs/reference/OPEN_QUESTIONS.md` | Draft | New reference baseline. |
| Coding standards | `docs/reference/CODING_STANDARDS.md` | Draft | New reference baseline. |
| Documentation index | `docs/reference/DOCUMENTATION_INDEX.md` | Draft | This file. |

## Canonicalization Decisions Still Open

The following remain unresolved and should not be silently decided by future agents:

- Numbered AJ Digital OS filenames vs current ResponseOS filenames plus index.
- Monolithic `docs/DECISIONS.md` vs `docs/adr/`.
- Claude active build lane vs review-only lane.
- Final approval owner for DoR, DoD, and DoS.
- Whether to create standalone release, stakeholder, assumptions, scoring, calibration, and dependency-map docs.

