# ResponseOS Worktree Plan

**Status:** Draft governance baseline. Pending Audio approval.
**Purpose:** Define how branches and worktrees should be used without losing dirty work or creating goal sprawl.

## Default Branch

- Default branch: `master`.
- Do not push directly to `master`.
- Feature and remediation work should branch from latest `origin/master`.

## Standard Worktree Pattern

Use the primary checkout for routine clean work only when it is clean and current.

Use an isolated worktree when:

- The primary checkout is dirty.
- The primary checkout is behind and should not be switched.
- The task needs a branch while existing work must remain untouched.
- A PR branch needs focused validation without absorbing unrelated local changes.

Recommended local pattern:

```text
C:\dev\responseos
C:\dev\responseos-<short-purpose>
```

Example:

```text
C:\dev\responseos-governance-remediation
```

## Before Creating a Branch or Worktree

Run and record:

```bash
git status --short --branch
git branch --show-current
git worktree list --porcelain
```

If the checkout is dirty, identify whether changes are related to the task. Do not stash, reset, delete, or overwrite dirty work without explicit approval.

## Branch Naming

Use scoped branch names:

- `docs/<topic>`
- `fix/<topic>`
- `feat/<topic>`
- `chore/<topic>`
- `test/<topic>`

Avoid vague names such as `cleanup`, `updates`, or `codex-work` unless they are preservation-only and date-stamped.

## Preservation Rules

Before deleting, rebasing, force-pushing, or pruning:

- Confirm no dirty worktree is attached to the branch.
- Confirm no open PR depends on the branch.
- Confirm unique commits are merged, closed, archived, or explicitly abandoned.
- Preserve recovery evidence with a bundle, patch, or named branch when needed.
- Request explicit Audio approval for destructive branch or worktree cleanup.

## PR Flow

1. Branch from latest `origin/master`.
2. Keep the PR single-purpose.
3. Open as draft until validation is green or skipped validation is explained.
4. Do not batch unrelated docs, code, dependency, and governance changes.
5. Mark ready only after review conditions are satisfied.
6. Squash merge single-purpose PRs unless the human operator decides otherwise.

## Worktree Cleanup

Worktrees may be removed only when:

- The branch state is preserved.
- Intended changes are committed, pushed, abandoned with approval, or archived.
- `git status --short --branch` is clean in that worktree.
- No PR or active task references the worktree.

## Current Governance Remediation Worktree

The governance remediation branch may use an isolated worktree because the primary checkout had unrelated dirty work at the start of remediation planning.

Branch:

```text
docs/governance-remediation-plan
```

Worktree:

```text
C:\dev\responseos-governance-remediation
```

Do not delete this worktree until the remediation branch is merged, closed, or explicitly abandoned.

