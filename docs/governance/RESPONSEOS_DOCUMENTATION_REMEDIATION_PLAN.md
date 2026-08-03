# ResponseOS Documentation Governance Remediation Plan

**Status:** Draft remediation plan. Do not treat this document as canonical governance until reviewed and approved by Audio.
**Project tier assumed:** Tier 4 Platform.
**Scope:** Documentation governance planning only. This plan does not rewrite existing documentation, promote a new canonical source, modify code, change CI, change deployment configuration, or introduce secrets.

## Current Audit Summary

ResponseOS is not missing documentation entirely. The repo has strong product, architecture, security, delivery, and implementation documentation, but the current documentation set is fragmented across multiple folders, includes stale references, and does not yet align with the AJ Digital OS Documentation Governance Stack.

Overall status: **Partial**.

Primary risks:

- Missing Definition of Ready, Definition of Done, and Definition of Stable.
- Missing risk register.
- Missing requirements traceability matrix.
- Missing worktree plan.
- Stale README, architecture, and deployment documentation.
- Duplicate PRD, roadmap, and planning sources without a declared canonical hierarchy.

The remediation strategy is to recover governance gates first, then reconcile stale documents, then verify specifications against code, then complete lower-risk quality and reference docs.

## Remediation Phases

### Phase 1 - Governance Gate Recovery

Objective: create the minimum Tier 4 governance layer needed before new implementation work expands scope.

Create or update:

- `docs/governance/PROJECT_CONSTITUTION.md`
- `docs/governance/DEFINITION_OF_READY.md`
- `docs/governance/DEFINITION_OF_DONE.md`
- `docs/governance/DEFINITION_OF_STABLE.md`
- `docs/governance/RISK_REGISTER.md`
- `docs/governance/WORKTREE_PLAN.md`
- `docs/governance/REQUIREMENTS_TRACEABILITY_MATRIX.md`

Expected outcome:

- ResponseOS has explicit governance gates for when work can start, when work is complete, and when a surface is stable enough for dependent work.
- Branch, worktree, stale-doc, and multi-agent risks are tracked rather than handled ad hoc.
- Requirements can be traced from PRD/roadmap intent to implementation docs, validation gates, and acceptance evidence.

Constraints:

- Do not promote any existing planning document to canonical until Audio approves the canonicalization decisions listed below.
- Do not delete duplicate docs during this phase.
- Do not rewrite product, architecture, API, deployment, or data docs yet except for narrow cross-reference notes if approved in the implementation PR.

### Phase 2 - Stale Documentation Reconciliation

Objective: remove or clearly mark stale operational guidance that could mislead future implementation.

Update:

- `README.md`
- `docs/README.md`
- `docs/architecture.md`
- `docs/DEPLOYMENT.md`
- `docs/product/RESPONSEOS_ROADMAP.md`

Required reconciliation checks:

- Remove or mark historical stale Auth.js references.
- Remove or mark historical stale Supabase language where Neon is now the accepted canonical database host.
- Remove or mark historical stale v0.2-in-flight language now that v0.2 closeout has shipped.
- Ensure README installation, validation, branch, provider, database, auth, and deployment posture match the current repo.
- Ensure deployment docs do not imply production deploy authorization before v0.3 readiness approval.

Expected outcome:

- Future agents and contributors can read the README and top-level docs without inheriting outdated assumptions.
- Duplicate roadmap/planning documents are either aligned or explicitly labeled as reference/historical.

### Phase 3 - Specification Reconciliation

Objective: validate specification docs against the actual codebase before implementation work depends on them.

Review and reconcile:

- `docs/api-spec.md` against `app/api/**`.
- `docs/data-schema.md` against `prisma/schema.prisma` and `prisma/migrations/**`.
- `docs/PRD.md` against `docs/product/RESPONSEOS_PRD.md`.

Required reconciliation checks:

- Confirm every documented API route exists or is clearly marked planned.
- Confirm every implemented API route is documented or explicitly excluded.
- Confirm documented models, enums, relationships, and migration claims match Prisma.
- Confirm the canonical PRD source is declared without deleting supporting product context.

Expected outcome:

- API, data, and product specs can be trusted as implementation inputs.
- Planned, shipped, deprecated, and historical surfaces are distinguishable.

### Phase 4 - Quality / Reference Completion

Objective: complete the remaining Tier 4 quality and reference artifacts after governance and stale-doc risks are reduced.

Create or update:

