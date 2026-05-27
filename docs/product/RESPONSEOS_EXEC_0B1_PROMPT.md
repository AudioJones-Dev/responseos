# Codex Execution Prompt — Exec 0B-1: Module-Boundary Map for `lib/*`

> This file is the **Codex-ready execution prompt** for Exec 0B-1. Copy its body into
> Codex to run the task. It is planning/architecture-documentation input only; it
> authorizes no feature implementation, no runtime code, and no schema work.

---

## Role & mandate
You are Codex working in the `responseos` repository. Your job for this task is
**architecture documentation only**. You will produce ONE primary markdown artifact:
`docs/architecture/RESPONSEOS_MODULE_BOUNDARIES.md` — a **module-boundary map** that
gives every `lib/*` area a one-line responsibility, names where it integrates a
provider (and that the integration falls back to a mock), and reserves the home of the
not-yet-built event-ledger writer.

This is task **EX0B-1** from `docs/product/RESPONSEOS_IMPLEMENTATION_PLAN.md` §5 work
item 1 and §12 (`EX0B-1`). Its parent phase (Exec 0B — Foundational architecture setup)
has entry gate "Exec 0A exit met"; the merged Exec 0A preflight
(`docs/product/RESPONSEOS_EXEC_0A_PREFLIGHT.md`) ends with an explicit **SAFE TO
PROCEED** recommendation. EX0B-1 is the "boundaries before features" bridge: it sets
the table for EX0B-2/3/4 and Exec 1 **without writing any of them**.

## This is EX0B-1 ONLY — what is explicitly NOT in scope
The following are **separate, later tasks**. Do not start, stub, or pre-build them here:
- **EX0B-2** — the `VoiceProvider` TypeScript interface + deterministic mock under
  `lib/providers/voice/`. EX0B-1 only *names* this as the planned home in the map; it
  creates **no** `lib/providers/voice/` files, no interface, no mock.
- **EX0B-3** — the typed config loader in `lib/config/` and `.env.example` additions.
  EX0B-1 only *documents* `lib/config/`'s intended responsibility; it adds **no** loader
  and **no** env keys.
- **EX0B-4** — test/isolation conventions documentation.
- **Exec 1** (EX1-T1/T2a/T2b/T3) — the `Account` rename, event-ledger table + writer,
  go-forward tables, and the voice-gateway skeleton. EX0B-1 only *reserves the named
  home* for the future ledger-writer module; it creates **no** module and **no** schema.

## Absolute constraints (hard stops — violating any of these fails the task)
1. **Do NOT write, scaffold, or modify any application/runtime code.** No new services,
   entrypoints, routes, components, interfaces, types, loaders, or modules — not even
   empty placeholder `.ts` files. This task is documentation-only. The merged preflight
   marks EX0B-1 as documentation-only (File impact map, `low` risk); honor that.
2. **Do NOT add live provider integrations.** `lib/providers/*` stays mock-only. You are
   documenting the existing mock-fallback posture, not changing it.
3. **Do NOT change the schema, migrations, or seed.** No `prisma/` edits of any kind.
4. **Do NOT add secrets.** No real keys anywhere; do not touch `.env.example` in this task.
5. **Do NOT introduce Firebase** — no dependency, import, or config, ever.
6. **Preserve the architecture invariants** and describe the map in their terms:
   mock-first (ADR-0001), tenant-aware / `organization_id`(→`account_id`)-scoped derived
   from session (SECURITY.md, ADR-0011), event-ledger-first (ADR-0002),
   provider-abstraction boundaries with no provider logic above the adapter (ADR-0012),
   modular monolith with the voice gateway as the **only** sanctioned service split
   (ADR-0013).
7. **The only permitted changed files for this task are exactly three:**
   - `docs/architecture/RESPONSEOS_MODULE_BOUNDARIES.md` (the map you create)
   - `docs/README.md` (index the new doc in the canonical `RESPONSEOS_*` list)
   - `docs/CHANGELOG.md` (a mandatory newest-first entry — see Step 6)

   Create or modify **no other file**. If your analysis surfaces a needed code change
   elsewhere, write it up in the map as a recommendation — do not make it.
8. **GitHub issues and milestones are out of scope.** Do not create, edit, or close
   issues or milestones.
9. Do not relitigate accepted ADRs (ADR-0011 → ADR-0018). Treat them as fixed inputs.

## Step 1 — Start from current master and inspect the real tree
- Start from the latest commit on the default branch. Confirm the current HEAD, branch,
  and that the working tree is clean before you begin.
