# ResponseOS — GTM Gap & Deployment Plan

**Owner:** AJ Digital LLC / Audio Jones
**Author:** Claude Code (analysis + synthesis), for operator review
**Status:** 🟡 Draft / recommend-only. **This document authorizes nothing** — deploys, live-provider work, and positioning/pricing calls remain founder/governance decisions. It is a gap analysis and a proposed sequence.
**Date:** 2026-07-12
**Method:** Repo + git consistency review, current-dev-vs-build-docs analysis, and an 8-reader multi-agent digest (product spec · ADRs · GTM/commercial · deploy/ops/security · architecture/contracts · frontend/API code · backend code · git) → unified 29-gap register → 16-gap adversarial verification pass. Severities below are **verification-adjusted** (5 gaps were downgraded and 1 reclassified after a skeptical re-read; those corrections are folded in).

---

## 0. TL;DR

ResponseOS has a **production-grade, mock-safe v0.2 substrate** — Postgres data layer, Clerk auth, verified tenant isolation, integration tests, a runnable clickable demo — but **nothing on `master` that actually deploys, sells, or invoices.** The gap to deployment is **not mostly missing features.** It is three things, in this order:

1. **Documentation & strategy drift** — the build docs disagree with each other and with the ratified ADRs (two GTM narratives, a stale "canonical" deployment plan, three pricing taxonomies, the ratified primary carrier Telnyx absent from code). Most of this is **cheap, reversible, doc-only** work — and much of it is already written but **stranded on 5+ unmerged branches.**
2. **A small set of real demo-deploy blockers** — there is **no hosted-deploy artifact on `master`**, and a Clerk-less deploy **fails open to a cross-tenant `aj_admin` session.** Both are fixable in days.
3. **Founder/governance gates** — the Aug-15 demo, the v0.3 live-provider unlock, the single pricing taxonomy, and how the first client gets invoiced are **decisions only you can make**, not engineering tasks.

**The spine:** reconcile-and-land the docs → close #27 demo scope → fix the two demo blockers → **founder authorizes the demo** → ship the Aug-15 mock-safe hosted demo. Then, separately and later, **founder authorizes v0.3** → live providers + first paying client.

