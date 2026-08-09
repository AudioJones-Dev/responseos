# Build Status & GTM Pipeline

**Date:** 2026-08-08 · **Master:** `897c866` · **Scope:** documentation + reconciliation only — no feature work.

> ⚠️ **Read [`readiness/`](./readiness/) first for current build truth.** The #113 readiness audit is a deeper, more recent, and considerably more pessimistic assessment of what is implemented — it concludes the call → intelligence → memory → decision → action chain has **no implementation at any link**, controlled demo **NOT PRESENT**, pilot readiness **NO** with 12 blockers. This document is the *reconciliation and merge* record; where the two disagree on build state, `readiness/` wins.

This document answers one question: **what is actually built, what do the docs claim, and what stands between here and a GTM pipeline?** It was produced by a full sweep of local and remote git plus a line-level audit of the build against its documentation, then updated as the backlog was drained.

> **Reading note.** Sections 1–3 are verified fact. Section 4 is the merge sheet. Section 5 is the pipeline. Section 6 lists the decisions only the founder can make — nothing in Section 6 is an engineering task.

---

## 1. Headline

**ResponseOS was not behind on code. It was behind on landing. The backlog is now drained — all ten stranded pull requests have merged.**

`master` is healthy: CI green, 22 Prisma models with consistent tenant scoping, 8 migrations, **192 unit tests** passing (plus integration tests in CI), a mock-safe demo walkthrough, mock-first CAL provider scaffolding, and deployment correctly contained.

**"Healthy" here means the substrate compiles, is tenant-safe, and ships nothing live — not that the product works end to end.** It does not: see [`readiness/`](./readiness/).

### What the sweep found

- **10 pull requests were open**, totalling **6,444 added lines** of finished, CI-green work.
- **5 of them formed a chain stranded since 2026-07-01** — a month of governance, quality, and reference documentation nobody popped off the stack.
- **Five branches carried `ADR-0039`, covering four distinct decisions.** Whichever merged first would have silently won the number and pushed duplicate identifiers into the decision log.
- 🔴 **Auth on `master` was fail-OPEN** — `/admin` served a 42,528-byte cross-tenant Operator Console to anonymous visitors. Measured, not inferred (§3e).
- 🔴 **The five "CLEAN" stacked PRs would not cascade cleanly.** This repo permits **squash merges only**, and GitHub evaluates each stacked PR against its *original chained base*, not against a post-squash `master`.

### What has since landed

| Merged | Commit | Effect |
|---|---|---|
| #96 | `8fffd57` | **Closes the fail-open auth hole** — `RESPONSEOS_REQUIRE_AUTH` gate at edge + session |
| #89 | `b35669f` | Governance remediation plan + gate docs |
| #90 | `9d35142` | Stale documentation posture reconciled |
| #91 | `335f044` | API, data, and PRD specs reconciled |
| #92 | `a7790ad` | Quality + reference baselines |
| #93 | `83038d5` | Documentation governance index |
| #98 | `b50d2f2` | xAI voice readiness spike |
| #94 | `1250faf` | v0.3 demo deploy checkpoint (ADR-0045) |
| #108 | `a790ba3` | Mock-first CAL provider scaffolding — **mock-only, audited** |
| #105 | `96fdfed` | Platform doctrine v1 + ADR-0040–0044 — **proposed, not ratified** |
| #103 | `897c866` | Future-client delivery system |

Landed independently alongside the sweep: **#109** (v0.3 founding-pilot scope freeze + acceptance gates), **#110** (Path A staging prep), **#111**/**#112** (dependency audit pins), **#113** (readiness audit).

**Still open:** #107 only — never reviewed as part of this sweep.

**The squash-cascade prediction was confirmed in practice:** #89 merged clean, then **every** subsequent step conflicted — #90/#91/#92 on `dashboard/dashboard-data.json`, #93 on that plus two add/add `.md` collisions. All were mechanical; at each step the resolution was verified to lose nothing from *either* side. The board ended at exactly the predicted **28 tasks, `G-01`–`G-05` present, no duplicate ids**.