- `docs/quality/PERFORMANCE.md`
- `docs/quality/FAILURE_MODES.md`
- `docs/quality/ACCEPTANCE_TEST_PLAN.md`
- `docs/reference/GLOSSARY.md`
- `docs/reference/OPEN_QUESTIONS.md`
- `docs/reference/CODING_STANDARDS.md`

Expected outcome:

- Performance expectations, failure modes, acceptance criteria, terminology, open questions, and coding standards have stable homes.
- Future PRs can reference these docs instead of re-deciding standards inside implementation threads.

## Canonicalization Decisions Needed

These decisions require Audio approval before remediation PRs promote anything to canonical:

1. **Numbered AJ Digital OS naming vs current ResponseOS naming.**
   - Decision needed: should ResponseOS adopt files like `00-VISION.md` and `01-PRD.md`, or keep current names with a governance-stack index?

2. **Monolithic `docs/DECISIONS.md` vs `docs/adr/`.**
   - Decision needed: should new ADRs stay in the current decision log, or should future ADRs move to one-file-per-ADR under `docs/adr/`?

3. **Neon vs Supabase as canonical database language.**
   - Decision needed: should all active docs refer to Neon as the canonical hosted Postgres target, with Supabase only retained as historical/superseded context?

4. **Claude active build lane vs review-only lane.**
   - Decision needed: should `CLAUDE.md` define an active implementation lane, or should Claude be documented as review/planning only while Codex owns repo edits?

5. **DoR/DoD/DoS approval owner.**
   - Decision needed: who approves readiness, done, and stable status: Audio only, Codex draft plus Audio approval, or CODEOWNERS-backed review once ownership is formalized?

## Acceptance Criteria

The remediation effort is complete when:

- No stale Auth.js, Supabase, or v0.2-in-flight references remain in active docs unless clearly marked historical or superseded.
- Definition of Ready exists as a standalone governance doc.
- Definition of Done exists as a standalone governance doc.
- Definition of Stable exists as a standalone governance doc.
- Risk register exists.
- Requirements traceability matrix exists.
- Worktree plan exists.
- Canonical PRD and roadmap sources are declared.
- README matches actual repo state.
- Deployment docs match the actual config posture and production-deploy authorization gate.
- API docs are reconciled to actual `app/api/**` routes.
- Data docs are reconciled to `prisma/schema.prisma` and migrations.
- No secrets are printed or introduced.
- Existing docs are not deleted as part of remediation; documents may be marked superseded or reference-only only when clearly justified and approved.

## Proposed PR Sequence

### PR 1 - Governance Gate Docs

Scope:

- Create the Phase 1 governance docs.
- Keep content concise and operational.
- Reference existing `AGENTS.md`, `docs/PRD.md`, `docs/ROADMAP.md`, and `docs/DECISIONS.md` without re-litigating product strategy.

Recommended first implementation PR: **PR 1 - Governance Gate Docs**.

Reason:

- This unlocks future remediation without allowing scope sprawl.
- It creates the approval gates needed before stale-doc reconciliation and specification rewrites.
- It is the smallest high-leverage remediation batch.

### PR 2 - Stale README / Architecture / Deployment Cleanup

Scope:

- Update `README.md`, `docs/README.md`, `docs/architecture.md`, `docs/DEPLOYMENT.md`, and `docs/product/RESPONSEOS_ROADMAP.md`.
- Remove or mark stale active-language references.
- Preserve historical context where useful.

### PR 3 - API / Data / PRD Reconciliation

Scope:

- Reconcile `docs/api-spec.md` with `app/api/**`.
- Reconcile `docs/data-schema.md` with Prisma schema and migrations.
- Declare canonical PRD hierarchy between `docs/PRD.md` and `docs/product/RESPONSEOS_PRD.md`.

### PR 4 - Quality / Reference Completion

Scope:

- Add performance, failure modes, acceptance test plan, glossary, open questions, and coding standards docs.
- Keep these docs tied to actual ResponseOS validation and operating constraints.

### PR 5 - Docs Index / Canonicalization Cleanup

Scope:

- Create a governance-stack documentation index without renaming files or promoting a final canonicalization model.
- Update documentation navigation to point to the new governance, quality, and reference baselines.
- Keep canonicalization decisions open until Audio approves them.
- Mark duplicate or superseded docs as reference-only only where already justified by earlier reconciliation.
- Do not delete existing docs unless a separate explicit deletion approval is granted.

## Non-Goals

- No code changes.
- No CI or hook changes.
- No production configuration changes.
- No secret changes.
- No deployment.
- No broad rewrite of the existing documentation set.
- No deletion of existing docs.
- No promotion of a new canonical documentation system before Audio approval.
