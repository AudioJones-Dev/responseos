# ResponseOS Repository Assessment and Migration Plan

- **Assessment date:** 2026-08-10
- **Mode:** Phase 1 — assess and design only
- **Assessed worktree:** `<user-profile>\.codex\worktrees\4b6a\responseos`
- **Assessment branch:** `codex/repository-assessment`
- **Assessed commit:** `610d13aaf4787b94133e1fc485d2eb974d33f45a`
- **Default branch at assessment:** `master` (`origin/master` at `2175d60a96de528550b02e8f23b9aad1be099603`)
- **Scope:** Repository structure, documentation governance, Git/worktree use, agent operation, testing, CI/CD, security, dependencies, and migration planning.
**Non-destructive guarantee:** This assessment did not move, rename, consolidate, archive, deprecate, or delete repository assets. Every structural operation below is proposed only.

## Assessment basis and limitations

- The checked-out tree is not the current default-branch tree. It is one commit ahead of and six commits behind `origin/master`; the merge base is `0055dd1`.
- The checked-out commit is also the head of draft PR #114. Live GitHub inspection on 2026-08-10 found open PRs #107, #114, #115, and #116.
- Findings about code and documentation describe the checked-out tree unless explicitly labeled as live Git/GitHub state.
- The checked-out dashboard snapshot is not live truth: it still labels merged PRs #89–#93 as open/review. GitHub state was checked separately.
- A working-tree secret-pattern scan found no high-signal real credential material. It did not scan full Git history or external secret stores.
- `npm audit --package-lock-only --json` reported zero known vulnerabilities against the current registry snapshot.
- Full local runtime validation was not achieved. The host exposes Node `26.5.0` / npm `11.17.0`, while the repository pins Node `24.18.0` / npm `11.16.0`. Two `npm ci` attempts did not complete successfully. Best-effort direct checks under bundled Node `24.14.0` were invalidated by the incomplete install: lint and typecheck could not resolve complete Next/Prisma packages, and unit tests reported 141 passing / 36 failing with the failures concentrated in missing generated Prisma and incomplete Next/minimatch packages. These results are environment-inconclusive, not evidence of source regressions.
- Integration tests were not run because no test Postgres environment was provisioned during this non-infrastructure assessment.

---

# 1. Executive Summary

ResponseOS is a documentation-heavy Next.js product/platform repository for an AI revenue-recovery system. It contains a public marketing surface, an internal operator console, a tenant-scoped client portal, a mock-safe demo, REST/webhook routes, a Prisma/Postgres data layer, provider seams, tests, deployment scaffolding, and extensive product/GTM/operations documentation.

Overall condition: **technically structured, operationally over-documented, and not yet pilot- or production-ready**. The root and runtime layout are generally clean. Tenant-scoped data access, Prisma migrations, mock-first behavior, CI integration design, and hard safety rules are real strengths. The dominant repository risk is not missing documentation; it is that too many documents claim authority, remain active after their work shipped, or describe runtime behavior that the checked-out implementation does not yet provide.

The biggest risks are:

1. **Competing authority claims.** `docs/PRD.md`, `docs/ROADMAP.md`, and `docs/DECISIONS.md` are declared authoritative, while `RESPONSEOS_BUILD_SOURCE.md` and several `RESPONSEOS_*` architecture files also call themselves canonical.
2. **Status drift.** Draft remediation and GTM plans describe missing artifacts or missing deployment scaffolding that now exist. The dashboard snapshot reports merged PRs as open. Several specs describe shipped runtime behavior that is still mock, dormant, or not wired to routes.
3. **Worktree lifecycle sprawl.** Sixteen worktrees are registered. One detached worktree is dirty; many clean worktrees correspond to merged or superseded PR work. None were prunable automatically, so cleanup requires explicit branch/PR/unique-commit review.
4. **Mock interfaces that look more mature than the implementation.** Non-Clerk webhook routes parse and acknowledge payloads without signature validation, runtime schema validation, or ledger persistence. The `VoiceProvider` seam has one mock adapter and no runtime caller.
5. **QA gaps at system seams.** Unit and integration coverage is substantial for data/tenant behavior, but E2E is empty, mutation/webhook handlers are largely untested, app routes are excluded from coverage, and no coverage threshold is enforced.

The biggest opportunities are:

1. Establish one approved documentation authority map and status vocabulary, then remove conflicting “canonical” labels.
2. Close out the completed governance remediation wave and archive shipped prompts/plans instead of adding another governance layer.
3. Operationalize a lightweight workflow/worktree command center with task ownership, branch/worktree identity, validation, approval, PR, and cleanup rules.
4. Deepen the real runtime modules—validated ingress, ledger persistence, tenant policy, and adapter resolution—while deprecating hypothetical seams that have no second adapter or caller.

**Recommended posture:** Do not perform a broad repository reorganization. First reconcile authority and status in place, fix active broken links, close out stale plans, and audit worktree ownership. Only then execute small, reviewable archive/removal PRs.

# 2. Repository Classification

```yaml
repository:
  name: responseos
  primary_purpose: AI revenue-recovery product and operating platform for service businesses
  secondary_purposes:
    - public marketing and pricing surface
    - internal operator console
    - tenant-scoped client portal
    - mock-safe product demonstration
    - API and webhook substrate
    - product, GTM, readiness, and operations documentation
    - build-progress dashboard
  repo_type:
    - product
    - platform
    - website
    - API
    - internal-tool
    - data-system
    - hybrid
  maturity: pre-production foundation; v0.2 shipped, v0.3 staged/gated, controlled demo scaffolded, paying-pilot readiness explicitly blocked
  primary_users:
    - AJ Digital operators and developers
    - Codex, Claude, and other governed agents
    - future tenant client_admin and client_viewer users
    - public prospects using marketing/audit/demo surfaces
  deployment_target:
    application: Vercel preview/staging scaffold
    database: Neon-hosted Postgres target; Postgres 16 locally and in CI
    authentication: Clerk
    production: not authorized
```

Classification rationale:

- **Product/platform:** The repository owns domain models, tenant data, operator/client surfaces, workflows, and provider architecture—not only a marketing site.
- **Website:** `app/(marketing)` and `app/(demo)` are public-facing Next.js surfaces.
- **API/data-system:** `app/api`, `prisma`, `lib/data`, and the event/webhook substrate are first-class.
- **Internal tool:** The operator console and progress dashboard primarily serve AJ Digital operations.
- **Hybrid:** Product code, commercial positioning, deployment governance, and research intentionally coexist. That is defensible, but it requires stricter authority labels than a code-only repository.

# 3. Current Structure

## Root map

