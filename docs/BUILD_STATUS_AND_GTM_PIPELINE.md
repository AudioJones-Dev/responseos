# Build Status & GTM Pipeline

**Date:** 2026-08-02 · **Master:** `1510139` · **Scope:** documentation + reconciliation only — no feature work, nothing merged to `master`.

This document answers one question: **what is actually built, what do the docs claim, and what stands between here and a GTM pipeline?** It was produced by a full sweep of local and remote git plus a line-level audit of the build against its documentation.

> **Reading note.** Sections 1–3 are verified fact. Section 4 is the merge sheet. Section 5 is the pipeline. Section 6 lists the decisions only the founder can make — nothing in Section 6 is an engineering task.

---

## 1. Headline

**ResponseOS is not behind on code. It is behind on landing.**

`master` is healthy: CI green, 22 Prisma models with consistent tenant scoping, 8 migrations, 146 unit tests passing (plus ~60 integration tests in CI), a working mock-safe demo walkthrough, and deployment correctly contained. The v0.2 substrate is genuinely complete.

What is broken is **flow**. At the time of this sweep:

- **10 pull requests were open**, totalling **6,444 added lines** of finished, CI-green work.
- **5 of them formed a chain stranded since 2026-07-01** — a month of governance, quality, and reference documentation nobody popped off the stack.
- **Five branches carried `ADR-0039`, covering four distinct decisions.** Whichever merged first would have silently won the number and pushed duplicate identifiers into the decision log.
- Two PRs showed as CONFLICTING. Both conflicted in **exactly one file** — `docs/CHANGELOG.md` — from concurrent appends. Neither was substantively blocked.
- 🔴 **The five "CLEAN" stacked PRs will not actually cascade cleanly.** This repo permits **squash merges only**, and GitHub evaluates each stacked PR against its *original chained base*, not against a post-squash `master`. See §4.

The declared launch in `dashboard/dashboard-data.json` is **2026-08-15 — 13 days out**.

---

## 2. Git reconciliation — what changed

All 8 development worktrees were clean; there were **no uncommitted file changes anywhere**. The sprawl was entirely in branches, worktrees, stashes, and PRs.

### Removed (each verified landed before deletion)

| Branch | Verification |
|---|---|
| `codex/dashboard-pages-pr-deploy-guard` | patch present in `master` (`git cherry` → `-`); landed as #104 |
| `codex/p0-dependency-remediation` | all 9 touched files content-identical to `master`; landed as #102 |
| `codex/p0-release-containment` | landed as #100; `master` has since moved *ahead* of it (#104 added the PR guard) |
| `claude/continue-work-4a10fc` | ahead=0 — strictly contained in `master` |
| `codex/runtime-pin-node20-refresh` | superseded by #102, which pins Node **24**, not 20; tip preserved on `origin` |
| `gtm/auth-reconciliation` | duplicate label — identical SHA `3fbcc22` to PR #96's head |

Also: 6 orphan detached-HEAD Codex worktrees deregistered; 2 stashes dropped (a 17-line `.claude/launch.json` and a 2026-06-07 dashboard snapshot — both archived to disk first); the primary worktree moved off a deleted branch onto `master`; local `claude/gtm-gap-deployment-plan-9f8ba3` reset to its remote (all 4 divergent commits verified already present upstream).

### ⚠️ Rescued — this branch was nearly deleted

`codex/preserve-primary-dirty-2026-07-01` was on the deletion list because it read as 35 commits behind `master`. **Behind-ness measures the wrong thing.** Content inspection showed it holds **genuinely unlanded work that existed nowhere else** — not on `master`, not on `origin`:

- `docs/design/audio-jones-editorial-intelligence-systems.md` — **188 lines, absent from `master`**
- **192 lines** of `app/globals.css` brand/visual changes
- a fourth **`ADR-0039`** — *"Audio Jones Editorial Intelligence design doctrine is the parent visual system (supersedes the action-orange/body-font portions of ADR-0021)"*