**Aug-15 demo verdict:** *conditionally achievable.* The code is close (master already runs the demo locally; the missing piece is host config + auth hardening), but it is gated on two founder decisions (authorize the demo; close #27 scope) and a secret-provisioning step — all human-required — so the date holds only if those land in the next ~2 weeks.

---

## 1. Scope — what "deployment" means here

"Deployment" is **layered**, and conflating the layers is the biggest analytical trap. This document keeps four lanes separate:

| Lane | What it is | Gated on |
|---|---|---|
| **`demo-deploy`** | The Aug-15 hosted, **mock-safe** demo of the current surface | Founder authorization (ADR-0019 treats it as a *production-facing* deploy) + #27 scope + secrets |
| **`v0.3-production`** | Live providers (Telnyx/Vapi/Twilio/HubSpot), real billing, first pilot | **Explicit written v0.3 authorization** (AGENTS.md hard rule) |
| **`gtm-commercial`** | The offer/pricing/onboarding/billing/legal to actually **sell + onboard + invoice** a paying client | Founder positioning + pricing decisions; write-path + money-rail authorization |
| **`post-launch`** | Hardening, observability, RLS, scale after the first live client | First live client |

> **Correction folded in (verification):** the Aug-15 "demo deploy" is **not** an undefined or mock-only side-lane. **ADR-0019** ([`DECISIONS.md`](./DECISIONS.md) L263-292) fully defines it and reconciles it with the "no production deploys" hard rule by classifying it as a **v0.3-gated, production-facing deploy** that unlocks only after v0.2 closeout lands (now satisfied) and with **real Clerk login** replacing the basic-auth shim. So founder authorization of the demo is a genuine upstream gate, not a formality.

---

## 2. Consistency review — local ↔ git

**Working tree:** clean. Current branch `claude/gtm-gap-deployment-plan-9f8ba3` is identical to `master` (0 ahead / 0 behind). **All the real divergence — and most of the fix work — lives on unmerged branches.**

### 2.1 Branch / PR topology

| Branch (PR) | vs `master` | Contains | Recommended action |
|---|---|---|---|
| `codex/v0-3-demo-deploy-checkpoint` (**PR #94**) | +7 / −8 | The demo-deploy work: extra demo pages (operator-console, client-dashboard), **fail-closed auth hardening** in `proxy.ts`/`session.ts`, + ~787 lines of docs (incl. v0.3 *live-call* planning briefs). ~488 lines are actual demo code+tests. Merges **clean** today. | **Rebase + human-merge** (successor to closed PR #14) |
| `docs/documentation-index-cleanup` (**PR #93**) | +11 | Docs superset — re-ships #89–92's commits | **Merge as the superset**, close #89–92 as subsumed |
| `docs/governance-remediation-plan` (#89) | +3 | Governance doc remediation | Subsumed by #93 |
| `docs/quality-reference-completion` (#92) | +9 | Quality/reference docs | Subsumed by #93 |
| `docs/spec-reconciliation` (#91) | +7 | **The provider-canon reconciliation** (ADR-0031→0037) | Subsumed by #93 / land first |
| `docs/stale-doc-reconciliation` (#90) | +5 | Stale-doc cleanup | Subsumed by #93 |
| `codex/runtime-pin-node20-refresh` (**PR #88**) | +1 / −15 | The concrete Node-20 pin (`.nvmrc` + `engines`) the merged runtime *standard* doesn't yet enforce | **Rebase + merge** (or fold into #94) |
| `dependabot/npm_and_yarn/js-yaml-4.3.0` (#95) | — | Dependency bump | Rebase + merge |

**Finding (high):** the reconciliation work that would close most of the doc-drift gaps below is **already written and sitting in open PRs** — it just hasn't landed on `master`. The single highest-leverage move in this entire plan is **merging that stranded doc work.**

### 2.2 The `dashboard-data.json` conflict magnet

Every one of the 8 open PRs edits `dashboard/dashboard-data.json`, and the dashboard **sync bot rewrites that file on nearly every `master` commit** (the history is ~90% `chore(dashboard): sync progress data [skip ci]`). This guarantees churn/inflated "behind" counts on that one file. **Recommendation:** stop feature branches from hand-editing `dashboard-data.json` (or add a `.gitattributes` merge strategy / move sync to a side file), per gap **PL3/D8**.

### 2.3 Dashboard-vs-reality & version drift

- **Dashboard pointer (low):** task `[14] "v0.3 demo deploy"` still refs the **closed** PR #14 and reads To Do/0%, while the live work is on open PR #94. Cosmetic; self-heals on merge. *Do not* hand-add the #89–93 entries to `master` — per the dashboard contract those live on each PR's branch and merge with the PR.
- **Version drift (low):** `package.json` and `/api/health` both still report **`0.1.0`** after v0.1+v0.2 shipped; `api-spec.md` documents stale versions.
- **Roadmap self-contradiction (low):** `docs/ROADMAP.md` marks v0.2 closeout **Shipped** while `RESPONSEOS_ROADMAP`/`PHASE_PLAN` call it **in-flight**; `ROADMAP.md` L50 says `BUILD_SOURCE` is "still to be reconciled" while `PRD.md` L86 says it's "tracked" — and `BUILD_SOURCE` is in fact already reconciled (the note points at the wrong docs).

---

## 3. Current dev vs Build Docs — the headline

**The code is deliberately and correctly ahead of, or orthogonal to, where the docs point.** v0.1 + v0.2 are complete and mock-first by design. The gaps are overwhelmingly **docs disagreeing with each other and with the ratified ADRs**, plus a **commercial layer that exists only on paper.**

### 3.1 What is genuinely built and correct (don't "fix" these)

- **22 Prisma models** incl. every v0.2-closeout table (`ProviderConnection`, `Conversation`, `SmsMessage`, `CallSegment`, `CallTranscript`, `WorkflowRun`, `QaLog`, expanded `AuditLog`, `Account`/`Appointment` renames). 8 migrations.
- **Tenant isolation is real and enforced** — data accessors derive scope from the session (`withTenantScope` → `effectiveAccountId`), filtering both mock and Prisma paths; the Clerk session path **fails closed** on cross-tenant mismatch ([`lib/auth/session.ts:260`](lib/auth/session.ts#L260)).
- **Mock-first holds** — provider webhook routes are intentional stubs (`ackWebhook(...)` + `// TODO: verify signature`), all live-provider adapters are `.gitkeep` stubs, only `voice/` (mock), `encryption/` (AES-256-GCM), and `webhook-helpers.ts` are real. The app boots with zero secrets.
- **A runnable, mock-safe clickable demo** already exists on `master` (`app/(demo)/demo/walkthrough/*` + `scenario.ts`, explicitly demo-only, no DB/providers).

### 3.2 The two-narrative problem (the load-bearing GTM gap)

ResponseOS has **two competing canonical GTM stories**, and a **third** hiding in the admin mock:

| Narrative | Where it lives | Pricing | Status |
|---|---|---|---|
| **"AI Revenue Recovery Platform"** | `PRD.md`, `product-spec.md`, `client-facing-offer.md`, **the shipped marketing site** ([`app/(marketing)/page.tsx:61`](app/(marketing)/page.tsx#L61) *"Revenue recovery operating system"*), the `Engagement` enum | Recovery Core/Pro/Performance + outcome fees | Implemented in code & site |
| **"Managed Business Memory System"** | `responseos-gtm-product-roadmap.md` (master GTM spec) | Starter/Operator/Growth/Enterprise capacity tiers ($497–$5,000+/mo) | Claimed "ratified" by ADR-0022/0028 |
| **Admin-billing mock** | Hardcoded in the admin billing page | Starter/Growth/Outcome ($299/$499) | Undocumented |

**Nothing in the product decides which a prospect is quoted.** The GTM roadmap says Business Memory *won* positioning (ADR-0022) and pricing model (ADR-0028), yet the code, PRD, offer doc, and live site all still tell the Revenue Recovery story. **This is the single most important thing to resolve before any real go-to-market** — it's a founder decision (see §6, Q5/Q6), and it cascades into the CTA, brand assets, and every sales asset.

### 3.3 Provider-stack drift (the "read-first" docs are stale)

The ratified stack (ADR-0031→0037) is **Telnyx primary / Twilio failover, Vapi orchestration (OpenAI-in-Vapi brain) / Retell secondary, HubSpot SoR, Calendly scheduling, voice-gateway + Redis deferred.** But:

- The **8 `docs/architecture/RESPONSEOS_*` specs** + `PHASE_PLAN` + `IMPLEMENTATION_PLAN` + `BACKLOG` + `product-spec.md` + a `PRD.md` KPI still present the **superseded Grok-primary / Node-gateway / Redis / Twilio-primary / Cal.com** stack as authoritative, **without a per-doc supersession banner.** An implementer following `PHASE_PLAN`/`BACKLOG` literally would build the deferred, superseded infrastructure. *(Fair mitigation: the read-first entry points — `docs/README.md` L7 and `BUILD_SOURCE.md` §2 — are already reconciled and carry banners steering readers to the ADRs. So this is **medium**, not a trap for a careful reader — but it must be reconciled before any v0.3 build.)*
- **Telnyx — the ratified primary carrier — has no enum value, adapter, or env placeholder** anywhere in code.
- The **webhook-signature contract is specified three different ways** across `api-spec.md`, `API_CONTRACTS.md` §5, and `SECURITY.md`, and **ADR-0009's own table omits Telnyx and Vapi.** *(Telnyx **is** fully specified in `SECURITY.md` and HubSpot in `API_CONTRACTS` §5 — so it's inconsistent, not unspecified: **medium** doc reconciliation.)*

---

## 4. The Gap Register (verification-adjusted)

29 unified gaps, grouped by lane. Severity legend: **🔴 blocker · 🟠 high · 🟡 medium · ⚪ low · 🔒 gated** (deliberately blocked on a founder/governance decision — *not* a fix-now task). Effort: S/M/L/XL.

### 4.1 `demo-deploy` — the Aug-15 hosted demo

| ID | Sev | Gap | Close action | Effort | Depends on |
|---|---|---|---|---|---|
| **D1** | 🔴 | **No hosted-deploy artifact on `master`** — no `vercel.json`/Dockerfile, `next.config.ts` is the empty scaffold, CI has no CD step. (Master *does* run the demo locally; the missing piece is host config, per ADR-0019's Vercel+Neon pattern.) | Add host/CD config (`vercel.json` + Neon, one-shot `migrate`+`seed`, `/api/health` allowlist); rebase + human-merge PR #94 for the richer demo surface | M | D3, L-02 secrets |
| **D2** | 🔴 | **Clerk-less deploy fails open to cross-tenant `aj_admin`.** [`proxy.ts:23`](proxy.ts#L23) is a pass-through with no `CLERK_SECRET_KEY`; [`session.ts:283`](lib/auth/session.ts#L283) falls back to the `aj_admin` dev session, which bypasses tenant scope. The prod guard ([`session.ts:148`](lib/auth/session.ts#L148)) only catches *explicit* `RESPONSEOS_DEV_SESSION`, not the no-Clerk case. | Require Clerk in the hosted env; make the prod fallback **fail closed** (refuse to boot privileged when Clerk absent in production). Verify live. | S | D1 |
| **D3** | 🔒 | **Founder must authorize the mock-safe hosted demo** and reconcile it with the "no production deploys" rule (ADR-0019 makes it v0.3-gated). | Founder authorization + roadmap carve-out (demo-deploy vs v0.3-production) | S | founder |
| **D4** | ⚪ | Dashboard task `[14]` points at closed PR #14 | Clarify blockedReason → PR #94 (mirror what #94's branch already does); don't hand-copy #89–93 entries to master | S | — |
| **D5** | 🟡 | No in-app sign-in/up surface for an authenticated deploy option | If demo is authenticated: add an `(auth)` route group + Clerk components + account-picker | M | D2, D3 |
| **D6** | 🟡 | No security headers / hardened `next.config` for a public host | Add `headers()` + `output: 'standalone'` in the hardening PR | S | D1 |
| **D7** | 🟡 | No e2e/smoke test over the walkthrough the demo showcases | Add a Playwright/route smoke test before go-live | M | D1 |
| **D8** | 🟡 | 5 overlapping docs PRs + the dashboard conflict magnet strand every PR | Merge #93 superset, close #89–92; stop branches editing `dashboard-data.json` | M | — |
| **D9** | ⚪ | Version/health/route staleness (`0.1.0`, shallow health probe, stale `api-spec`, unwired `getAutomationById`) | Bump version, deepen `/api/health` (DB check), fix `api-spec`, merge Node-20 pin #88 | S | — |

### 4.2 `v0.3-production` — live providers, gated on authorization

| ID | Sev | Gap | Close action | Effort | Depends on |
|---|---|---|---|---|---|
| **P1** | 🟠 | **Read-first arch/impl docs describe the superseded provider stack** (Grok/gateway/Redis/Twilio-primary/Cal.com) as authoritative, no per-doc banner | Land docs superset PR #93, then a spec-reconciliation pass rewriting the 8 arch specs + PHASE/IMPL/BACKLOG + product-spec + PRD KPI to ADR-0031→0037. **Doc-only.** | L | — |
| **P2** | 🔒 | **v0.3 event-ledger substrate not built** (`events`, `call_sessions`, `tool_calls`, `*_profiles`, `crm_mappings`). *(Correction: this is **v0.3 scope**, NOT a v0.2 defect — v0.2 closeout is genuinely complete. Several docs mislabel these tables "v0.2.")* | **Do-now (doc-only):** fix the "v0.2" labels in `PHASE_PLAN`/`BACKLOG`/`DATA_MODEL`/`api-spec`/`automation-flows`. **Gated:** building the tables needs founder OK to land data-only pre-authorization (Q2). | L | Q2 |
| **P3** | 🟡 | Webhook-signature contract specified 3 ways; ADR-0009 table omits Telnyx/Vapi (they're inconsistent, not unspecified) | Reconcile the 3 docs + ADR-0009 table to one provider set now (doc-only); enforcement gated with P4 | M | — |
| **P4** | 🔒 | Provider webhook **signature validation unbuilt** (ADR-0009 mandatory before any live mutation) | Under v0.3 auth, implement per-provider verifiers using the working `lib/auth/clerk-webhook.ts` pattern before wiring any mutation | M | v0.3 auth |
| **P5** | 🟡 | **CAL interfaces + Telnyx/Calendly mocks don't exist; `VoiceProvider` conflates carrier + agent.** *(Buildable **now**, mock-only, per the v0.3 authorization brief §1.)* | Build the mock-only CAL set (`CarrierProvider`/`VoiceAgentProvider`/`SmsProvider`/`CrmProvider`/`SchedulingProvider`) + Telnyx/Calendly mock stubs; reshape `VoiceProvider` | M | — |
| **P6** | 🔒 | Prisma provider enums omit Telnyx/Calendly and disagree with each other | Fix `DATA_MODEL.md` vocabulary now (doc); queue the enum migration into the authorized v0.3 schema PR | S | v0.3 auth (migration) |
| **P7** | 🔒 | **Production key posture (KMS/Vault) promised but unwritten** — single env key, no rotation | Under v0.3 auth, write the KMS/Vault ADR + rotation before storing any live credential | M | v0.3 auth |
| **P8** | 🔒 | Live provider adapters absent; credential encryption unwired (expected gate) | Under v0.3 auth, implement adapters behind the factory (P5) with mock fallback; wire encryption at the boundary | XL | v0.3 auth; P4/P5/P7 |
| **P9** | ⚪ | Scheduling/status canon drift (Calendly vs Cal.com; closeout status) | Fold into the P1 reconciliation PR | S | — |

### 4.3 `gtm-commercial` — sell, onboard, invoice

| ID | Sev | Gap | Close action | Effort | Depends on |
|---|---|---|---|---|---|
| **C1** | 🟠 | **Three conflicting pricing taxonomies, no rule for what a prospect is quoted** | **Founder picks one canonical taxonomy;** delete/replace the other two across docs, site, and the admin-billing mock | M | founder (Q5) |
| **C2** | 🟠 | **No in-app path to author a Readiness Assessment / generate the proposal / persist `/audit` intake** (`/audit` persists nothing today) | Add assessment accessors + authoring UI + scoring; make `/audit` persist a lead/`AssessmentReport` and notify an operator | L | C1, write-path auth (Q7) |
| **C3** | 🟠 | **No in-app path to create or sign an Engagement** (close/onboard a paying client) | Add engagement accessors + `/api/engagements` + admin convert-and-sign UI | L | C2, Q7 |
| **C4** | 🟠 | **No onboarding workflow** to capture the 10 required client inputs | Model the 10 inputs + build intake + qualification gate | L | C3 |
| **C5** | 🟡 | Onboarding depends on the Clerk provisioning webhook (no JIT session) | Provision the Clerk webhook in the target env, or add JIT provisioning in session resolution | M | C4 |
| **C6** | 🟡 | Primary conversion CTA unresolved across assets ("Book a Revenue Recovery Demo" vs "Book a Revenue Memory Diagnostic" vs site variants) | Founder picks one CTA; apply across site + collateral | S | C1 (Q6) |
| **C7** | 🟡 | Brand identity assets (logo/wordmark/favicon/OG) not produced | Produce wordmark/mark SVGs, favicon set, OG image; wire into layout/metadata | M | C1 |
| **C8** | 🔒 | **Money rail absent** (invoicing, outcome-fee ledger, Stripe billing, in-app tier selection) — v0.5 scope | Under v0.5 auth, build the pricing engine + Stripe billing + outcome-fee ledger + invoicing — **OR** bridge the first pilot with founder-approved manual/off-platform invoicing (Q8) | XL | v0.5 or Q8 |

### 4.4 `post-launch`

| ID | Sev | Gap | Close action | Effort |
|---|---|---|---|---|
| **PL1** | ⚪ | Tenant isolation has no DB-level (RLS) backstop | Add `account_id` RLS policies as defense-in-depth | M |
| **PL2** | ⚪ | No observability (error tracking / analytics) wired | Init Sentry + PostHog before/at first live client | S |
| **PL3** | ⚪ | Git hygiene: sync-noise history, stranded dependabot #95, orphan local branch | Squash/side-file the sync bot; rebase+merge #95; triage the orphan branch | S |

---

## 5. The critical path to deployment

Sequenced from today (2026-07-12) by real dependencies. **Human/founder gates are called out — they are the actual pacing constraint, not the code.**

### Track A — Aug-15 mock-safe hosted demo

| # | Milestone | Gate | Gaps |
|---|---|---|---|
| 1 | **Founder authorizes the mock-safe hosted demo** + adds the roadmap carve-out | 🔒 Governance (human) | D3 |
| 2 | Close **#27 v0.3-demo scope** (currently 50%) — decide what's in/out for Aug 15 | Scope sign-off | D3, D4 |
| 3 | Rebase + human-merge **PR #94** (demo code) + Node-20 pin **#88**; add host/CD config | CI green + human merge | D1, D4, D9 |
| 4 | **Verify fail-closed auth** (aj_admin fallback unreachable), add security headers, walkthrough smoke test | 🔒 Security review + smoke pass | D2, D5, D6, D7 |
| 5 | Provision **production env + secrets** for the demo (L-02, Doppler) | 🔒 Human secret provisioning | D1 |
| 6 | **Go-live** the Aug-15 mock-safe hosted demo (L-03) | 🔒 Readiness checklist + human go-live | D1, D2, D3 |

*Reversible, no-authorization-needed prep that can start **immediately** and de-risks the date:* merge the stranded docs (#93), fix the auth fallback (D2), add host config + smoke test, bump version. See §7.

### Track B — reconciliation (doc-only, do before any v0.3 build; parallel to Track A)

| # | Milestone | Gate | Gaps |
|---|---|---|---|
| 7 | Reconcile the read-first arch/impl docs, webhook-signature contract, `DATA_MODEL` vocabulary, scheduling/status drift to the **ADR-0031→0037** canon | Merge #93 + spec-reconciliation PR | P1, P3, P6, P9 |

### Track C — v0.3 production (gated on founder authorization)

| # | Milestone | Gate | Gaps |
|---|---|---|---|
| 8 | *(Optional, pre-gate)* Build the **mock-only CAL** interface set + Telnyx/Calendly mock stubs; reshape `VoiceProvider` | Mock-fallback boot guarantee preserved (auth brief §1) | P5 |
| 9 | *(If founder OKs Q2)* Land the v0.3 **event-ledger substrate** as data-only forward-compatible migrations | Founder OK + isolation tests | P2 |
| 10 | **FOUNDER AUTHORIZES v0.3** — unlocks live providers, real billing, Phase-1 Business Memory, production deploys | 🔒 **The gate for the entire v0.3 lane** | P4, P6, P7, P8 |
| 11 | Implement webhook signature validation (ADR-0009), KMS/Vault ADR + rotation, enum migration, live adapters behind the mock-fallback factory; provision first pilot tenant | v0.3 auth + gates green | P4, P6, P7, P8 |

### Track D — commercial (gated on positioning + write-path/money decisions)

| # | Milestone | Gate | Gaps |
|---|---|---|---|
| 12 | Resolve **one** pricing taxonomy + CTA + brand assets; build assessment authoring + `/audit` persistence, engagement create/sign, 10-input onboarding | Founder decisions (Q5/Q6/Q7) + gates green | C1–C7 |
| 13 | **Onboard + invoice the first paying client** | 🔒 v0.5 money-rail **OR** founder-approved manual invoicing (Q8) | C8 |

---

## 6. Founder decisions required (the human gates)

These are **recommend-only** items — they are yours to make, and the plan cannot advance past them without a call. Listed in the order they block work.

| # | Decision | Why it blocks | Recommendation |
|---|---|---|---|
| **Q1** | Authorize the **Aug-15 mock-safe hosted demo** + add a demo-deploy carve-out to the "no production deploys" rule | Go-live is prohibited by the standing hard rule without it (ADR-0019 makes the demo v0.3-gated) | **Authorize**, with an explicit "mock-safe, Clerk-gated, no live providers" carve-out — it's the whole point of the Aug-15 milestone |
| **Q2** | May the **v0.3 event-ledger substrate tables** land data-only *before* full v0.3 authorization? | Unblocks P2 schema work without opening the live gate | **Yes, data-only** — additive tables + isolation tests are reversible and de-risk v0.3; keep adapters/wiring gated |
| **Q3** | **Authorize v0.3** (live providers, real billing, production deploys) | The single gate for the entire v0.3 lane | Not yet — reconcile docs (Track B) + settle providers (Q4) first, then authorize a *narrow* first slice |
| **Q4** | Confirm final provider selection (Telnyx + Vapi primary, Twilio failover, HubSpot SoR, Calendly) | Enum migration + CAL scaffolding need a settled canon | **Ratify the ADR-0031→0037 baseline** so code can be built against it |
| **Q5** | **One commercial taxonomy:** "Revenue Recovery" (matches code + shipped site + `Engagement` enum) vs "Business Memory System" (the "ratified" GTM roadmap) | Reps and the product must quote exactly one; blocks C1–C4, C6, C7 | *Founder's call (doctrine/positioning — I hold no pen here).* Note the **cheapest-to-ship** path is Revenue Recovery (code + site already match); the GTM roadmap's ADR-0022/0028 point the other way. **This conflict should be resolved with a superseding ADR either way.** |
| **Q6** | Primary conversion **CTA** wording | Split across 3+ variants; blocks C6 | Pick one and apply everywhere (follows Q5) |
| **Q7** | Authorize building the **commercial write path** (assessment authoring, engagement create/sign, real `/audit` capture) — and whether `/audit` may capture real prospects pre-v0.3 | Blocks C2–C4 | Authorize `/audit` real-capture early (low risk, high GTM value); sequence the rest after Q5 |
| **Q8** | First client: **manual/off-platform invoicing** (Stripe dashboard) as a bridge, or wait for the v0.5 money rail? | The critical path can't terminate at revenue without one | **Bridge manually** for the first 1–3 pilots; build the money rail (v0.5) once a pilot proves the model |

---

## 7. Recommended immediate actions (reversible, no authorization needed)

These are **execution-layer, do-now** items I recommend proceeding on — all reversible, none open a gate, all de-risk the Aug-15 date and shrink the register:

1. **Land the stranded doc reconciliation.** Rebase + merge **PR #93** (docs superset) and close #89–92 as subsumed. This alone closes/shrinks **P1, P3, P6, P9, C-drift** and the biggest chunk of §2/§3 drift. *Highest leverage move in the plan.*
2. **Fix the fail-open auth (D2).** Make the no-Clerk production fallback **fail closed** (refuse privileged boot when `CLERK_SECRET_KEY` absent in production). Small, isolated, security-critical — do it regardless of the demo timeline.
3. **Add the demo host artifact (D1) + hardening (D6, D7, D9).** `vercel.json` + Neon wiring per ADR-0019, security headers, a walkthrough smoke test, version bump, deeper `/api/health`. Rebase PR #94 for the richer demo surface.
4. **Stop the `dashboard-data.json` conflict magnet (D8/PL3)** — a `.gitattributes` merge strategy or moving sync to a side file.
5. **Fix the mislabeled "v0.2" table references (P2 doc half)** and the version/roadmap-status drift (§2.3) — pure doc corrections.
6. **(Optional, buildable now) mock-only CAL scaffolding (P5)** per the v0.3 authorization brief §1 — advances v0.3 architecture while touching zero live surface.

**What I will *not* do without your say-so:** merge anything to `master`, deploy, touch live providers/secrets, or resolve the positioning/pricing/CTA questions (Q5/Q6 — doctrine/brand, your pen). Those are surfaced above as decisions, not actions.

---

## Appendix — method & caveats

- **Analysis basis:** 8 parallel reader agents over the doc corpus + code + git, a synthesis pass, and a 16-gap adversarial verification pass (10 confirmed, 5 downgraded, 1 reclassified). One reader (deploy-ops-security) hit a structured-output failure; that slice was covered by first-hand reading of `DEPLOYMENT.md`, `ops/RESPONSEOS_DEPLOYMENT_PLAN.md`, the v0.3 authorization brief, and the provider-readiness spec.
- **Key first-hand verifications:** the D2 fail-open ([`proxy.ts`](proxy.ts), [`lib/auth/session.ts`](lib/auth/session.ts)); tenant isolation enforcement (`lib/data/leads.ts`); webhook stubs (`app/api/webhooks/{stripe,vapi}/route.ts`); the live-site Revenue-Recovery positioning ([`app/(marketing)/page.tsx`](app/(marketing)/page.tsx)); ADR-0019's demo-deploy definition (`DECISIONS.md` L263-292).
- **Governance:** per AGENTS.md + the AJ Digital governance kernel, this doc is L1 draft/recommend. It merges nothing, deploys nothing, and defers every above-L1 action (deploys, live providers, positioning/pricing) to explicit human authorization.
- **Not updated here:** `dashboard/dashboard-data.json` (intentionally — to avoid feeding the conflict-magnet flagged in D8/PL3). A dashboard task for this analysis can be added on request.

---

## Addendum — draft progress (2026-07-12, this session)

Reversible, no-authorization-needed drafts landed **on this branch, uncommitted** (nothing merged/deployed). All four fast gates green: `typecheck` · `lint` · `npm test` (151/151) · `build`.

| Gap | Status | Change |
|---|---|---|
| **D2** (fail-open auth) | ✅ drafted + tested | `lib/auth/session.ts` — opt-in `RESPONSEOS_REQUIRE_AUTH` fails closed when Clerk absent; default byte-identical (mock-first boot preserved). +3 unit tests. |
| **D6** (security headers) | ✅ drafted | `next.config.ts` — security headers + `poweredByHeader:false` + `output:'standalone'`. |
| **D7** (demo smoke test) | ✅ drafted | `tests/unit/demo-walkthrough.smoke.test.ts` — guards step→page mapping, route publicness, cross-refs, Phase-1 gates (ADR-0034), mock-safe states. |
| **D9** (version drift) | ✅ partial | `package.json` + `/api/health` → `0.2.0`. (Deeper health probe deferred.) |

**Paused for explicit human approval (governance L4/L6):**
- `vercel.json` deploy pipeline (**L4** deploy config; also gated on **Q1** + intersects issue #26 seed-idempotency) — blueprint proposed, not written.
- `.env.example` `RESPONSEOS_REQUIRE_AUTH` placeholder (**L6** secrets-file) — one-liner proposed, file left untouched from HEAD.

**Note for PR #94:** it also carries auth hardening to `proxy.ts`/`session.ts`. When it's rebased/merged, reconcile it with the `RESPONSEOS_REQUIRE_AUTH` approach here to avoid divergent fixes.

---

*ResponseOS — GTM Gap & Deployment Plan. Documentation/recommend-only. No deploys, no live providers, no positioning changes authorized by this document.*