| Path | Current role | Assessment |
|---|---|---|
| `app/` | Next.js App Router surfaces and route handlers | KEEP; clear route groups for admin, client, demo, marketing, and API |
| `components/` | Shared layout/UI modules plus empty planned feature directories | KEEP implemented modules; investigate empty placeholders |
| `lib/` | Auth, data access, DB, mocks, providers, revenue/scoring, validation | KEEP; strongest runtime locality is in tenant/data policy |
| `prisma/` | Schema, eight migrations, deterministic seed | KEEP; implementation source of truth for persistence |
| `tests/` | Factories, unit and integration suites; empty E2E directory | KEEP; E2E gap remains |
| `scripts/` | OG generation, minimatch compatibility patch, dashboard sync | KEEP; small and purpose-specific |
| `public/` | Brand/demo assets, OG image, background variants, default Next assets | INVESTIGATE unreferenced variants/default assets |
| `dashboard/` | Self-contained progress board and JSON source | KEEP, but reconcile live-state ownership and merge churn |
| `docs/` | 101 files / 97 Markdown files before this report; about 1.4 MB | KEEP structure; consolidate authority and archive stale execution material |
| `.github/workflows/` | CI, dashboard sync/optional Pages, manual staging deploy | KEEP; no production workflow found |
| `README.md` | Human entry point | KEEP; add workflow/active-work pointer after governance approval |
| `AGENTS.md` | Repository agent contract | CANONICAL operating instructions |
| `CLAUDE.md` | One-line pointer to `AGENTS.md` | KEEP; good single-contract pattern |
| `.env.example` | Placeholder environment inventory | KEEP; no non-placeholder suspects found |
| `doppler.yaml` | Opt-in secret-injection project/config metadata | KEEP; contains no secret values |
| `package.json` / lockfile | Runtime/toolchain/dependency contract | KEEP |
| `vercel.json` | Disables Git deployment for `master` | KEEP; production containment |

## Application map

- `app/(admin)`: internal operator console.
- `app/(client)`: tenant-scoped client portal.
- `app/(demo)`: deterministic, mock-safe walkthrough.
- `app/(marketing)`: landing, audit, pricing, trust, industries, and demo entry.
- `app/api`: accounts, calls, leads, appointments, quotes, contacts, reports, notifications, auth, automations, audit capture, and provider webhooks.

## Runtime module map

- `lib/auth`: Clerk session, route protection, webhook sync, and fail-closed auth gate.
- `lib/data`: tenant-aware mock/Prisma accessors and result handling.
- `lib/db`: lazy Prisma client selection.
- `lib/mock`: deterministic fallback fixtures.
- `lib/providers`: encryption, webhook helpers, and a single mock voice adapter; many provider-specific directories are empty placeholders.
- `lib/validation`: Zod schemas for several domain inputs.
- `lib/revenue` and `lib/scoring`: calculation modules; revenue helpers currently have no runtime/test imports.

## Documentation map

- Root operational docs: PRD, roadmap, decisions, architecture, API, data, automation, environment, security, deployment, design, changelog, commercial docs.
- `architecture/`: eight detailed `RESPONSEOS_*` go-forward specs.
- `product/`: 31 product, implementation, prompt, demo, readiness, and GTM files.
- `ops/`: deployment, observability, QA, runbook, security/compliance, and staging operations.
- `governance/`: draft constitution, gates, risk/traceability/worktree plans, and a now-partially-completed remediation plan.
- `quality/`: draft acceptance, performance, and failure-mode baselines.
- `readiness/`: current-state, critical-path, demo, serviceability, and pilot-readiness assessments.
- `brand/`: canonical positioning/voice plus sales/copy supporting material.
- `research/`: market, competitor, naming, Web3, and communications-stack source material.
- `reference/`: documentation map, glossary, questions, and coding standards.
- `archive/`: three shipped v0.2 briefs; too small relative to the amount of shipped execution material still outside it.

# 4. Current Sources of Truth

Status vocabulary in this table is intentionally limited to the requested labels.

| Concern | Current source(s) | Status | Finding |
|---|---|---|---|
| Product definition | `docs/PRD.md` | CANONICAL | Declared short operational PRD |
| Expanded product detail | `docs/product/RESPONSEOS_PRD.md`, `docs/product-spec.md` | LIKELY CANONICAL / DUPLICATE | Useful companions, but overlap and contain superseded wording |
| Architecture decisions | `docs/DECISIONS.md` | CANONICAL | Accepted/superseded ADR source; monolithic and increasingly hard to scan |
| Architecture overview | `docs/architecture.md` | CANONICAL | Operational entry point, but some present-tense data-flow claims exceed runtime |
| Detailed architecture | `docs/architecture/RESPONSEOS_*.md` | CONFLICTING | Files self-label as canonical while authority index labels them supporting |
| Build-source index | `docs/product/RESPONSEOS_BUILD_SOURCE.md` | CONFLICTING | Calls itself canonical source-of-truth index, but `docs/README.md` says it cannot override PRD/roadmap/decisions |
| Technical implementation | `app/`, `lib/`, `prisma/`, `types/`, `package.json` | CANONICAL | Executable code/schema wins over prose descriptions of shipped behavior |
| Database schema | `prisma/schema.prisma`, `prisma/migrations/**` | CANONICAL | `docs/data-schema.md` is the human companion |
| API contracts | `docs/api-spec.md` plus actual route handlers | CONFLICTING | Canonical envelope is useful, but health version and some planned/current distinctions drift |
| Environment inventory | `.env.example`, `docs/env-spec.md` | LIKELY CANONICAL | `.env.example` is executable inventory; env spec includes broader planning context |
| Deployment policy | `vercel.json`, workflows, `docs/DEPLOYMENT.md` | CANONICAL / LIKELY CANONICAL | Config is enforcement; docs define intended lanes and rollback |
| Expanded deployment | `docs/ops/RESPONSEOS_DEPLOYMENT_PLAN.md` | CONFLICTING | Self-labels canonical while root deployment doc remains operational authority |
| Roadmap/milestones | `docs/ROADMAP.md` | CANONICAL | Explicit single forward source |
| Active work | dashboard JSON, live GitHub issues/PRs | CONFLICTING | Dashboard is declared source, but checked-out snapshot is stale against live merged PRs |
| Requirements | PRD, roadmap, decisions, task-specific accepted briefs | LIKELY CANONICAL | No single traceable approved requirements matrix yet; current matrix is draft |
| GTM positioning | `docs/brand/RESPONSEOS_POSITIONING.md`, ADR-0022 | CANONICAL | Commercial narrative still competes with Revenue Recovery vs Business Memory framings |
| Pricing model | ADR-0028 | CANONICAL | Structure accepted; specific prices remain open and v0.5 billing-gated |
| ICP | `docs/PRD.md`, market research | CANONICAL / LIKELY CANONICAL | PRD is authority; research is input, not decision |
| RECOVER workflows | `docs/automation-flows.md` | CANONICAL | Clear workflow home |
| SOPs/runbooks | `docs/ops/RESPONSEOS_RUNBOOK.md` and external Obsidian authoring | CONFLICTING | Repo says mirrored copy is canonical while source content is authored elsewhere; sync mechanism is not evident |
| Agent instructions | `AGENTS.md`; `CLAUDE.md` pointer | CANONICAL | Coherent and non-duplicative |
| Build instructions | `package.json`, `README.md`, CI workflow | CANONICAL | Toolchain and validation are explicit |
| Release process | AGENTS PR policy, roadmap, changelog, deployment docs | UNKNOWN | Pieces exist, but no single approved release/closeout flow |

