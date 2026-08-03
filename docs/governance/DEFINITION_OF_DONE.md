# Definition of Done

**Status:** Draft governance baseline. Pending Audio approval.
**Purpose:** Define when ResponseOS work can be considered complete for review or merge.

## Done Means

A work item is done when the requested change is implemented, scoped, documented, validated, and reviewable without hidden assumptions or unresolved safety gaps.

## Universal Done Checklist

Before marking work done:

- Scope matches the approved task.
- No unrelated refactors or broad rewrites were introduced.
- No secrets, credentials, or sensitive values were printed or committed.
- No production config, CI, hooks, or live provider behavior changed unless explicitly approved.
- Tenant isolation and webhook signature rules remain intact where relevant.
- Existing docs were preserved unless explicit deletion approval was granted.
- Stale docs introduced or discovered by the work are either updated, marked, or listed as follow-up.
- Validation was run, or the reason it was not run is documented.
- Git status is reviewed.
- PR description or final report names changed files, validation evidence, and remaining risks.

## Documentation Done

Documentation work is done when:

- The edited or created doc has a clear status.
- The doc states whether it is canonical, draft, reference-only, historical, or superseded.
- Cross-references use current paths.
- Claims about repo state match current code/config evidence.
- Stale references are removed or marked historical.
- No secret values are included.

## Code Done

Code work is done when:

- Relevant tests pass locally or a documented blocker explains why they could not run.
- TypeScript, lint, unit tests, build, and integration tests are run when required by `AGENTS.md`.
- New or changed behavior is covered by focused tests when risk justifies it.
- Public behavior, API contracts, data contracts, and provider contracts are documented if changed.

## Merge-Ready Done

A PR is merge-ready only when:

- CI is green or a human explicitly accepts the known failure.
- Required docs are updated.
- `docs/CHANGELOG.md` is updated for merged work.
- Dashboard task status is updated when the work maps to the progress board.
- Open questions are resolved or explicitly deferred.
- The PR is marked ready only after draft review conditions are satisfied.

## Not Done Signals

Do not mark work done if:

- The branch has uncommitted intended changes.
- The change relies on an unapproved assumption.
- Validation was skipped without explanation.
- A new governance, product, or architecture decision was made without a decision record.
- Stale documentation remains active and misleading because of the change.