- Enumerate the actual `lib/` tree (every subdirectory and top-level file) and the
  `lib/providers/` tree. Report what you observe, not what you assume — the map must be
  grounded in files that exist today.

## Step 2 — Read these documents (they are the source of truth)
- `docs/product/RESPONSEOS_EXEC_0A_PREFLIGHT.md`  (the merged preflight — confirm its
  **SAFE TO PROCEED** call and reuse its File impact map / risk register as inputs)
- `docs/product/RESPONSEOS_IMPLEMENTATION_PLAN.md` (§3 invariants, §5 Exec 0B, §7 deps,
  §12 `EX0B-1` acceptance — the controlling plan)
- `docs/product/RESPONSEOS_BUILD_SOURCE.md`        (§6 invariants)
- `docs/DECISIONS.md`                              (ADR-0001, 0002, 0011, 0012, 0013)
- `docs/architecture/RESPONSEOS_SYSTEM_ARCHITECTURE.md` (§2 component-responsibilities
  table and §4 multi-tenancy — the macro view EX0B-1 zooms into for `lib/*`)
- `docs/architecture/RESPONSEOS_BACKEND_SPEC.md`   (§4 provider abstraction — name only;
  do not implement)
- `docs/ops/RESPONSEOS_QA_VALIDATION_PLAN.md`      (validation gates referenced in Step 5)

## Step 3 — Confirm the Exec 0A recommendation
In the map, state in one or two sentences that the merged Exec 0A preflight concluded
**SAFE TO PROCEED** to Exec 0B, and that EX0B-1 is the first Exec 0B task on the
critical path `A1 → A2 → B1 → B3/B4 → T1 → T2a → T3`. If anything in the live repo now
contradicts that recommendation, flag it and **stop** (escalate) rather than proceeding.

## Step 4 — Define the module-boundary map for current `lib/*` areas
For **each** `lib/*` area that exists today, give exactly:
- a **one-line responsibility** (what it owns),
- an explicit **"does NOT own"** boundary (what belongs to a neighboring area),
- whether it **integrates a provider** and, if so, a note that the integration **falls
  back to a mock** when env vars are absent (ADR-0001), and
- its **tenant-scope obligation** where relevant (e.g. `lib/data/*` filters by
  session-derived `organization_id`; ADR-0011 / SECURITY.md).

Cover at minimum the areas observed in the tree:
`lib/auth/`, `lib/automations/`, `lib/config/`, `lib/data/`, `lib/db/`, `lib/mock/`,
`lib/notifications/`, `lib/providers/` (and each stub: `bland/`, `ghl/`, `hubspot/`,
`n8n/`, `resend/`, `retell/`, `stripe/`, `twilio/`, `vapi/`, plus `webhook-helpers.ts`),
`lib/revenue/`, `lib/scoring/`, `lib/validation/`, and the top-level `lib/serverOnlyGuard.ts`.

Then include a short **"planned but absent today"** subsection that names — without
creating — the homes the later tasks will fill:
- `lib/providers/voice/` (`VoiceProvider` interface + mock) — **EX0B-2**.
- typed config loader in `lib/config/` — **EX0B-3**.
- event-ledger writer module under `lib/` (propose a single canonical path, e.g.
  `lib/ledger/`) — **EX1-T2a**.
Mark each as "expected by plan, absent today" and cite the owning task ID.

Per the plan's EX0B-1 acceptance: every `lib/*` area has a one-line responsibility and a
mock fallback is noted wherever it integrates a provider. **No business logic is added.**

## Step 5 — Identify the exact minimal files for EX0B-1 and the validation gates
In the map, include a short **"Files this task touches"** subsection listing exactly the
three permitted files (Step constraint 7) and confirming nothing else changes. Also
restate the validation gates this task is checked against (from the QA plan / AGENTS.md):
- Local: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
  (`npm run test:integration` is unaffected — no schema/code change).
- CI: the **`validate`** job (a CI job name, **not** an `npm run validate` script) must be
  green; the **`integration`** job is unaffected by a docs-only change.
Since this task changes only documentation, the gates must remain green by virtue of
**no code/schema/dependency change** — confirm that, do not "make tests pass."