## Authority conflict that should be resolved first

The existing authority order is sensible:

1. `AGENTS.md` for operating rules.
2. `docs/DECISIONS.md` for accepted decisions.
3. `docs/PRD.md` for product scope.
4. `docs/ROADMAP.md` for milestone state.
5. Executable code/config for implemented behavior.
6. Supporting architecture/product/ops docs for detail.

The problem is not the order; it is that supporting files use “canonical” language that contradicts it. Reconcile labels before moving any documents.

# 5. Repository Hygiene Findings

| Classification | Evidence | Recommendation |
|---|---|---|
| KEEP | Root contains only entry docs, runtime/config files, and purposeful directories | Do not perform broad root cleanup |
| KEEP | `app` route groups and `lib/data` organization are discoverable | Preserve current runtime layout |
| KEEP | `AGENTS.md` plus one-line `CLAUDE.md` pointer | Maintain a single local instruction contract |
| KEEP | Prisma migrations and seed are ordered and explicit | Continue append-only migration discipline |
| CONSOLIDATE | `docs/README.md`, `DOCUMENTATION_INDEX.md`, and `RESPONSEOS_BUILD_SOURCE.md` all map documentation and authority | Choose one approved navigation/authority map; make others supporting or historical |
| CONSOLIDATE | Short/expanded PRD and roadmap pairs | Keep short operational entry points; remove duplicate status claims from companions |
| CONSOLIDATE | Domain contracts repeat across Prisma, TypeScript, Zod, and data mappers | Define one runtime-validation seam and generated/derived mappings where justified |
| CONSOLIDATE | `/api/webhooks/n8n` and `/api/automations/webhook/n8n` are near-identical acknowledgements | Decide ownership/compatibility before deprecating one route |
| MOVE | Shipped v0.2 execution prompts/plans remain under active `docs/product/` | Move to archive only after cross-reference review |
| ARCHIVE | `docs/governance/RESPONSEOS_DOCUMENTATION_REMEDIATION_PLAN.md` describes gates as missing although they now exist | Close out outcomes, then archive the plan |
| ARCHIVE | `docs/GTM_GAP_AND_DEPLOYMENT_PLAN.md` claims no hosted-deploy artifact although a manual staging workflow and runbook now exist | Preserve as dated assessment after a current replacement is approved |
| ARCHIVE | Completed `RESPONSEOS_EXEC_0*` prompts and shipped v0.2 implementation plans | Move to an execution-history archive if no active branch still depends on them |
| DEPRECATE | `lib/providers/voice/*` has one mock adapter and no runtime consumer | Keep only if an approved near-term task needs it; otherwise mark dormant before removal |
| DEPRECATE | Empty provider/feature directories communicate unimplemented architecture as if present | Remove placeholders when they do not protect an approved destination |
| DELETE-CANDIDATE | Redundant `.gitkeep` files in directories that already contain tracked files (`components/layout`, `components/ui`, `tests/unit`, `tests/integration`, `prisma/migrations`) | Safe mechanical cleanup after approval |
| DELETE-CANDIDATE | Default Next public assets (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) have no filename references | Verify browser/CSS usage, then remove in a small asset PR |
| INVESTIGATE | 55 of 66 public assets had no filename reference, mostly generated background size variants/contact sheet | Treat the scan as a candidate list; confirm design/export purpose before removal |
| INVESTIGATE | `RESPONSEOS_WEB3_BLOCKCHAIN_OPPORTUNITY_RESEARCH.md` is large and outside current gated roadmap | Decide whether it is current research, deferred opportunity, or archive material |
| INVESTIGATE | `lib/revenue/calculateRecoveredRevenue.ts` and `calculateRoiMultiple.ts` have no runtime/test imports | Confirm planned use or deprecate; architecture docs currently imply active aggregation |
| INVESTIGATE | `@vitest/coverage-v8` is installed but no coverage command/threshold is exposed | Either operationalize coverage or remove the dependency after verification |

## Duplicate and generated-file findings

- No exact duplicate non-empty files were found.
- Exact duplicates were limited to empty `.gitkeep` files.
- No committed `.next`, `node_modules`, coverage, or local `.env` files were found.
- `package-lock.json`, generated OG media, and the dashboard are intentional committed artifacts.
- `docs/CHANGELOG.md` is about 116 KB and contains many repeated “Unreleased” sections. It remains useful provenance, but future cleanup should normalize release headings or split historical entries without losing PR history.

## Broken-link findings

A basic relative Markdown-link check found 27 broken candidates: nine in active docs and 18 in archive docs. Active candidates include:

- A bad relative link in `docs/DECISIONS.md` to a v0.2 implementation plan.
- Several repo-root paths in `docs/GTM_GAP_AND_DEPLOYMENT_PLAN.md` written as if they were relative to the repository root; from `docs/`, they resolve incorrectly.
- Parentheses in `app/(marketing)` paths that break simplistic Markdown parsing and may also break rendered links unless encoded.

Archive links may remain stale for provenance, but active entry-point links should be fixed and checked in CI.

# 6. Git / Branch / Worktree Assessment

```yaml
git:
  current_branch: codex/repository-assessment
  assessment_start_state: detached HEAD at 610d13a
  worktree_status: clean before report creation
  default_branch: master
  upstream_snapshot: origin/master at 2175d60
  divergence_from_origin_master: 1 ahead, 6 behind
  branch_naming_pattern: mixed human, tool, and agent prefixes
  active_branch_patterns:
    - feat/*
    - gtm/*
    - cursor/*
    - claude/*
  likely_cleanup_candidate_patterns:
    - merged PR worktrees retained after squash merge
    - detached app/agent worktrees at ancestor commits
    - local pr<number> aliases
    - preservation branches, only after recovery-purpose review
```

## Current facts