It has been **pushed to `origin` instead of deleted**. It is now mirrored and recoverable. It has no PR and is not queued for merge — see Section 6.

### Audited — `codex/preserve-responseos-p0-20260726-153922`

This branch is on `origin` with **no PR**, 8 commits ahead of `master`. It looked like stranded work. It is not: **`4c30dc3`, the pre-sweep head of PR #94's branch, is its direct ancestor** — 7 of its 8 commits *are* PR #94, verbatim.

Only `95526e2` is unique, and its own commit message reads *"Do not merge wholesale; selectively reapply after review."* It shifts mock dates May→July 2026, routes demo nav to `/demo/walkthrough`, and renames "Revenue Protected"→"Recovered". It also carries a colliding `ADR-0039` (the same text as #94's, now renumbered to 0045).

**Verdict: safe to close out.** Promoting it as its own PR would duplicate #94. If the three cosmetic changes in `95526e2` are wanted, cherry-pick that one commit into #94.

### Mirror state after the sweep

Every local branch now has a remote counterpart. **One asymmetry remains by design:** `origin/codex/runtime-pin-node20-refresh` still exists remotely with no local copy and no PR — it is superseded by #102 and safe to delete, but deleting a remote branch is your call, not mine.

One disk artifact could not be removed: `~/.codex/worktrees/d81b/responseos` is held by a running process. **Git's worktree registry is clean** — it is a stale directory, not a git-state problem.

---

## 3. Build vs docs

### 3a. Docs BEHIND the code — safe to correct

| Claim | Reality |
|---|---|
| `docs/PRD.md:56` — "Current scope (v0.2, **in progress**)" | `docs/ROADMAP.md:14` declares v0.2 closeout ✅ Shipped |
| `docs/architecture.md:8` — "no migrations yet" | 8 migrations exist, `0001_v0_2_foundation` → `0008_clerk_identity_columns` |
| `docs/architecture.md:10` — "Auth via Clerk (**planned**)" | Clerk is wired: `@clerk/nextjs ^7.4.2`, `lib/auth/clerk-sync.ts`, `lib/auth/clerk-webhook.ts` |
| `docs/DEPLOYMENT.md:13` — Standard lane on **Supabase** | ADR-0026 made **Neon** the default |
| `dashboard-data.json` — `P0-02` In Progress/85% | its PR #102 is **merged** (fixed in this PR) |

### 3b. Docs AHEAD of the code — documented but unbuilt

This is the more dangerous direction: these read as capabilities but are not implemented.

| Documented | Actual state |
|---|---|
| Fail-closed auth | 🔴 **Auth is fail-OPEN.** With no `CLERK_SECRET_KEY`, `proxy.ts:22-27` passes every route through and `lib/auth/session.ts:284-285` returns the cross-tenant superuser `aj_admin`. `RESPONSEOS_REQUIRE_AUTH` **does not exist on `master`** — the fix is sitting unmerged in PR #96. **Confirmed by live test** — see §3e. |
| Provider adapters | **9 of 11 are empty `.gitkeep` directories.** Only `voice/` (mock only, no live impl, no env factory) and `encryption/` (real AES-256-GCM) have code. |
| Telnyx as primary carrier (ADR-0031) | **Absent from code, schema, and env entirely.** |
| Webhook signature validation (ADR-0009) | Every non-Clerk webhook is an **unauthenticated stub** returning `mock:true`. `app/api/webhooks/stripe/route.ts:3` is a literal `// TODO: verify Stripe-Signature header`. The Clerk webhook is the one genuinely fail-closed surface. |
| 32 provider env vars in `.env.example` | **19 are never read by any code.** They document intent, not wiring — and no code would pick them up if the keys were present. |
| e2e coverage | `tests/e2e/` contains only `.gitkeep`. PR #96 adds a *contract-level* smoke test (step→page mapping, route publicness, mock-safe gates) — explicitly "no React render". True browser e2e remains unwritten. |

### 3c. Version identity is incoherent

Four sources disagree about what version this is:

| Source | Says |
|---|---|
| `package.json:3` | `0.1.0` |
| `app/api/health/route.ts:7` | `0.1.0` (hardcoded, not read from package.json) |
| `docs/CHANGELOG.md` | **63 consecutive `## Unreleased` headings**; no version cut since v0.2 Phase D |
| `dashboard-data.json` | milestone **v0.3 Demo** |

Nothing external can determine what is deployed. This is cheap to fix and worth fixing before any demo.

### 3e. The fail-open hole and its fix — both verified live

This was measured, not inferred. A dev server was run against PR #96's branch with no Clerk configuration, first with `RESPONSEOS_REQUIRE_AUTH` unset, then set:

| Route | Flag **off** (reproduces `master`) | Flag **on** |
|---|---|---|
| `/admin` | 🔴 **200** — 42,528 bytes, the real Operator Console | ✅ **307 → `/`**, 1-byte body |
| `/client/dashboard`, `/client/calls`, `/api/calls`, `/admin/accounts` | reachable | ✅ all 307 |
| `/demo/walkthrough` | 200 (39,675 B) | 200 (39,675 B, byte-identical) |
| `/api/health` | 200 | 200 |

**Flag-off is master's current behaviour**: an anonymous visitor gets a fully rendered cross-tenant Operator Console. Flag-on redirects every protected surface — pages *and* API routes — with exactly one redirect landing on the public `/`, no loop. The public demo surface is unaffected.

The landing page was checked for leakage: no `AJ Admin`, `aj@responseos`, `Sunshine HVAC`, `org_mock`, or `rev_mock` strings.

The mechanism is two independent layers over one predicate in `lib/auth/auth-required.ts` — `proxy.ts` redirects at the edge, `lib/auth/session.ts` returns `null` — deliberately dependency-free so the edge runtime need not import the Prisma client or the Clerk server SDK.

> **This is why #96 is first on the merge sheet.** It is the only change in the backlog that closes a live cross-tenant exposure.

### 3d. What is genuinely solid

Worth stating plainly, because the gap list above reads harshly:

- **Tenant isolation is real and enforced.** Every per-tenant model carries `account_id` with an index; composite uniques enforce boundaries; `withTenantScope()` gates every data accessor; the Clerk path fails closed. 21 dedicated tenant-matrix tests.
- **Mock-first discipline holds.** The app boots and runs with zero secrets, exactly as `AGENTS.md` requires.
- **Deployment is correctly contained.** `vercel.json` sets `deploymentEnabled.master: false`; the only CI deploy publishes the static dashboard to Pages, double-gated on `ENABLE_PAGES == 'true'` **and** non-PR events.
- **The demo walkthrough is real** — 6 pages on static mock data, with `DEMO_ONLY = true` and an explicit on-page banner.

---

## 4. Merge sheet

**Nothing in this sweep was merged to `master`.** Merge authority is yours per the governance kernel. This is the recommended order.

### ADR allocation (resolves the quadruple collision)

`master`'s highest ADR is **0038**.

| Source | Was | Now | State |
|---|---|---|---|
| PR #96 — fail-closed auth gate | 0039 | **0039** (keeps it) | unchanged |
| PR #105 — platform doctrine | 0039–0043 | **0040–0044** | renumbered |
| PR #94 — v0.3 live-call demo slice | 0039 | **0045** | ✅ renumbered, pushed, CI green |
| `codex/preserve-primary-dirty-2026-07-01` — editorial design doctrine | 0039 | **0046** if promoted | no PR — see D5 |
| `codex/preserve-responseos-p0-…` — duplicate of #94's text | 0039 | n/a | resolved with #94 — see below |

> **Renumbering gotcha.** `grep "ADR-0039"` is case-sensitive and **misses lowercase markdown anchor fragments** (`#adr-0039--…`). One reference escaped that way on #94. Always verify with `grep -rniE "adr-0039"`. Separately, an unanchored duplicate check on `DECISIONS.md` yields ~29 false positives because every ADR is legitimately cited in body text as well as its heading — scope it: `grep -oE '^## ADR-[0-9]{4}'`.

### 🔴 The stacked chain will not cascade cleanly — squash-only repo

The repository allows **squash merges only** (`allow_merge_commit: false`, `allow_rebase_merge: false`, `allow_squash_merge: true`). This breaks stacked PRs in a way the UI does not show:

Squash-merging #89 lands its tree on `master` as a **new commit that is not an ancestor of #90's head**. #90's merge-base then falls back to the original fork point `4885876`, and its `dashboard-data.json` task insertion collides with the block squash-#89 already placed at the same array index. This repeats at every subsequent step.

**GitHub reports all five as `MERGEABLE / CLEAN` because it evaluates each against its original chained base, not against a post-squash `master`.** The badge is not a promise.

| Step | Under merge-commit | Under squash (the only mode allowed) | Conflicting files |
|---|---|---|---|
| #89 | clean | clean | — |
| #90 | clean | **conflict** | `dashboard/dashboard-data.json` |
| #91 | clean | **conflict** | `dashboard/dashboard-data.json` |
| #92 | clean | **conflict** | `dashboard/dashboard-data.json` |
| #93 | clean | **conflict** | `dashboard-data.json`; add/add on `docs/governance/RESPONSEOS_DOCUMENTATION_REMEDIATION_PLAN.md` and `docs/reference/OPEN_QUESTIONS.md` |

Every resolution is mechanical — take the union of task objects in the JSON, take #93's version of the two `.md` files. The verified correct end state is **28 tasks, valid JSON, no duplicate ids**, with `P0-01`/`P0-02` from master and `G-01`…`G-05` all present.

**Two ways forward, both your call:**
1. **Temporarily enable merge commits** for this stack — the cascade is provably clean that way — then turn it back off.
2. **Squash and hand-resolve** the trivial conflict at steps 2–5.

### Recommended order

| Order | PR | Why here |
|---|---|---|
| 1 | **#96** | Closes a live cross-tenant exposure (§3e). Non-draft, CLEAN. Keeps ADR-0039. |
| 2–6 | **#89 → #90 → #91 → #92 → #93** | The stranded chain, in this exact order — with the squash caveat above. |
| 7 | **#94** | ✅ Ready: conflict resolved, ADR→0045, CI green. **Review alongside #96** — both touch auth (see note). |
| 8 | **#105** | Draft. After ADR→0040–0044. |
| 9 | **#103** | Draft. Docs-only. |
| 10 | **#98** | Draft. See correction below. |

> **⚠️ #94 and #96 both change auth — #96 supersedes.** #94 carries an earlier variant whose fail-closed redirect is gated on `NODE_ENV=production`; #96 carries the reconciled single gate keyed on `RESPONSEOS_REQUIRE_AUTH` (its history includes a commit literally titled *"reconcile PR #94/#96 fail-closed auth into one gate"*). Merging #96 first and reviewing #94's auth hunks against it avoids reintroducing the older behaviour.

> **⚠️ `docs/CHANGELOG.md` is a serial bottleneck for #94, #103, and #106.** Each appends to the same `## Unreleased` block, so every merge re-conflicts the next. Mechanical (keep both sides, newest first) but unavoidable. *The five stacked docs PRs are exempt — none of them touches `CHANGELOG.md`, which is itself an `AGENTS.md` hygiene gap.* Consider a `.gitattributes` union merge driver if the pattern persists.

### Hygiene gaps found (not blockers)

- **None of #89–#93 adds a `docs/CHANGELOG.md` line**, which `AGENTS.md:52` requires of every merged PR.
- **PR #96 updates neither `docs/CHANGELOG.md` nor `dashboard/dashboard-data.json`**, both required by the same rule.
- **PR #90 adds a line to `docs/DEPLOYMENT.md` that is already stale**: *"Current GitHub Actions run validation only; there are no deploy jobs yet."* Master now has a `deploy` job (`actions/deploy-pages@v5`) and a `vercel.json` master-deploy gate, landed via #100/#104 after that branch forked. The pre-existing "No deploy jobs yet." sentence is stale on `master` too.
- **PR #98's cross-references dangle.** Its provider positioning is *correct* (Telnyx/Vapi, matching ADR-0031/0032), but it links to an `ADR-0039` anchor and to `responseos-v0.3-live-call-demo-implementation-brief.md` — both of which exist only on PR #94's branch, where the ADR is now **0045**. Fix the anchor when #94 lands.

---

## 5. The GTM pipeline

Four lanes. Each is gated differently, and **conflating them is the single biggest source of confusion in this repo.**

### Lane 1 — `demo-deploy` (nearest term; target 2026-08-15, 13 days)
A mock-safe hosted demo. Per **ADR-0019** this is a *v0.3-gated, production-facing* deploy.

- ✅ Demo walkthrough built and mock-safe
- ✅ Deployment contained (`vercel.json`, Pages double-gated)
- ⬜ **Founder authorization + an explicit carve-out** from the "no production deploys" hard rule (`AGENTS.md:24`)
- ⬜ **Real Clerk login replacing the basic-auth shim** — ADR-0019 makes this a precondition
- ⬜ **Fail-closed auth** — PR #96, unmerged
- ⬜ No hosted-deploy artifact exists on `master` (`vercel.json` is a *blocker*, not a pipeline)

### Lane 2 — `v0.3-production` (live providers)
- ⬜ **Explicit written v0.3 authorization** — a governance decision, not an engineering task
- ⬜ Telnyx absent from code/schema/env despite being the ratified primary carrier
- ⬜ Webhook signature validation (ADR-0009) unbuilt
- ⬜ CAL interface + mock adapter must merge *before* any live adapter
- ⬜ **"v0.3 readiness gates" are undefined** — see below

### Lane 3 — `gtm-commercial` (offer, pricing, onboarding)
- ✅ Offer, pricing model, and onboarding documented
- ✅ Public conversion path shipped (`/audit`, `/pricing`, `/trust`, `/demo`) — mock-safe
- ⬜ **Positioning unresolved** — see Section 6
- ⬜ Money rail (Stripe, invoicing, outcome-fee ledger) is **v0.5-gated**; PR #103 adds the delivery-system docs

### Lane 4 — `post-launch`
Knowledge layer / RAG is v0.4-gated. Out of scope, correctly.

### 🔴 "v0.3 readiness gates" are cited but never defined

The phrase appears as a **binding constraint in 7 files** — `AGENTS.md:24`, `docs/ROADMAP.md:100`, `README.md:102`, `docs/PRD.md:73`, `docs/ops/RESPONSEOS_DEPLOYMENT_PLAN.md:7`, `docs/ops/RESPONSEOS_OBSERVABILITY_AND_GOVERNANCE.md:126`, `docs/product/RESPONSEOS_BUILD_SOURCE.md:211` — always as *"no production deploys until they clear."*

**No document defines what they are.** The nearest artifacts are a provider-readiness gate (`docs/architecture/RESPONSEOS_BACKEND_SPEC.md:205`) and two pre-deploy checklists — and **all of them still name the superseded ADR-0012 stack** (Grok Voice, OpenAI Realtime, Twilio Media Streams, the deferred Node voice gateway) rather than the current Telnyx/Vapi canon from ADR-0031/0032/0036.

**Consequence:** the gate blocking every deploy cannot be satisfied, because nobody has written down what satisfying it means. Dashboard task `V-03` ("Document v0.3 acceptance gates") is To Do / 0%. **This is the critical-path item for the 2026-08-15 date.**

---

## 6. Founder decision register

These are yours. None is an engineering task; each blocks work downstream.

| # | Decision | Blocks | Notes |
|---|---|---|---|
| **D1** | **Which GTM narrative is canonical?** "AI Revenue Recovery Platform" (what the code, the marketing site, and the `Engagement` enum implement) vs "Managed Business Memory System" (ADR-0022 + ADR-0028), vs a third hardcoded tier mock in admin billing. **Nothing currently decides what a prospect is quoted.** | All sales assets, CTA copy, brand assets, pricing pages | Cascades widely. Highest-leverage single decision in the repo. |
| **D2** | **Define the v0.3 readiness gates.** Write the concrete list, against the *current* provider canon. | Every deploy in Lanes 1 and 2 | Critical path for 2026-08-15. Dashboard `V-03`. |
| **D3** | **Authorize the Aug-15 demo deploy** and grant the carve-out from the no-production-deploys rule. | Lane 1 entirely | Per ADR-0019, also requires real Clerk login. |
| **D4** | **Authorize v0.3** (or don't, yet). | Lane 2 entirely | Separate from D3. Explicitly written authorization required. |
| **D5** | **Disposition `codex/preserve-primary-dirty-2026-07-01`** — the rescued branch. Its editorial design doctrine supersedes part of ADR-0021 (brand palette + fonts) and changes 192 lines of `globals.css`. Promote to a PR (needs ADR-0046), or close out? | Brand/visual system; interacts with **D1** | This is brand doctrine — squarely yours. Now safely mirrored on `origin`. |
| **D6** | **Cut a version.** Reconcile `package.json` (`0.1.0`), the hardcoded health endpoint, 63 `## Unreleased` changelog entries, and the board's "v0.3 Demo". | External legibility of any demo | Cheap; do before showing anyone. |
| **D6b** | **Allow merge commits for the #89–93 stack?** Either enable them temporarily, or squash and hand-resolve four mechanical conflicts. | Draining the stranded chain | See §4. Purely a mechanics choice. |
| **D7** | **Delete `origin/codex/runtime-pin-node20-refresh`?** Superseded by #102 (Node 24). Same question for `origin/codex/preserve-responseos-p0-20260726-153922`, which is 7/8 duplicate of #94. | Nothing | Housekeeping; remote deletion is your call. |

---

## 7. Recommended sequence

1. **Merge #96 first** — it closes a live cross-tenant exposure, proven in §3e. Nothing else in the backlog is this urgent.
2. **Decide D2** (define the v0.3 readiness gates) — every deploy is blocked behind it, and the 2026-08-15 date depends on it.
3. **Decide D6b**, then **drain the #89→#93 chain in order** — a month of finished work, four mechanical conflicts.
4. **Decide D1** (positioning) — unblocks every sales asset.
5. **Merge #94** (ready now), then **#105, #103, #98**. Review #94's auth hunks against #96.
6. **Then, and only then**, take up D3 and the demo deploy.

---

## Appendix — a note on the test suite

Three independent agents, working on different branches, each hit the same thing: **`data-tenant-matrix.test.ts` and `consumer-swap.test.ts` fail with `Test timed out in 5000ms` under CPU load**, then pass 31/31 when re-run with `--testTimeout=60000`. The failures land on the first dynamic-import test in each file, where cold transform costs ~20s.

This is not a defect and nothing was changed to accommodate it — but the default 5s `testTimeout` makes `npm test` **unreliable on a loaded machine**, which invites exactly the wrong reflex: treating a red suite as noise. Worth raising the timeout for those two files, or the global default. Filed here as an observation, not a task.

---

*Produced by an automated consistency sweep, 2026-08-02. Verification: `lint`, `typecheck`, `test`, `build` on every touched branch; `test:integration` delegated to CI (Postgres 16 service container). The fail-open/fail-closed result in §3e was measured against a running dev server, not inferred. **No merges to `master` were performed** — merge authority remains with the founder per the governance kernel.*