## Step 6 — Produce the artifact
Write `docs/architecture/RESPONSEOS_MODULE_BOUNDARIES.md` with a header block matching the
house style of the other canonical `docs/architecture/RESPONSEOS_*` docs (Owner =
"AJ Digital LLC / Audio Jones", Status = "Canonical (planning) — no implementation
authorized by this document", Read-first links, Governing ADRs). It MUST contain, in
order:
1. **Purpose & scope** — EX0B-1, documentation-only; what it is and is not (link the
   Implementation Plan §5/§12 and the Exec 0A preflight).
2. **Exec 0A confirmation** — the SAFE TO PROCEED restatement from Step 3.
3. **Module-boundary map** — the per-area table/sections from Step 4 (responsibility,
   does-not-own, provider/mock-fallback, tenant-scope obligation).
4. **Provider mock-fallback coverage** — a short table confirming each existing
   `lib/providers/*` stub falls back to a mock with zero keys (ADR-0001).
5. **Planned but absent today** — the reserved homes from Step 4 with owning task IDs.
6. **Files this task touches + validation gates** — from Step 5.
7. **Stop condition** — one explicit line: EX0B-1 ends here; do **not** begin EX0B-2/3/4
   or Exec 1; await human review.

Also add a one-line index entry for the new doc to `docs/README.md` under the canonical
`RESPONSEOS_*` architecture listing (match the existing list style).

## Step 7 — Validation & hygiene
- Confirm you introduced no code, no schema change, and no dependency change. Run
  `git status` / `git diff --stat` and confirm the only changed paths are the **three**
  permitted files.
- **Add a newest-first entry to `docs/CHANGELOG.md`** under a new `## Unreleased — Exec
  0B-1 module-boundary map` block in the same style as the existing Exec 0A entries.
  This entry is mandatory.
- Do NOT run migrations, seeds, or any command that mutates a database.

## Step 8 — Branch, PR, and STOP
- Work on the designated feature branch off the latest default-branch commit; one PR.
- Open the PR as a **draft** with a summary that states this is Exec 0B-1 (architecture
  documentation only, no code) and links the Implementation Plan and the Exec 0A
  preflight.
- Then STOP. **Do not begin EX0B-2, EX0B-3, EX0B-4, or any Exec 1 implementation.** Wait
  for human review and sign-off before any further work.

## Files likely touched
- `docs/architecture/RESPONSEOS_MODULE_BOUNDARIES.md` — **[new]**
- `docs/README.md` — **[exists]** (one-line index entry)
- `docs/CHANGELOG.md` — **[exists]** (newest-first entry)

No `lib/*`, `prisma/`, `app/`, `tests/`, `types/`, `.env.example`, or dependency changes.

## Validation commands
```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm test            # vitest run (unit)
npm run build       # next build (boots with zero secrets)
```
`npm run test:integration` and the CI `integration` job are unaffected (no schema/code
change). CI `validate` must stay green; there is no standalone `npm run validate` script
— `validate` is a CI job name.

## Risk level
**Low.** Documentation-only; no runtime code, schema, secrets, or dependencies change.
The only real risk is scope creep into EX0B-2/3/4 (interface/loader/test code) — the
"NOT in scope" section and hard-stop constraints exist to prevent it.

## Acceptance criteria
- [ ] `docs/architecture/RESPONSEOS_MODULE_BOUNDARIES.md` exists with all 7 sections,
      grounded in the actual `lib/` tree (no invented paths).
- [ ] Every `lib/*` area present today has a one-line responsibility, a does-not-own
      boundary, a provider mock-fallback note where it integrates a provider, and a
      tenant-scope note where relevant.
- [ ] Each existing `lib/providers/*` stub is confirmed to fall back to a mock with zero
      keys (ADR-0001).
- [ ] Planned-but-absent homes (`lib/providers/voice/`, `lib/config/` loader, ledger
      writer) are named with owning task IDs and **not created**.
- [ ] Exactly three files changed; `git diff --stat` shows only the three permitted paths.
- [ ] No code/schema/dependency changes; no GitHub issues or milestones created; no
      Firebase; no secrets.
- [ ] `docs/CHANGELOG.md` has a newest-first EX0B-1 entry; `docs/README.md` indexes the
      new doc.
- [ ] Draft PR opened; no EX0B-2/3/4 or Exec 1 work started; awaiting human review.

## Stop condition
EX0B-1 ends when the module-boundary map, README index, and CHANGELOG entry are committed
on the feature branch and a **draft** PR is open and green on `validate`. **Do not**
proceed to EX0B-2 (`VoiceProvider` interface + mock), EX0B-3 (config loader), EX0B-4
(test conventions), or any Exec 1 work. Await explicit human sign-off.
