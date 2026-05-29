# Codex Execution Prompt — Exec 0A: Implementation Sequencing & Repo-Grounded Preflight

> This file is the **Codex-ready execution prompt** for Exec 0A. Copy its body into
> Codex to run the phase. It is planning input only; it authorizes no implementation.

---

## Role & mandate
You are Codex working in the `responseos` repository. Your job for this task is
**planning and reporting only**. You will produce ONE primary markdown artifact:
`docs/product/RESPONSEOS_EXEC_0A_PREFLIGHT.md`.

This is the Exec 0A phase from `docs/product/RESPONSEOS_IMPLEMENTATION_PLAN.md` §4.
Its entry gate (PR #17 + PR #18 merged) is met. Exec 0A is the "process before code"
phase: lock the order of work and ground it in the *actual* repo state — do not begin
0B or 1.

## Absolute constraints (hard stops — violating any of these fails the task)
1. **Do NOT write, scaffold, or modify any application/production code.** No new
   services, entrypoints, routes, components, schema changes, or migrations.
2. **Do NOT add live provider integrations.** `lib/providers/*` stays mock-only.
3. **Do NOT add secrets.** No real keys anywhere; `.env.example` stays placeholders only.
4. **Do NOT introduce Firebase** — no dependency, import, or config, ever.
5. **Preserve the architecture invariants:** mock-first (ADR-0001), tenant-aware /
   `account_id`-scoped (SECURITY.md, ADR-0011), event-ledger-first (ADR-0002),
   provider-abstraction boundaries (ADR-0012), modular monolith with the voice gateway
   as the only sanctioned service split (ADR-0013).
6. **The only permitted changed files for this task are exactly two:**
   - `docs/product/RESPONSEOS_EXEC_0A_PREFLIGHT.md` (the report you create)
   - `docs/CHANGELOG.md` (a mandatory newest-first entry — see Step 7)

   Create or modify **no other file**. If your analysis surfaces a needed change
   elsewhere, write it up in the report as a recommendation — do not make it.
7. **GitHub issues and milestones are out of scope for this task.** Do not create,
   edit, or close issues or milestones. The milestone/issue recommendations in the
   Implementation Plan §11/§12 are inputs you summarize in the report, not actions you
   take here.
8. Do not relitigate accepted ADRs (ADR-0011 → ADR-0018). Treat them as fixed inputs.

## Step 1 — Inspect the repo from current master
- Start from the latest commit on the default branch. Confirm the current HEAD, branch,
  and that the working tree is clean before you begin.
- Enumerate the actual top-level layout and the `lib/`, `prisma/`, `app/`, `tests/`,
  `types/`, and `docs/` trees. Report what you observe, not what you assume.

## Step 2 — Read these documents in full (they are the source of truth)
- `docs/product/RESPONSEOS_BUILD_SOURCE.md`
- `docs/product/RESPONSEOS_IMPLEMENTATION_PLAN.md`  (the controlling plan for this arc)
- `docs/product/RESPONSEOS_PHASE_PLAN.md`
- `docs/DECISIONS.md`
- `docs/README.md`
- `docs/CHANGELOG.md`

Also skim, because the plan references them directly and Exec 0B/1 depend on them:
- `docs/architecture/RESPONSEOS_BACKEND_SPEC.md`  (VoiceProvider interface, §4)
- `docs/architecture/RESPONSEOS_EVENT_SCHEMA.md`  (event ledger envelope)
- `docs/architecture/RESPONSEOS_DATA_MODEL.md`    (go-forward tables, §4)
- `docs/ops/RESPONSEOS_QA_VALIDATION_PLAN.md`     (validation gates)
- `docs/product/RESPONSEOS_BACKLOG.md`            (Definition of Done; EX-* mapping)

## Step 3 — Confirm the current file structure
Verify against the real tree (do not trust this list — re-derive it):
- `lib/` areas present today: `auth/`, `automations/`, `config/`, `data/`, `db/`,
  `mock/`, `notifications/`, `providers/`, `revenue/`, `scoring/`, `validation/`,
  `serverOnlyGuard.ts`.
- `lib/providers/` stubs present today: `bland/`, `ghl/`, `hubspot/`, `n8n/`,
  `resend/`, `retell/`, `stripe/`, `twilio/`, `vapi/`, plus `webhook-helpers.ts`.
- `prisma/`: `schema.prisma`, `seed.ts`, `migrations/`.
- Note what the plan expects but does NOT yet exist (e.g. `lib/providers/voice/`,
  a typed config loader in `lib/config/`, an event-ledger writer module, a voice
  gateway entrypoint). Flag each as "expected by plan, absent today."

## Step 4 — Confirm package scripts and validation commands
- Read `package.json`. Confirm the actual scripts:
  `dev`, `build`, `start`, `lint` (eslint), `typecheck` (tsc --noEmit),
  `test` (vitest run), `test:integration` (vitest run --config
  vitest.integration.config.ts), and the prisma `seed` (tsx prisma/seed.ts).
- Read the CI workflow(s) under `.github/workflows/`. Confirm the `validate` and
  `integration` jobs and exactly what each runs (lint/typecheck/unit/build, and the
  Postgres 16 service container + `prisma migrate diff` / `migrate deploy` / `db seed`
  / integration tests / DB-backed build). Note any drift between the plan's §9 gate
  list and what CI actually executes — there is no standalone `npm run validate`
  script; `validate` is a CI job, so state that precisely.
- Read `vitest.config.ts` and `vitest.integration.config.ts` and confirm the unit vs
  integration split.

## Step 5 — Identify exact files likely touched by Exec 0B and Exec 1
Using the plan (§5, §6, §7, §12) cross-referenced against the real tree, produce a
**file impact map**. For every entry, mark `[exists]` or `[new]` and cite the plan
task ID (EX0B-*, EX1-*). Cover at least:

- **Exec 0B**
  - EX0B-1 module-boundary map: which `lib/*` dirs get a documented responsibility.
  - EX0B-2 `VoiceProvider` interface + deterministic mock: `lib/providers/voice/` [new],
    referencing Backend Spec §4; confirm each existing `lib/providers/*` stub has a
    documented mock fallback.
  - EX0B-3 env/config contract: `.env.example`, typed loader in `lib/config/`.
  - EX0B-4 test/isolation conventions: `vitest.config.ts`,
    `vitest.integration.config.ts`, `tests/`, `prisma/seed.ts` ↔ `lib/mock/*`.
- **Exec 1**
  - EX1-T1 `Organization`→`Account` rename + scoping: `prisma/schema.prisma`,
    `prisma/migrations/` [new], regenerated client, `lib/data/*`, `lib/auth/*`,
    `prisma/seed.ts`, affected tests. Grep for every current `Organization` /
    `accountId` reference and report the count + locations as rename blast radius.
  - EX1-T2a event ledger + idempotent writer: `prisma/schema.prisma`, new migration,
    new ledger-writer module under `lib/`, `prisma/seed.ts`, tests.
  - EX1-T2b go-forward tables (`call_sessions`, `tool_calls`, profile tables,
    `crm_mappings`): `prisma/schema.prisma`, migration, seed, per-table isolation tests.
  - EX1-T3 voice gateway skeleton (mock-only): new runnable entrypoint + its own
    `package.json` start script [new], health endpoint, wires mock `VoiceProvider`,
    emits one mock session event via the T2a writer. No audio/socket/Redis/live provider.

For each file, note the risk level (low/med/high) and why.

## Step 6 — Produce the preflight report
Write `docs/product/RESPONSEOS_EXEC_0A_PREFLIGHT.md` with a header block matching the
house style of the other `docs/product/RESPONSEOS_*` docs (Owner, Status =
"Canonical (planning) — no implementation authorized by this document", Read-first
links, Governing ADRs). It MUST contain these sections, in this order:

1. **Current repo state** — HEAD/branch, top-level + `lib/`/`prisma/` layout as
   observed, what the plan expects that is absent today, and confirmation that the
   Exec 0A entry gate (PR #17/#18 merged) is met.
2. **Implementation dependency order** — restate and validate the critical path
   `A1 → A2 → B1 → B3/B4 → T1 → T2a → T3` against the real repo; flag any dependency
   the repo state changes or contradicts.
3. **Risk register** — at minimum the plan's R1–R4 (rename blast radius, ledger-writer
   scope creep, gateway drifting into realtime, premature service split), each with a
   concrete, repo-grounded mitigation. Add any new risk your inspection surfaces.
4. **File impact map** — the table from Step 5.
5. **Validation commands** — the exact commands from Step 4 (local gates + the two CI
   jobs), with the precise wording about `validate` being a CI job, not an npm script.
6. **Recommended first implementation PR** — which single task should land first
   (the plan argues EX1-T1 `Account` rename is the biggest unblocker; confirm or
   challenge with evidence), scoped as one atomic PR, with its acceptance criteria
   and which validation gates must be green.
7. **Blockers / open questions** — carry B1 (v0.3 authorization) and OQ Q1–Q3 from the
   plan without resolving them; add any new blocker the repo reveals.
8. **Explicit recommendation** — a single, unambiguous line:
   **"SAFE TO PROCEED"** or **"NOT SAFE TO PROCEED"** to Exec 0B, with a 2–4 sentence
   justification grounded in the findings above.

## Step 7 — Validation & hygiene
- This task changes only documentation, so the full build/test suite is not required
  to *pass new code* — but confirm you have introduced no code, no schema change, and
  no dependency change. Run `git status` / `git diff --stat` and confirm the only
  changed paths are the two permitted files.
- **Add a newest-first entry to `docs/CHANGELOG.md`** recording the Exec 0A preflight
  report under the existing "Unreleased — implementation plan (Execution Phases
  0A → 1)" section (or a sibling Unreleased block in the same style). This entry is
  mandatory.
- Do NOT run migrations, seeds, or any command that mutates a database.

## Step 8 — Branch, PR, and STOP
- Work on the designated feature branch off the latest default-branch commit; one PR.
- Open the PR as a **draft** with a summary that states this is Exec 0A (planning only,
  no code) and links the Implementation Plan.
- Then STOP. **Do not begin Exec 0B or any implementation.** Wait for human review and
  sign-off before any further work.

## Definition of done
- [ ] `docs/product/RESPONSEOS_EXEC_0A_PREFLIGHT.md` exists with all 8 required sections,
      fully grounded in the actual repo (no invented files, scripts, or paths).
- [ ] `docs/CHANGELOG.md` has a newest-first entry for the preflight report.
- [ ] Exactly two files changed; `git diff --stat` shows only the two permitted paths.
- [ ] No code/schema/dependency changes; no GitHub issues or milestones created.
- [ ] Report ends with an explicit SAFE / NOT SAFE TO PROCEED recommendation.
- [ ] Draft PR opened; no implementation started; awaiting human review.
