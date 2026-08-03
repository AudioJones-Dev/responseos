# ResponseOS Project Constitution

**Status:** Draft governance baseline. Pending Audio approval.
**Owner:** AJ Digital LLC / Audio Jones.
**Applies to:** ResponseOS product, docs, code, branches, PRs, worktrees, and agent-assisted work.

## Purpose

ResponseOS is the AI Revenue Recovery Platform for service businesses. It captures missed demand, qualifies and routes leads, automates follow-up, books opportunities, and proves recovered revenue.

This constitution defines the operating rules for changing ResponseOS without creating scope sprawl, stale documentation, unsafe integrations, or ambiguous ownership.

## Authority Order

When instructions conflict, use this order:

1. Explicit human instruction from Audio for the current task.
2. `AGENTS.md` hard rules and branch policy.
3. `docs/DECISIONS.md` accepted ADRs.
4. `docs/PRD.md` and `docs/ROADMAP.md`.
5. Architecture, API, data, security, deployment, and runbook docs.
6. Task-specific implementation plans.

If the conflict affects scope, security, production, secrets, provider integrations, or canonical docs, pause and request Audio approval.

## Non-Negotiable Constraints

- No live provider integrations until v0.3 is explicitly authorized.
- No real secrets in the repo.
- No Firebase.
- No production deploys until v0.3 readiness gates clear.
- Tenant isolation is mandatory for every tenant-scoped read/write.
- Webhook signature validation is mandatory before any business mutation.
- Provider adapters must fall back to mock behavior when env vars are missing.
- ResponseOS must not be described as HIPAA-certified.
- Do not push to `master` directly.
- Do not force-push shared branches without explicit approval.

## Canonical Product Scope

Current canonical product scope is anchored by:

- `docs/PRD.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/architecture.md`
- `docs/SECURITY.md`

Supporting docs may add detail, but they must not silently override these sources. If a supporting doc conflicts with a canonical source, mark the conflict and reconcile it through a remediation PR.

## Change Control

Every meaningful change needs:

- A named owner.
- A branch or worktree location.
- A defined scope.
- Acceptance criteria.
- Validation evidence or a documented reason validation was not run.
- Documentation updates when contracts, behavior, governance, or scope change.

New architecture decisions must update `docs/DECISIONS.md` or a future approved ADR location. Milestone changes must update `docs/ROADMAP.md`. Merged PRs must update `docs/CHANGELOG.md`.

## Agent Operating Rules

Agents may:

- Inspect code and docs.
- Draft plans.
- Create branches and worktrees when needed to preserve dirty work.
- Make scoped edits approved by the task.
- Run validation commands.
- Open draft PRs when requested or when the PR policy requires it for review.

Agents must not:

- Introduce secrets.
- Modify production configuration without explicit approval.
- Wire live provider integrations before v0.3 authorization.
- Delete docs or branches without explicit approval and preservation evidence.
- Promote a duplicate doc to canonical without Audio approval.
- Represent assumptions as facts.

## Documentation Governance

Documentation work must preserve existing context. Do not delete or rewrite broad documentation sets during cleanup. Prefer:

- Mark stale docs as historical or superseded.
- Add cross-references to canonical sources.
- Reconcile conflicts in small PRs.
- Keep audit evidence and rationale in the PR description or planning doc.

## Approval Gates

The following require explicit Audio approval before execution:

- Production deploys.
- Secret, credential, or client-data changes.
- Live provider integrations.
- Public positioning changes.
- Canonical source-of-truth changes.
- Deleting docs, branches, worktrees, or recovery artifacts.
- Renaming default branches or changing branch policy.
- Replacing the ADR structure.

## Stability Rule

No feature, doc set, or operational surface should be treated as stable until it satisfies `DEFINITION_OF_STABLE.md`.