- Sixteen worktrees are registered.
- Fifteen were clean; detached worktree `...\.codex\worktrees\7d63\responseos` was dirty.
- `git worktree prune --dry-run --verbose` found no automatically prunable entries.
- Multiple clean worktrees map to merged PRs (#94, #98, #103, #105, #108, #110). Because squash merges make branch heads non-ancestors of `master`, ancestry alone cannot authorize deletion.
- Four live PRs were open: #107 and #114 were draft/dirty against base; #115 was ready/clean; #116 was draft/clean at inspection time.
- The repository uses `master`, not `main`. Existing documentation consistently treats `master` as default.

## Assessment

The repository has a documented worktree model, but it is a draft and is not closing the loop operationally. The number of retained worktrees, detached copies, local alias branches, and stale dashboard entries makes “what is active?” expensive to answer. The dirty detached worktree is a hard stop for blanket cleanup.

No branch or worktree should be deleted from this assessment. A separate cleanup audit must map each item to:

- owner and purpose,
- clean/dirty state,
- open/merged/closed PR,
- unique commits or untracked work,
- recovery/preservation role,
- approved disposition.

# 7. Documentation Assessment

## What works

- The README explains purpose, status, stack, setup, validation, environment policy, and hard constraints within five minutes.
- `docs/README.md` gives broad navigation.
- PRD, roadmap, decisions, security, deployment, API, data, and architecture entry points exist.
- Research docs generally label draft/assumption/legal-risk posture.
- Historical v0.2 briefs are already separated into an archive.
- The repo has explicit definitions of ready/done/stable, a risk register, worktree plan, and traceability matrix, even though they remain draft.

## What does not work

- The remediation plan still lists those governance artifacts as missing; its lifecycle was not closed after they were created.
- Several supporting documents self-label “canonical,” contradicting the authority index.
- Status banners are not uniform: “canonical,” “go-forward,” “planning,” “draft,” “supporting,” “current,” and “operational” overlap without one enforced meaning.
- Present-tense architecture text describes event-ledger ingest, call/lead creation, notification dispatch, and revenue aggregation that the checked-out routes do not perform.
- `docs/api-spec.md` reports health version `0.1.0`; code and package report `0.2.0`.
- `RESPONSEOS_MODULE_BOUNDARIES.md` says `lib/providers/voice` is absent and later says it is present.
- Product/readiness/GTM documents retain dated blockers after the associated docs/workflows merged.
- The archive contains only three files despite many shipped execution prompts and v0.2 plans remaining in active product folders.

## Documentation architecture decision

Do not create every proposed folder. The current top-level categories are already sufficient. The high-leverage change is lifecycle and authority, not nesting.

Recommended model:

1. **Operational authority:** `AGENTS.md`, PRD, roadmap, decisions, code/config.
2. **Domain specifications:** architecture, API, data, security, deployment, product details.
3. **Active planning/evidence:** readiness, governance, quality, research, and approved task briefs, each with owner/status/evidence date.
4. **Historical:** shipped briefs, superseded plans, closed assessments, and obsolete prompts under `docs/archive/`.

Every non-authority planning/research/assessment doc should carry:

```yaml
status: draft | proposed | accepted | superseded | historical
owner:
evidence_as_of:
authority:
superseded_by:
implementation_authorized: false
```

Use only the fields that apply; do not add frontmatter theater to stable reference docs.

# 8. Agent Workflow Assessment

| Question | Current answerability | Evidence |
|---|---|---|
| What does this repository do? | PASS | Root README and PRD |
| What am I allowed to change? | PASS | `AGENTS.md` hard rules and scope discipline |
| What branch am I on? | PASS with command | Not surfaced in docs/task state |
| Am I inside a worktree? | PASS with command | Draft worktree plan gives inspection commands |
| What initiative am I working on? | FAIL | No task manifest binds branch/worktree to one initiative |
| What phase is the initiative in? | PARTIAL | Dashboard/roadmap exist, but snapshot can be stale |
| Where do findings belong? | PARTIAL | Readiness/research/governance folders exist; no intake rule |
| Where do specs belong? | PARTIAL | Product/architecture folders exist, but many spec types overlap |
| Where do implementation changes belong? | PASS | Runtime layout is clear |
| What requires human approval? | PARTIAL | Hard product/deploy gates are clear; draft governance holds broader approval matrix |
| How must work be validated? | PASS | README, AGENTS, and CI agree |
| What must happen before merge? | PASS | Draft PR, green CI, human merge policy |

## Proposed lightweight agent operating contract

Create one approved command-center document only if it replaces—not duplicates—current draft governance. Recommended route: promote/rename the useful operational content in `PROJECT_CONSTITUTION.md` and fold in the approved worktree lifecycle as `docs/WORKFLOW.md`. Keep definitions of ready/done/stable as linked supporting gates.

The command center should contain:

1. Purpose and authority order.
2. Request → discovery → assessment → decision → spec → implementation → QA → PR → merge → closeout flow.
3. Branch/worktree decision rules.
4. Initiative/task ownership and status location.
5. Validation by change type.
6. Approval matrix.
7. Draft PR and human merge rules.
8. Dashboard/changelog/document closeout.
9. Worktree/branch cleanup gates.

## Proposed startup check

```yaml
repository:
  name: responseos
  purpose: AI revenue-recovery product/platform

task:
  objective:
  task_type: inspect | assessment | docs | feature | fix | test | chore | spike
  authority_source:
  acceptance_criteria:

git:
  branch:
  base_commit:
  default_branch: master
  worktree_path:
  worktree_managed_by: human | codex | claude | other
  clean_status:
  divergence_from_origin_master:

initiative:
  name:
  phase: proposed | discovery | assessment | decision | approved | implementation | validation | complete | archived
  dashboard_or_issue_ref:

permissions:
  inspect: true
  write: false
  commit: false
  push: false
  create_pr: false
  merge: false
  deploy: false
  delete: false

validation_required:
  - lint
  - typecheck
  - unit
  - build
  - integration_when_runtime_or_data_changes

human_approval_required:
  - canonical source changes
  - public copy or price changes
  - live providers
  - secrets or client data
  - production infrastructure or deploy
  - dependency removal
  - architecture rewrite
  - merge
  - destructive cleanup
```

The startup check should be recorded in an issue/task/PR description, not committed as a new file per task.

## Initiative architecture

Use initiatives only for multi-PR, multi-agent, high-risk, or decision-heavy work. Do not require eight documents for a minor fix.

- Minor task: issue/task + PR description + code/tests/docs.
- Medium task: one approved brief containing assessment, decision, scope, plan, validation, and closeout sections.
- Major initiative: a folder or linked document set with separate decision/spec/validation artifacts only when concurrent work justifies it.
- Dashboard/GitHub owns active status; durable docs own decisions and evidence. Do not make both editable progress sources.

# 9. Testing & QA Assessment

## Existing gates

- ESLint.
- TypeScript `--noEmit`.
- Vitest unit tests.
- Vitest integration tests against Postgres 16.
- Production build.
- Prisma migration diff/deploy/seed in CI.
- `npm audit --audit-level=high` in both CI jobs.

## Strengths

- Integration suites cover data access, tenant isolation, mock parity, seed determinism, and audit logs.
- Tenant policy is concentrated in `lib/data/session-helpers.ts`, giving tests a meaningful interface.
- CI performs a DB-backed build after migration and seed.
- Mock-first operation enables most validation without live provider secrets.

## Gaps

- `tests/e2e/` is empty and there is no `test:e2e` script.
- Mutation handlers for lead qualification/status, notifications, calendar sync, and non-Clerk webhooks are not directly tested.
- App routes, scoring, and provider helpers are excluded from coverage configuration.
- No coverage threshold is configured.
- `@vitest/coverage-v8` is present but coverage is not operationalized through package scripts.
- Runtime validation schemas exist, but several handlers cast parsed JSON rather than crossing the validation seam.
- Manual acceptance testing is documented but not tied to a release evidence artifact.
- Security checks do not include a repository secret scan, SAST, dependency-license review, or documentation link validation.

## Minimum merge gate

Keep the existing full runtime gate for code/config/dependency/schema changes:

```text
npm ci
npm audit --audit-level=high
npx prisma generate
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration
```

Add incrementally:

1. Markdown relative-link validation for active docs.
2. Secret scanning on full diff/history appropriate to CI.
3. Focused route-handler tests for mutation/webhook seams.
4. One Playwright E2E smoke covering public audit/demo and authenticated tenant isolation before staging/pilot claims.
5. Coverage reporting and thresholds only after the current scope is measured; do not invent arbitrary percentages.

Documentation-only PRs may use a lighter local check, but the protected-branch CI policy can remain full until path-scoped validation is explicitly designed.

# 10. CI/CD Assessment

## Current model

- `ci.yml`: runs validate and Postgres integration jobs on push and PR.
- `dashboard.yml`: syncs dashboard state to an automation branch/PR and optionally publishes GitHub Pages when `ENABLE_PAGES=true`.
- `deploy-staging.yml`: manual `workflow_dispatch`, requires typed `staging` confirmation, targets a protected `staging` environment, migrates DB unless skipped, and deploys a Vercel preview/prebuilt candidate.
- `vercel.json`: disables Git deployment for `master`.
- No production deployment job was found.

## Boundaries and risks

- Production is appropriately gated in documentation and workflow design.
- The staging workflow can mutate a staging database and create a Vercel deployment after environment approval; it must remain a separate authorization from merge.
- `skip_migrate` is a deliberate operator escape hatch and should require justification in the run record.
- Project-level Vercel settings, environment reviewers, live secrets, aliases, and rollback readiness were not verified in this repository assessment.
- Optional dashboard Pages publishing is an external effect. The PR guard is present, but enabling Pages remains an operator decision.
- `vercel.json` controls the checked-in Git behavior for `master`; it does not by itself prove all provider-side deployment settings.
- Rollback strategy is documented, but no rollback drill evidence was found.

## Deployment maturity finding

The repository has a staging deployment scaffold, not verified staging readiness and not production readiness. A successful build, preview, or workflow definition must not be treated as a paying-pilot activation gate.

# 11. Security & Secrets Findings

## Secret hygiene

- Tracked environment-like files are limited to `.env.example` and `docs/env-spec.md`.
- `.env.example` contains 32 assignments and no non-placeholder suspects from the assessment heuristic.
- High-signal pattern matches were limited to fixed local Postgres test credentials in CI, README, archive docs, and tests. These are development fixtures, not identified secrets.
- `.gitignore` excludes `.env*` except examples/templates, `.doppler/`, fallback files, `.vercel`, private-key files, and generated outputs.
- `doppler.yaml` contains project/config metadata only.
- No high-signal AWS, GitHub, OpenAI, or private-key pattern was found in tracked working-tree files.

Risk classification: **Low for the checked-out working tree; UNKNOWN for full Git history and external secret stores.**

Required remediation:

- Add a real secret scanner in CI before claiming repository-wide secret cleanliness.
- If any future scan finds a committed credential, rotate/revoke first, then remove history with explicit approval.
- Never print value-bearing environment files in logs or reports.

## Application security

- Tenant isolation has strong accessor-level locality and substantial unit/integration coverage.
- Clerk webhook verification is implemented.
- Non-Clerk provider webhooks remain parse-and-ack mocks with no signature verification or business mutation. This is acceptable only while the live-provider gate remains closed.
- `safeJson<T>` casts parsed JSON to a generic type without runtime validation; handlers can bypass existing Zod modules.
- Transcript rows store `retention_lane` and `expires_at`, but the public select returns `inline_text` without an evident retention/expiry enforcement point. This is a P1 privacy-readiness gap before real transcripts.
- ResponseOS must continue to be described as not HIPAA-certified.

# 12. Structural Debt

| ID | Finding | Evidence | Impact | Confidence | Recommended action | Risk | Effort | Priority |
|---|---|---|---|---|---|---|---|---|
| SD-01 | Supporting docs make conflicting canonical claims | FACT: docs index vs `RESPONSEOS_BUILD_SOURCE`/architecture status banners | Agents can implement superseded direction | High | Approve one authority map and relabel supporting docs | Medium | M | P1 |
| SD-02 | Current branch is not current default branch | FACT: 1 ahead / 6 behind `origin/master` | Assessment/implementation may omit merged behavior | High | Require base/divergence in startup check; reconcile before PR | Medium | S | P1 |
| SD-03 | Dashboard snapshot is stale against merged PRs | FACT: G-01–G-05 still Review/open though PRs #89–#93 merged | Active-work truth is unreliable | High | Separate human task intent from generated GitHub state; refresh through bot PR | Medium | M | P1 |
| SD-04 | Worktree estate lacks closeout | FACT: 16 registered, one dirty, many tied to merged PRs | Cognitive load and accidental edits | High | Run a separate ownership/PR/unique-commit cleanup audit | High | M | P1 |
| SD-05 | Completed remediation plan remains active | FACT: plan says governance docs are missing although present | Future agents repeat shipped work | High | Add closeout and archive after approval | Low | S | P1 |
| SD-06 | Specs describe runtime behavior that is not wired | FACT: present-tense ledger/route/provider claims differ from code | Readiness overstatement and wrong implementation assumptions | High | Reconcile docs to current/planned status | Medium | M | P1 |
| SD-07 | Webhook ingress lacks runtime validation/signature/ledger flow outside Clerk | FACT: non-Clerk routes use `safeJson` + `ackWebhook` | Unsafe if live gate is opened prematurely | High | Define validated ingress module and tests before live authorization | High | M | P1 |
| SD-08 | Transcript retention metadata is not enforced on reads | FACT: `PUBLIC_SELECT` includes `inline_text`; no expiry/lane check evident | Privacy/retention promises could be false | High | Specify enforcement point and negative tests before real data | High | M | P1 |
| SD-09 | Domain contracts repeat across Prisma, TS, Zod, and route-local types | FACT | Schema changes can drift silently | High | Consolidate at runtime validation/mapping seams | Medium | M | P1 |
| SD-10 | Mock/Prisma selection policy repeats across ~21 data modules | FACT | Changing fallback semantics is cross-cutting | Medium-high | Evaluate one internal adapter-resolution policy while preserving deep domain modules | Medium | M | P2 |
| SD-11 | Voice provider seam is hypothetical | FACT: one mock adapter, test-only consumer | Extra interface surface suggests false maturity | High | Mark dormant or remove after roadmap decision | Low | S | P2 |
| SD-12 | No E2E suite or route-mutation coverage | FACT | User flows and ingress contracts can regress | High | Add focused E2E and handler tests before staging/pilot | Medium | M | P1 |
| SD-13 | Coverage tooling is installed but not governed | FACT | Test blind spots are not measured | High | Add measured coverage workflow or remove unused package | Low | S | P2 |
| SD-14 | Active docs have broken relative links | FACT: nine active candidates | Five-minute navigation fails | High | Add link check and repair active docs | Low | S | P1 |
| SD-15 | Archive is underused | INFERENCE from shipped prompts/plans outside archive | Search results mix active and historical instructions | High | Archive in small thematic batches with reference updates | Low | M | P1 |
| SD-16 | Public asset variants/default icons appear unreferenced | INFERENCE from filename-reference scan | Asset noise and uncertain ownership | Medium | Produce visual/use inventory before deletion | Low | S | P2 |
| SD-17 | Release/closeout process is distributed | FACT | Merge may not trigger docs/dashboard/worktree closure consistently | High | Add one command-center closeout checklist | Medium | S | P1 |
| SD-18 | Full-history secret scanning is absent from CI | FACT | Working-tree scan cannot rule out historical exposure | High | Add approved secret scanning and response runbook | Medium | M | P1 |
| SD-19 | Dependency baseline is secure but exact toolchain is hard to reproduce in this environment | FACT: audit zero; exact engine mismatch blocked install | Local checks can be falsely interpreted | High | Provide supported Node acquisition/bootstrap check and fail-fast version command | Medium | S | P1 |

No P0 issue was proven in the checked-out, mock-gated, non-production state. Several P1 items become P0 before enabling real provider traffic or customer data.

# 13. Recommended Target Architecture

The target should remain close to the current tree:

```text
responseos/
├── app/                         # Next.js surfaces and route handlers
├── components/                  # implemented shared UI only
├── lib/
│   ├── auth/
│   ├── data/                    # deep tenant-aware domain modules
│   ├── db/
│   ├── mock/
│   ├── providers/               # only real seams/adapters or approved dormant scaffolds
│   ├── revenue/
│   ├── scoring/
│   └── validation/
├── prisma/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/                     # activate before pilot readiness
├── scripts/
├── public/
├── dashboard/
├── docs/
│   ├── README.md                # approved authority/navigation map
│   ├── WORKFLOW.md              # proposed command center; only if it replaces draft overlap
│   ├── PRD.md
│   ├── ROADMAP.md
│   ├── DECISIONS.md             # retain until ADR-structure decision is approved
│   ├── architecture.md
│   ├── api-spec.md
│   ├── data-schema.md
│   ├── SECURITY.md
│   ├── DEPLOYMENT.md
│   ├── architecture/
│   ├── brand/
│   ├── governance/
│   ├── ops/
│   ├── product/
│   ├── quality/
│   ├── readiness/
│   ├── reference/
│   ├── research/
│   └── archive/
├── .github/workflows/
├── AGENTS.md
├── CLAUDE.md
├── README.md
└── runtime/config manifests
```

Key point: this is a **status-and-lifecycle cleanup**, not a directory rewrite. Do not rename `ops` to `operations`, split the application into packages, or move every root doc merely for symmetry.

## Runtime deepening priorities

1. Preserve the deep tenant policy and result modules; they provide leverage and locality.
2. Replace route-level typed casts with runtime validation at the ingress seam.
3. Define one provider-event ingest module that verifies, validates, records the ledger event, and only then dispatches business mutation.
4. Introduce/retain provider adapters only when a second adapter or real runtime variation exists.
5. Centralize mock-vs-Prisma adapter resolution only if it reduces repeated policy without exposing a larger interface.

# 14. Proposed Branch Taxonomy

Use a small type-first taxonomy for human-managed repository branches:

```text
feat/<scope>
fix/<scope>
docs/<scope>
test/<scope>
chore/<scope>
spike/<scope>
release/<version>        # only when a governed release process exists
```

Rules:

- Put domain in the scope: `docs/readiness-audit`, `feat/v0.3-cal-mocks`, `fix/webhook-validation`.
- Do not add separate `research/`, `assessment/`, `architecture/`, `gtm-audit/`, `client/`, and `remediation/` top-level types unless branch discovery proves they are repeatedly needed. Use `docs/<domain>-<scope>` or `spike/<scope>`.
- Client-specific branches are inappropriate unless material is sanitized and explicitly authorized; ResponseOS remains multi-tenant/product-level.
- Tool-managed Codex branches may require `codex/`; include the task type in the slug where possible, such as `codex/docs-repository-assessment`.
- Avoid vague `cleanup`, `updates`, and agent-random-name branches except temporary tool internals.
- Preservation branches are a separate recovery class: date, purpose, owner, and deletion gate must be explicit.

# 15. Proposed Worktree Policy

## Decision rule

```text
READ ONLY
→ worktree optional

CREATES DURABLE FILES OR COMMITS
→ worktree recommended

PARALLEL WORK
→ worktree required

LARGE, HIGH-RISK, OR DIRTY-BASE CHANGE
→ worktree required
```

## Creation

- Start from the exact approved base, normally latest `origin/master`.
- Record branch, base SHA, owner, task/issue, expected PR, and approval scope.
- Human-managed path: retain the existing convention `C:\dev\responseos-<short-purpose>`.
- Tool-managed paths may remain under the tool's worktree root; the branch/task record, not the path, is the durable identity.
- Never create a second worktree simply to organize documents permanently.

## Lifecycle

```text
CREATE → WORK → VALIDATE → COMMIT → PUSH → DRAFT PR
→ REVIEW → READY → HUMAN MERGE → VERIFY → CLOSEOUT
→ REMOVE WORKTREE → DELETE BRANCH WHEN APPROPRIATE
```

## Cleanup gate

Before removal or branch deletion:

1. Worktree is clean.
2. No untracked/ignored work needs preservation.
3. PR is merged, closed, or explicitly abandoned.
4. Unique commits are merged, archived, or intentionally abandoned.
5. Dashboard/issue/changelog/docs are closed out.
6. Post-merge behavior is verified where applicable.
7. Human approval is recorded for destructive cleanup.

## When not to use a worktree

- One-off read-only inspection.
- A small change in an already clean, correct, task-owned feature worktree.
- As a substitute for branches, docs categories, backups, or long-term project folders.

# 16. Proposed Documentation Model

## Authority tiers

| Tier | Purpose | Examples |
|---|---|---|
| 0 | Operating and accepted authority | `AGENTS.md`, `DECISIONS.md`, PRD, roadmap |
| 1 | Implemented truth | code, schema, migrations, package scripts, workflows, config |
| 2 | Current domain specification | architecture, API, data, security, deployment, brand |
| 3 | Approved plans and evidence | implementation brief, readiness assessment, QA plan, research |
| 4 | Historical provenance | archive, superseded plans, shipped prompts, closed assessments |

Rules:

- A lower tier cannot silently override a higher tier.
- “Canonical” is reserved for Tier 0 or explicitly named Tier 2 authorities.
- Plans must state whether they authorize implementation. Default is no.
- Research must distinguish FACT, INFERENCE, ASSUMPTION, HYPOTHESIS, and UNKNOWN.
- Accepted decisions move into ADR authority; research does not become a requirement automatically.
- Status and evidence date must be visible near the top of volatile documents.
- Archive preserves history but must not appear in “start here” navigation.

## ADR recommendation

Retain `docs/DECISIONS.md` for now. Splitting 39+ decisions into files would be high-churn and is already an explicit unresolved governance decision. First add an index/table of current accepted vs superseded decisions if scan cost continues to grow. Migrate to `docs/architecture/decisions/` only through an approved ADR with a link-preservation plan.

## GTM recommendation

GTM belongs in this repository because the repo owns public marketing, audit, demo, pricing, brand, and onboarding surfaces. Keep:

- Product/ICP authority in PRD.
- Positioning/voice in `docs/brand`.
- Pricing structure in accepted ADRs plus an approved commercial doc.
- Readiness evidence in `docs/readiness`.
- Research as non-authoritative input.

Do not store unsanitized client facts, private discovery evidence, credentials, or client vault content here. Do not create a new `docs/gtm/` folder until current commercial documents are classified and a real move list is approved.

# 17. Proposed Agent Operating Model

## Default roles

- **Human/Audio:** approves canonical strategy, public claims/pricing, live providers, secrets, merge, deploy, destructive cleanup, and production/customer activation.
- **Implementation agent:** works only within approved spec/scope, updates tests/docs/dashboard, and produces validation evidence.
- **Review/QA agent:** independently checks the exact branch/SHA and reports findings without mutating unless separately authorized.
- **Research agent:** produces evidence-labeled input; cannot promote findings to requirements or accepted architecture.

## Phase rules

```text
PROPOSED → DISCOVERY → ASSESSMENT → DECISION → APPROVED
→ IMPLEMENTATION → VALIDATION → COMPLETE → ARCHIVED
```

- Discovery/assessment may create durable reports when requested.
- Decision must name authority and unresolved questions.
- Approved means scope is authorized, not merge/deploy/live-provider authorization.
- Implementation, commit, push, PR, merge, deployment, activation, and deletion remain separate gates.
- Complete requires validation and documentation/dashboard closeout.
- Archived means active navigation no longer points to the task artifact as current instruction.

## Automation opportunities after the manual workflow stabilizes

- `repo-assess`: inventory, authority/status scan, link check, secret scan, branch/worktree snapshot.
- `start-task`: startup YAML, branch/worktree creation, dashboard/issue link.
- `validate`: change-aware local gate with exact runtime check.
- `close-task`: changelog/dashboard/docs/PR/worktree checklist.
- `worktree-audit`: clean/dirty, branch, PR, unique commits, preservation classification.

Do not automate deletion, merge, deploy, secret rotation, or canonical-document promotion.

# 18. File Operations Plan

No operation in this section is authorized by this report.

## CREATE

| Proposed operation | Destination | Gate |
|---|---|---|
| Create an approved command center only by consolidating existing draft operating content | `docs/WORKFLOW.md` | Human approval of governance authority; must not duplicate project constitution/worktree plan |
| Add active-doc link validation script/check | `scripts/` and CI | Review/testing |
| Add a secret-scanning CI check and response note | workflow/config + security docs | Security review |

## CONSOLIDATE

| Sources | Target outcome | Gate |
|---|---|---|
| `docs/README.md`, `docs/reference/DOCUMENTATION_INDEX.md`, `docs/product/RESPONSEOS_BUILD_SOURCE.md` | One authority/navigation map; others explicitly supporting/historical | Human canonicalization decision |
| `PROJECT_CONSTITUTION.md` + approved operational parts of `WORKTREE_PLAN.md` | `docs/WORKFLOW.md` command center | Human approval |
| Short/expanded PRD and roadmap status declarations | Short operational files own status; expanded docs own detail | Review + cross-link tests |
| Domain input types and Zod schemas | One validated ingress interface | Spec + tests |
| Duplicate n8n webhook acknowledgements | One owned route plus compatibility/deprecation decision | API review + tests |

## MOVE / ARCHIVE

| Source | Proposed destination | Gate |
|---|---|---|
| Completed governance remediation plan after closeout | `docs/archive/governance/` | Human review |
| Dated GTM gap/deployment assessment after a current replacement exists | `docs/archive/assessments/` | Human/public-copy review |
| Shipped `RESPONSEOS_EXEC_0*` prompts | `docs/archive/execution-prompts/` | Confirm no active worktree depends on them |
| Shipped v0.2 Clerk/remaining-model plans | `docs/archive/v0.2/` | Cross-reference validation |

Do not move the entire docs tree or rename major directories.

## RENAME

No major rename is recommended now. Specifically:

- Leave `master` unchanged.
- Leave `docs/ops` unchanged.
- Leave `docs/DECISIONS.md` unchanged until the ADR decision is approved.
- Do not impose numbered AJ Digital OS filenames without a separate canonicalization decision.

## DEPRECATE

| Candidate | Required decision |
|---|---|
| `lib/providers/voice/*` | Is the deferred gateway seam still a near-term approved module? |
| One of the n8n webhook paths | Which URL is public/compatible/canonical? |
| Stale “canonical” labels in supporting docs | Which authority map is approved? |
| Historical execution prompts in active navigation | Are any active branches still using them? |

## DELETE-CANDIDATE

| Candidate | Required verification |
|---|---|
| Redundant `.gitkeep` files in non-empty directories | Confirm directory contains tracked files |
| Empty feature/provider placeholder directories | Confirm no approved plan relies on path reservation |
| Default Next public SVG assets | Confirm no dynamic/CSS/browser reference |
| Unused background size variants/contact sheet | Visual/design asset inventory and approved retention set |
| Dormant revenue helpers | Confirm no dynamic or planned immediate caller; update misleading docs/tests |

## LEAVE

- Runtime top-level layout.
- Root entry/config files.
- `AGENTS.md` and `CLAUDE.md` pointer pattern.
- Prisma migrations and deterministic seed.
- Tenant-aware data modules and session/result modules.
- Existing mock-first safety gates.
- CI validation and integration jobs.
- Manual-only staging workflow and production containment.

# 19. Prioritized Migration Plan

## SAFE NOW

1. Review this report and accept/reject findings.
2. Fix active broken relative links in a docs-only PR.
3. Correct unambiguous implementation-status mismatches such as health version documentation.
4. Add explicit evidence dates/status labels to volatile assessments.
5. Refresh dashboard state through its existing automation PR path rather than hand-merging generated live state.

## REQUIRES REVIEW

1. Approve one documentation authority map and status vocabulary.
2. Close out the governance remediation plan against what actually shipped.
3. Reconcile present-tense architecture claims to current vs planned runtime.
4. Decide command-center approach (`WORKFLOW.md` as consolidation, not addition).
5. Classify shipped prompts/plans and research for archive/current/deferred state.
6. Decide the canonical n8n webhook route.

## REQUIRES TESTING

1. Runtime-validation ingress change for mutation routes.
2. Provider-event verify → validate → ledger → dispatch module.
3. Transcript retention/expiry enforcement.
4. Mock/Prisma resolver consolidation.
5. E2E smoke suite and route-handler tests.
6. Dependency cleanup and coverage-tool decision.
7. Any asset removal that might affect design or metadata.

## REQUIRES HUMAN APPROVAL

1. Canonical documentation hierarchy changes.
2. Public positioning, ICP, offer, or pricing changes.
3. Moving or archiving documents still referenced by active work.
4. Branch/worktree cleanup.
5. ADR storage migration.
6. Adding/removing dependencies.
7. Changing deployment, secrets, or GitHub environment settings.

## DESTRUCTIVE / HIGH-RISK

1. Deleting dirty worktrees or branches with unique commits.
2. Removing preservation branches/recovery artifacts.
3. Rewriting Git history for secret remediation.
4. Production/staging database mutation outside an approved deploy/migration run.
5. Activating live provider traffic before validation/signature/tenant/retention gates.
6. Bulk documentation moves without link/reference automation and rollback.

## Recommended sequence

### Migration 1 — Authority and truth labels

- Approve authority order.
- Correct conflicting canonical labels.
- Fix active links and obvious current/planned status errors.
- Validation: Markdown links, JSON parse, existing docs review; no runtime behavior changes.

### Migration 2 — Governance closeout and command center

- Close the completed remediation plan.
- Approve worktree/DoR/DoD/DoS ownership.
- Consolidate a concise workflow command center.
- Validation: agent startup dry run against a real task.

### Migration 3 — Archive shipped instructions

- Move only clearly shipped/superseded prompts and plans.
- Update all active cross-references in the same PR.
- Validation: active-doc link check and search for old paths.

### Migration 4 — Worktree/branch estate review

- Inventory each of 16 worktrees.
- Preserve dirty/unique work.
- Request explicit cleanup approval with exact targets and rollback.
- Execute removal only in a later authorized phase.

### Migration 5 — Runtime interface hardening

- Approve ingress/ledger/retention specs.
- Implement focused deepening with unit/integration/E2E evidence.
- Keep provider traffic mock until separately authorized.

### Migration 6 — Low-risk hygiene

- Remove verified redundant `.gitkeep`, default assets, unused dependencies, and dormant modules in small independent PRs.
- Do not combine with architecture or deployment work.

# 20. Risks & Tradeoffs

| Decision | Benefit | Tradeoff / risk |
|---|---|---|
| Keep current directory structure | Low churn and preserved links | Some root/docs asymmetry remains |
| One authority map | Faster agent navigation and fewer conflicts | Requires explicit human canonicalization decision |
| Archive shipped plans | Cleaner active search results | Historical links can break if migration is careless |
| Retain monolithic ADR log for now | Avoids high-churn split | Scanability worsens as ADR count grows |
| Consolidate workflow docs | One operating command center | Poor consolidation could hide specialized gate detail |
| Remove hypothetical seams | Less false maturity and interface surface | Deferred work may later recreate a justified seam |
| Centralize adapter selection | Better locality for fallback policy | A broad resolver can become a shallow abstraction if it exposes every domain variation |
| Add E2E/security/link gates | Higher confidence | More CI time and maintenance; phase them by risk |
| Clean worktrees aggressively | Lower cognitive load | High risk of losing dirty, unique, or preservation work |
| Keep GTM in repo | Product/copy/code alignment | Commercial facts and runtime truth can blur without authority labels |

The opportunity cost of a massive cleanup is high: it would create path churn while v0.3 readiness work and open PRs are active. Incremental reconciliation delivers more safety per change.

# 21. Recommended Next Action

**Recommended next action: review and approve a narrow “Authority + Active-Link Reconciliation” spec, not the full cleanup.**

That next spec should authorize only:

1. Selecting the documentation authority map.
2. Relabeling conflicting canonical/supporting documents.
3. Fixing active broken relative links.
4. Correcting unambiguous current-vs-planned wording and health-version drift.
5. Closing out—without yet deleting or moving—the completed remediation plan.

It should explicitly exclude:

- file moves/deletions,
- ADR restructuring,
- runtime refactors,
- dependency removal,
- branch/worktree cleanup,
- provider/deployment/secret changes,
- public pricing/positioning decisions.

After that PR is approved and merged, conduct a separate worktree/branch cleanup assessment with exact targets. Do not combine documentation authority work with destructive Git cleanup.

---

# Final Repository Test

Could a competent developer or AI agent enter this repository with no prior context and determine within five minutes:

| # | Question | Score | Reason |
|---|---|---|---|
| 1 | What does this repository do? | PASS | README and PRD are clear |
| 2 | What is the canonical source of truth? | PARTIAL | Authority order exists, but supporting docs make conflicting canonical claims |
| 3 | What work is currently active? | PARTIAL | Dashboard and roadmap exist, but checked-out dashboard/branch state drifts from live GitHub |
| 4 | Where does new work belong? | PARTIAL | Runtime/docs folders are clear; assessment/spec/initiative intake is not |
| 5 | Should the work use a branch or worktree? | PARTIAL | Policy exists but is draft and the estate shows weak closeout |
| 6 | What is the agent allowed to change? | PASS | `AGENTS.md` is explicit |
| 7 | How must changes be validated? | PASS | README, AGENTS, and CI agree |
| 8 | What requires human approval? | PARTIAL | Hard product/deploy gates are clear; broader matrix remains draft/global |
| 9 | How does work reach `master`? | PASS | Feature branch → draft PR → green CI → human merge is documented |
| 10 | How is completed work closed and cleaned up? | PARTIAL | Changelog/dashboard/worktree rules exist, but are not consistently executed |

```text
REPOSITORY OPERABILITY SCORE: 6.5/10
```

## Three highest-leverage improvements

1. **Approve and enforce one documentation authority/status model.** This removes the largest source of agent error without moving files.
2. **Close and archive completed/stale planning material with automated active-link validation.** This makes search results trustworthy.
3. **Operationalize task/worktree closeout.** Bind branch/worktree/task/PR/owner/phase at startup, then require verified cleanup after merge; audit the current 16-worktree estate separately.

---

## Stop condition

Phase 1 is complete with this assessment. No Phase 2 cleanup is authorized or executed. File moves, renames, consolidation, archive operations, deprecations, deletions, worktree removal, branch deletion, dependency changes, infrastructure changes, merge, push, and deployment require separate explicit authorization.
