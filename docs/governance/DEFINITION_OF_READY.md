# Definition of Ready

**Status:** Draft governance baseline. Pending Audio approval.
**Purpose:** Define when ResponseOS work is ready to begin.

## Ready Means

A work item is ready when it is sufficiently defined, scoped, and governed so implementation can proceed without inventing product scope, bypassing safety rules, or creating documentation drift.

## Universal Readiness Checklist

Before work starts, confirm:

- The work has a named owner.
- The branch or worktree location is known.
- The current git status has been reviewed.
- The request maps to `docs/PRD.md`, `docs/ROADMAP.md`, an accepted ADR, or an approved task plan.
- The desired outcome is stated.
- In-scope and out-of-scope items are stated.
- Acceptance criteria are stated.
- Required validation commands are known.
- Required docs to inspect are named.
- Security, tenant isolation, secrets, provider, production, and deployment implications are assessed.
- Any stale or conflicting docs are identified before implementation.
- Any human approval dependency is explicit.

## Documentation Work Is Ready When

- The target docs are named.
- The governance layer or product layer affected by the edit is clear.
- Existing docs have been inspected for equivalent or conflicting content.
- The work does not silently promote a duplicate source to canonical.
- The expected status of new docs is clear: draft, proposed, accepted, historical, or superseded.

## Code Work Is Ready When

- Relevant code paths have been inspected.
- Relevant docs have been inspected.
- API, data, auth, tenant, and provider contracts are understood.
- For Next.js changes, relevant local Next.js docs under `node_modules/next/dist/docs/` have been checked when framework behavior matters.
- Tests or validation commands are identified before edits begin.

## Provider / Integration Work Is Ready When

Provider or integration work is not ready unless:

- v0.3 live integration authorization exists.
- Required provider docs are reviewed.
- Env vars are placeholder-only in repo docs.
- Mock fallback remains intact.
- Webhook signature validation and event-ledger persistence are in scope.
- Costs, security posture, and failure modes are documented.

## Deployment Work Is Ready When

Deployment work is not ready unless:

- v0.3 readiness gates have cleared.
- Production target and environment owner are named.
- Secret handling path is approved.
- Rollback plan exists.
- No docs imply production readiness without evidence.

## Not Ready Signals

Pause work if:

- The request conflicts with `AGENTS.md` hard rules.
- The branch or worktree is dirty and the dirty work is not understood.
- Product scope is ambiguous.
- A stale doc is being treated as current.
- A live provider, secret, production deploy, or client-data action is implied but not approved.
- Acceptance criteria are missing for implementation work.