**The ADR allocation held across five days and every re-resolution.** `0039` (#96) · `0040–0044` (#105) · `0045` (#94) landed in ascending order with no duplicates — despite each PR being re-merged three separate times as `master` moved beneath it.

**A second conflict species appeared later.** The docs-chain conflicts were *additions at the same array index*, which a union resolves. #94's board conflict was **field-level disagreement on the same five tasks** (`status`, `owner`, `progress`, `blockedReason`) because both sides edited the same work items five days apart. A text union produced invalid JSON. It needed a real 3-way merge: each side contributed 3 unique tasks, `master` won the 5 both-edited (newer), #94 won the 1 it alone changed — **34 tasks, nothing lost from either side.**

The declared launch in `dashboard/dashboard-data.json` is **2026-08-15 — 7 days out**.

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
| Fail-closed auth | ✅ **RESOLVED by #96 (`8fffd57`).** `RESPONSEOS_REQUIRE_AUTH` now exists on `master`, enforced at both the edge (`proxy.ts:30`) and the session resolver. Prior to that merge, auth was fail-OPEN. **Verified by live test both before and after** — see §3e. |
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

> **✅ #96 merged as `8fffd57`.** Before merging, the result was rebuilt against current `master` and re-gated (lint, typecheck, **177/177 tests**, build) — the PR's own CI was three weeks stale and predated #100/#102/#104. The merge was SHA-pinned. No deploy fired: only `CI` and the dashboard sync ran, and `vercel.json`'s `deploymentEnabled` gate remains intact.
>
> **The flag still has to be switched on.** `RESPONSEOS_REQUIRE_AUTH` is opt-in by design — unset preserves mock-first boot for dev, CI, and `next build`. `master` today is still fail-open *by default*; the gate now exists but the hosted demo must set the variable. That is part of decision **D3**.

> ⚠️ **Before enabling the flag:** `/api/audit-requests` — the lead-capture endpoint behind the `/audit` form — is **not** on the public path list. With `RESPONSEOS_REQUIRE_AUTH` on, that form would submit into a redirect. Verify before the Aug-15 demo.

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

### 🔴 The squash-only trap — predicted, then confirmed

The repository allows **squash merges only** (`allow_merge_commit: false`, `allow_rebase_merge: false`, `allow_squash_merge: true`). This breaks stacked PRs in a way the UI does not show:

Squash-merging #89 lands its tree on `master` as a **new commit that is not an ancestor of #90's head**. #90's merge-base then falls back to the original fork point, and its `dashboard-data.json` task insertion collides with the block squash-#89 already placed at the same array index. This repeated at every subsequent step.

**GitHub reported all five as `MERGEABLE / CLEAN` throughout, because it evaluates each against its original chained base, not against a post-squash `master`.** The badge was not a promise.

| Step | Predicted | Actual | Conflicting files |
|---|---|---|---|
| #89 → `b35669f` | clean | ✅ clean | — |
| #90 → `9d35142` | conflict | ✅ conflict | `dashboard/dashboard-data.json` |
| #91 → `335f044` | conflict | ✅ conflict | `dashboard/dashboard-data.json` |
| #92 → `a7790ad` | conflict | ✅ conflict | `dashboard/dashboard-data.json` |
| #93 → `83038d5` | conflict | ✅ conflict | that, plus add/add on `RESPONSEOS_DOCUMENTATION_REMEDIATION_PLAN.md` and `OPEN_QUESTIONS.md` |

All resolutions were mechanical — union the JSON task objects, take #93's version of the two `.md` files (verified as genuine supersets, not assumed). Each step was checked for loss from *both* sides, not merely for valid JSON. Final board: **28 tasks, no duplicate ids, `G-01`–`G-05` and both `P0` tasks present** — exactly the predicted end state.

**The lesson worth keeping:** in a squash-only repo, a stacked PR's green mergeability badge is meaningless. Simulate against a post-squash `master` with `git merge-tree` before trusting it.

> **Add/add conflicts are an artefact of squashing, not a real disagreement.** #93 edits files that #89 and #92 created; because those landed as squash commits, git saw the files as independently added on both sides. Check which side is a superset rather than assuming.

### Backlog drained ✅

All ten stranded PRs merged, plus #108. Only **#107** remains open — it was never part of this sweep and has not been reviewed here.

> **⚠️ Every merge re-conflicted the next, exactly as predicted.** `docs/CHANGELOG.md`, `docs/DECISIONS.md`, and `dashboard/dashboard-data.json` each collided on nearly every merge; #94, #105, and #103 were re-resolved **three times apiece** as `master` moved beneath them. Mechanical each time, but it made a five-PR tail cost far more than five merges. **A `.gitattributes` union merge driver on `docs/CHANGELOG.md` would remove most of it** — that is the single highest-leverage hygiene fix for this repo.

**#108 was merged against an explicit mock-only bar, verified empirically:**
`createLive` is referenced **only inside `lib/providers/resolve.ts` itself** — never passed by any of the five factories — so `resolveProvider` takes the mock branch **unconditionally**, even with `TELNYX_API_KEY`, `VAPI_API_KEY`, `TWILIO_ACCOUNT_SID`, `HUBSPOT_ACCESS_TOKEN` and `CALENDLY_API_KEY` all populated. Zero network calls in `lib/providers/`. The only new env read is a configured-ness probe that cannot select a live path.
> Two caveats: **`TELNYX_API_KEY` and `CALENDLY_API_KEY` are probed but absent from `.env.example`** (gap in the env contract, harmless while unset means mock); and **the mock-only guarantee is structural, not enforced** — adding a `createLive` to any of those five files is a one-line change that would flip a provider live. A test asserting `createLive` is never passed would make that hard to do by accident.

> **⚠️ #94 and #96 both changed auth — #96 won.** #94 carried an earlier variant gated on `NODE_ENV=production`; master now has the reconciled `RESPONSEOS_REQUIRE_AUTH` gate. #94's conflicts were resolved **in master's favour**, and two of its tests asserting the superseded semantics were removed (master's `proxy.test.ts` and `session.test.ts` already cover the same ground more thoroughly).

> 🔴 **A clean auto-merge silently widened the public surface.** Merging master into #94 produced *no conflict* in `lib/auth/route-protection.ts`, yet left `/audit` and `/trust` in **both** `PUBLIC_EXACT` (master's posture) and `PUBLIC_PREFIXES` (#94's). Since `isPublicPath` returns true if either matches, the prefix rule won and `/audit/*` and `/trust/*` became public — wider than either branch intended. Only master's `treats /audit/internal as protected` test caught it. Fixed by dropping the prefix entries. **A clean merge is not a correct merge.**

### Hygiene gaps found (not blockers)

- **None of #89–#93 adds a `docs/CHANGELOG.md` line**, which `AGENTS.md:52` requires of every merged PR.
- **PR #96 updates neither `docs/CHANGELOG.md` nor `dashboard/dashboard-data.json`**, both required by the same rule.
- **PR #90 adds a line to `docs/DEPLOYMENT.md` that is already stale**: *"Current GitHub Actions run validation only; there are no deploy jobs yet."* Master now has a `deploy` job (`actions/deploy-pages@v5`) and a `vercel.json` master-deploy gate, landed via #100/#104 after that branch forked. The pre-existing "No deploy jobs yet." sentence is stale on `master` too.
- **PR #98's cross-references dangle.** Its provider positioning is *correct* (Telnyx/Vapi, matching ADR-0031/0032), but it links to an `ADR-0039` anchor and to `responseos-v0.3-live-call-demo-implementation-brief.md` — both of which exist only on PR #94's branch, where the ADR is now **0045**. Fix the anchor when #94 lands.
- **Three pre-existing off-by-one ADR citations on PR #105**, carried forward deliberately by the renumber rather than silently corrected — fixing them would change what the docs *assert*, which is out of scope for a mechanical renumber. Each still resolves to the same target it always did. Worth a separate one-line fix:
  - `docs/DECISIONS.md:690` cites "ADR-0043 §governance", but 0043 is *Provider portability* and has no §governance section; the governance/approval-state material is in ADR-0044 §7.
  - `docs/strategy/responseos-platform-doctrine-v1.md:481` and `:553` cite ADR-0044 (*Trust Infrastructure*) for provider-portability claims; line 553 verbatim restates **ADR-0043**'s decision 2.

---

## 5. The GTM pipeline

Four lanes. Each is gated differently, and **conflating them is the single biggest source of confusion in this repo.**

### Lane 1 — `demo-deploy` (nearest term; target 2026-08-15, 13 days)
A mock-safe hosted demo. Per **ADR-0019** this is a *v0.3-gated, production-facing* deploy.

- ✅ Demo walkthrough built and mock-safe
- ✅ Deployment contained (`vercel.json`, Pages double-gated)
- ✅ **Fail-closed auth gate exists** — #96 merged (`8fffd57`)
- ⬜ **Set `RESPONSEOS_REQUIRE_AUTH` on the hosted deploy** — the gate is opt-in; unset, `master` is still fail-open by default
- ⬜ **Confirm `/api/audit-requests` reachability** before enabling the flag — it is not on the public path list (§3e)
- ⬜ **Founder authorization + an explicit carve-out** from the "no production deploys" hard rule (`AGENTS.md:24`)
- ⬜ **Real Clerk login replacing the basic-auth shim** — ADR-0019 makes this a precondition
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
| **D1** | **Which GTM narrative is canonical?** "AI Revenue Recovery Platform" (what the code, the marketing site, and the `Engagement` enum implement) vs "Managed Business Memory System" (ADR-0022 + ADR-0028), vs a third hardcoded tier mock in admin billing. **Nothing currently decides what a prospect is quoted.** | All sales assets, CTA copy, brand assets, pricing pages | **Now has a proposed answer on `master`.** #105 added `docs/strategy/responseos-platform-doctrine-v1.md` as item 0 of the docs index, reconciling the two as *stages of one progression* — explicitly marked **"Proposed — pending operator ratification."** Merging it did not ratify it. Ratify or reject deliberately, before it hardens into assumed canon. |
| ~~**D2**~~ | ✅ **RESOLVED by #109.** `docs/product/responseos-v0.3-founding-pilot-scope.md` freezes Path B founding-pilot scope with concrete acceptance gates and a **staged authorization checklist** (mock CAL → schema → staging → each live provider → prod). | — | Stage 1 (mock CAL) is satisfied by #108. **Every later stage still needs written human authorization** — #109 authorizes nothing live. |
| **D3** | **Authorize the Aug-15 demo deploy** and grant the carve-out from the no-production-deploys rule. | Lane 1 entirely | Per ADR-0019, also requires real Clerk login. |
| **D4** | **Authorize v0.3** (or don't, yet). | Lane 2 entirely | Separate from D3. Explicitly written authorization required. |
| **D5** | **Disposition `codex/preserve-primary-dirty-2026-07-01`** — the rescued branch. Its editorial design doctrine supersedes part of ADR-0021 (brand palette + fonts) and changes 192 lines of `globals.css`. Promote to a PR (needs ADR-0046), or close out? | Brand/visual system; interacts with **D1** | This is brand doctrine — squarely yours. Now safely mirrored on `origin`. |
| **D6** | **Cut a version.** Reconcile `package.json` (`0.1.0`), the hardcoded health endpoint, 63 `## Unreleased` changelog entries, and the board's "v0.3 Demo". | External legibility of any demo | Cheap; do before showing anyone. |
| **D6b** | **Allow merge commits for the #89–93 stack?** Either enable them temporarily, or squash and hand-resolve four mechanical conflicts. | Draining the stranded chain | See §4. Purely a mechanics choice. |
| **D7** | **Delete `origin/codex/runtime-pin-node20-refresh`?** Superseded by #102 (Node 24). Same question for `origin/codex/preserve-responseos-p0-20260726-153922`, which is 7/8 duplicate of #94. | Nothing | Housekeeping; remote deletion is your call. |

---

## 7. Recommended sequence

1. ~~Merge #96~~ — ✅ `8fffd57`. Fail-closed gate exists on `master`.
2. ~~Drain the #89→#93 chain~~ — ✅ `b35669f` → `83038d5`.
3. ~~Decide D2~~ — ✅ **resolved by #109.** Acceptance gates and a staged authorization checklist now exist.
4. ~~Merge the tail~~ — ✅ #98, #94, #108, #105, #103 all landed. **Backlog drained.**
5. **Read [`readiness/`](./readiness/) and reconcile ambition with it.** The #113 audit says the core chain is unimplemented, controlled demo is not present, and pilot readiness is **NO** with 12 blockers — against a launch date **7 days out**. That gap, not the merge queue, is now the real problem. **Deciding what 2026-08-15 actually means — full pilot, controlled demo, or a date change — is the next call.**
6. **Decide D1** (positioning). #105 put a proposed reconciliation on `master`, unratified. Ratify or reject it deliberately.
7. **Then** take up D3 and the demo deploy — including setting `RESPONSEOS_REQUIRE_AUTH` and confirming the `/audit` form still submits behind it.

---

## Appendix — a note on the test suite

Three independent agents, working on different branches, each hit the same thing: **`data-tenant-matrix.test.ts` and `consumer-swap.test.ts` fail with `Test timed out in 5000ms` under CPU load**, then pass 31/31 when re-run with `--testTimeout=60000`. The failures land on the first dynamic-import test in each file, where cold transform costs ~20s.

This is not a defect and nothing was changed to accommodate it — but the default 5s `testTimeout` makes `npm test` **unreliable on a loaded machine**, which invites exactly the wrong reflex: treating a red suite as noise. Worth raising the timeout for those two files, or the global default. Filed here as an observation, not a task.

---

*Produced by an automated consistency sweep, 2026-08-02; updated 2026-08-03 as the backlog was drained. Verification: `lint`, `typecheck`, `test`, `build` on every touched branch; `test:integration` delegated to CI (Postgres 16 service container). The fail-open/fail-closed result in §3e was measured against a running dev server, not inferred.*

*Every merge to `master` was individually authorised by the founder and SHA-pinned with `--match-head-commit`. No merge was performed on the agent's own initiative.*
