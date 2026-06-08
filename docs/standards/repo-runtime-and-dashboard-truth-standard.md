<!--
SNAPSHOT — DO NOT EDIT HERE.
Canonical source: AJ-DIGITAL-VAULT (G:\AJ-INTERNAL\AJ-DIGITAL-VAULT)
  08-KNOWLEDGE/DOCTRINE/Standards/repo-runtime-and-dashboard-truth-standard.md
This is a read-only repo snapshot of the canonical AJ Digital engineering standard,
mirrored per the standard's §9 propagation model (documentation copy). Edit the vault
source, then re-snapshot. Obsidian [[wikilinks]] below resolve in the vault, not here.
Snapshot: v1.1 · synced 2026-06-07 · decision D-2026-06-07-01
-->

# Repository Runtime & Dashboard Truth-State Standard

**Status:** CANONICAL (v1.1) · **Owner:** AJ Digital LLC / Audio Jones · **Canonical home:** AJ Digital Vault `08-KNOWLEDGE/DOCTRINE/Standards/`

## 1. Purpose

Define the canonical rules for **GitHub Actions runtime hygiene**, **action-runtime vs project-runtime separation**, **environment/secret hygiene** (`.env.example`), **dashboard truth-state** (`closed != done`), and the **propagation model** by which these standards are inherited across AJ Digital repositories without manual copy/paste drift.

This standard governs repository **runtime configuration and project-state truth**. It does **not** govern branch/merge/PR mechanics (owned by the Git Workflow Operating Standard) or deploy/approval gates (owned by the Validation & Guardrail Standard).

## 2. Canonical Rules (summary)

1. Pin GitHub Actions to current majors that run on the Node-24-era runtime.
2. Action runtime is never conflated with the project's own `node-version:`.
3. `.env.example` carries placeholders only; real secrets are never committed.
4. `closed != done` — only a closed *issue* or a *merged* PR counts as complete.
5. Every dashboard declares its source of truth; push-asserted and GitHub-derived status may not silently conflict.
6. Shared repo standards are inherited from central governed infrastructure, not copy-pasted.

## 3. GitHub Actions Runtime Hygiene

Pin GitHub Actions to current majors that run on the Node-24-era runtime. This clears GitHub's Node-20 runtime deprecation warning.

Canonical Actions versions:

```txt
actions/checkout@v6
actions/setup-node@v6
actions/upload-pages-artifact@v5
actions/deploy-pages@v5
```

- These four governed actions must be at (or above) the canonical majors in every Tier 1 / Tier 2 repo that runs CI.
- Bumping a governed action major is a mechanical, low-risk change and must not alter unrelated job logic.
- Ungoverned actions (e.g. `pnpm/action-setup`, `actions/cache`) are outside this rule; bump them only with separate justification.

## 4. Project Node Version Separation

**Do not confuse GitHub Action runtime with the project's own application `node-version`.**

- A workflow's `node-version:` is the **application** runtime, governed by the project (engines, dependencies, LTS posture), not by this standard.
- Bumping action majors (§3) MUST leave `node-version:` untouched.
- Changing `node-version:` requires a separate, justified decision (ideally an ADR).

## 5. Environment & Secret Hygiene (`.env.example`)

- Any repo that reads environment variables MUST commit a `.env.example` with **placeholder values only** — never real secrets.
- `.env.example` MUST enumerate **every** variable the application reads, so the app and CI can boot from placeholders.
- Real env files (`.env`, `.env.local`, any `.env.*` other than `.env.example`) MUST be gitignored and never committed.

## 6. Dashboard Truth-State Rule

**`closed != done`** — governs any dashboard that derives completion from GitHub issue/PR state.

Count as done: a closed *issue* or a *merged* PR. Never count as done: a closed-but-unmerged / abandoned / superseded PR.

```txt
closed issue OR merged PR        -> Done / 100
closed PR without merge          -> never auto-complete
closed-unmerged PR stale Done    -> demote to To Do / 0
open / reopened item marked Done -> walk back to In Progress
```

Implementation note: read `pull_request.merged_at` from the GitHub issues endpoint to distinguish a merged PR (non-null `merged_at`) from a closed-unmerged one (null). Reference implementation: this repo's `scripts/sync-dashboard.mjs` (the corrected, `merged_at`-aware version).

### 6.1 Dashboard-class distinction

- **Internal vault ticket dashboards** are not derived from GitHub issues/PRs — out of scope for this rule.
- **GitHub issue/PR-derived dashboards** (e.g. the responseos build-progress dashboard) are in scope.

### 6.2 Truth-State Source Contract

- **Each dashboard must declare its source of truth**: GitHub-derived, push-asserted, or hybrid.
- **Push-asserted and GitHub-derived status may not silently conflict.** Name which is canonical; render the other as a clearly-labelled derived view.
- **A closed-unmerged PR vetoes an automatic Done.** An asserted Done (commit trailer / `task:done` / Notion) is honored only as a deliberate, visible, recorded override.

## 7. Propagation Model

- **CI / Actions runtime** → a central reusable workflow / composite action (e.g. `AudioJones-Dev/aj-actions`), referenced as `uses: AudioJones-Dev/aj-actions/...@v1`.
- **Dashboard sync logic** → one canonical home (internal tooling package or composite action). Never vendor a second copy.
- **New repos** → bootstrapped from a template that references central infrastructure; templates are bootstrap scaffolding, not the long-term source of truth.
- **Manual copying** of workflows/scripts is a temporary fallback and must be tracked as drift. (This snapshot file is documentation, not executable config.)

## 8. Tiered Application

Tier 1 full compliance; Tier 2 basic workflow/env compliance; Tier 3 minimal (no committed secrets, no deprecated action majors if workflows exist).

---

*Snapshot of the canonical vault standard. For the authoritative, linked, and changelog-tracked version, see the AJ Digital Vault source named in the header comment above.*
