# Agent Capability Studio — Architecture Assessment

**Status:** `DOCUMENTED_ONLY` — assessment only. No implementation is authorized by this document.
**Date:** 2026-09-13
**Base commit:** `ec4eb1d`
**Author:** Claude Opus 5 (agent-authored; requires independent review per `AGENTS.md`)
**Requested by:** Operator brief, "ResponseOS Agent Capability Studio"

> This is the "First Deliverable" the brief requires before implementation. It answers the
> brief's sixteen sections and closes with the doctrine §21 fifteen-question checklist.
> Every current-state claim is tagged `VERIFIED` (read in this repository at `ec4eb1d`),
> `INFERRED`, or `UNKNOWN`, per the brief's Phase 2 requirement.

---

## 1. Executive Recommendation

### **Proceed with reduced scope — after one architecture decision.**

The brief's capability model is sound and unusually well-matched to this repository. Most of
its governance primitives are *already implemented here* — not as documentation, but as
working, tested code. That is the good news, and it is substantial.

The blocking finding is different from the one the brief anticipates:

> **ResponseOS has orchestration, but no *generic* capability execution engine.** Code-owned,
> hardcoded pipelines exist — `runCrmSyncForCall` (`lib/crm/syncFinalizedCall.ts`) is a real
> multi-step, idempotent orchestrator with its own state machine on `CrmSyncOperation`, and
> `answerProfessionalQuestion` (`lib/professional/receptionist.ts`) executes deterministic
> policy branching per conversational turn. What does **not** exist is a runtime that walks
> *authored* steps, evaluates *authored* conditions, or suspends at an approval gate. Neither
> pipeline records a `WorkflowRun`: nothing in `app/` or `lib/` calls `recordWorkflowRun` or
> `finalizeWorkflowRun` — only integration tests and seed scripts do.

ADR-0017's claim that "core RECOVER orchestration lives in code" is therefore **accurate**. The
gap is not that orchestration is missing; it is that orchestration is *hardcoded per use case*
and its execution is not recorded against a capability version.

This reframes the work in the Studio's favour compared with a from-nothing engine build: there
is a concrete, working pipeline to generalize. But the brief's core procedure model — ordered
typed steps, deterministic conditions between them, an approval gate that *pauses execution* —
still has no runtime. The brief lists "execution-engine gaps" under its own §15 risks; this
assessment promotes that from a risk to the headline constraint.

**Three findings drive the reduced scope:**

**(a) Much of the governance stack the brief specifies is already built** — specifically:
explicit `allowedTools` allowlists, fail-closed default-deny resolution, gate-bound
authorization, version pinning by checksum, immutable publication manifests with hash
verification, forbidden-field scanning, and audit with before/after refs. `ExecutionPolicy`
(`lib/agentExecution/policy.ts`) already implements explicit `allowedTools` allowlists,
fail-closed default-deny resolution, gate-bound authorization, `templateVersion` pinning,
required disclosure, and prohibited-advice lists. `PROSPECT_RECEPTIONIST_TEMPLATE` is already
an immutable, SHA-256-checksummed capability artifact with preflight validation.
`BootstrapPromotion` is already a hash-pinned publication manifest with a draft→exported
lifecycle and a forbidden-field scanner. The brief asks for these; they exist.

**(b) N = 1.** Exactly one capability template exists, and four hardcoded execution policies.
The Studio's entire value proposition is *reducing the marginal cost of capability number N*.
At N=1 — with that one capability not yet validated against a live provider path — building
authoring infrastructure is the premature abstraction `AGENTS.md` explicitly prohibits
("Three similar lines is better than a premature abstraction"). Doctrine §22 puts the pivot at
item 7 ("reconcile one pilot manually, from inbound event to collected outcome") and defers
intelligence expansion to item 13. **Item 7 has not happened.**

**(c) Git already provides most of what the brief wants to rebuild in Postgres.** Immutability,
versioning, semantic diff, independent review, human-merge approval, and audit trail are the
existing PR process. That is not a rhetorical point — it is the pattern this repository already
uses for capability artifacts, and it is enforced by `AGENTS.md` and the merge policy.

Being fair to the brief: Git does **not** provide three things it legitimately needs —
**per-tenant runtime version pinning**, **permission-broadening detection surfaced at review
time**, and **a simulation trace**. Those three are real new surface and justify real work.

**The narrowest safe default** (per the brief's own Execution Gate, which directs naming the
decision precisely rather than stopping):

> Keep the **capability definition of record in Git** as a typed, checksummed module — exactly
> the `PROSPECT_RECEPTIONIST_TEMPLATE` pattern, generalized. Use the **database only for the
> release assignment**: which tenant runs which checksummed version, under which execution mode,
> with which approval record. Defer the authoring UI until ≥3 capabilities exist and doctrine
> §22 item 7 is done.

This preserves the repository's proven pattern — `AgentProfile.system_policy_json` is already
compared *byte-identically* against a frozen Git constant in `lib/prospectBootstrap/service.ts`
— and it defers the expensive, reversible-only-at-cost decision (a DB-backed authoring model
and UI) until evidence justifies it.

**What must not be built now:** the step builder UI, the graph canvas, AI-assisted authoring,
the component library, semantic diff UX, and the DB-backed draft/version tables. Every one is
premature at N=1 without an engine.

---

## 2. Verified Current State

| Area | Status | Evidence | Implication |
|---|---|---|---|
| **Generic step-execution engine** | **VERIFIED ABSENT** | No step-walker, condition evaluator, or suspend/resume primitive anywhere in `lib/`. `lib/automations/`, `lib/notifications/` contain only `.gitkeep` | **Blocking for the brief's step model.** Authored steps, authored conditions, and pausing approval gates have no runtime. |
| **Hardcoded orchestration** | **VERIFIED PRESENT** | `runCrmSyncForCall` (`lib/crm/syncFinalizedCall.ts:68`): sequenced provider calls with idempotent state transitions on `CrmSyncOperation`, evidence references, redacted errors | ADR-0017's "core orchestration lives in code" is **accurate**. There is a working pipeline to generalize — the engine gap is narrower than a from-scratch build. |
| **ResponseOS-owned turn logic** | **VERIFIED PRESENT** | `answerProfessionalQuestion` (`lib/professional/receptionist.ts:126`) → `resolveCategory` → `applyPolicy(category, policy)` → deterministic branch (`refuse`/`escalate`/`tool_lookup`/`unavailable`) | **Runtime ownership is split by lane.** The professional/internal-demo lane executes turns in ResponseOS; the prospect-demo lane pushes a prompt to a provider assistant. A precedent for the brief's "interpretation → structured value → deterministic policy" pattern **already exists in code**. |
| **`WorkflowRun` has no production writer** | **VERIFIED** | `recordWorkflowRun`/`finalizeWorkflowRun` called only from `tests/integration/data-accessors.integration.test.ts`, `prisma/seed.ts`, `prisma/demo-sandbox.ts` | Execution lineage is designed but **not operational**. No provenance claim may be made. |
| `WorkflowRun` model | VERIFIED (substrate only) | `prisma/schema.prisma:1142`; read+write accessors in `lib/data/workflowRuns.ts`; comment: "pure state storage. Throws no events, kicks no retries" | Execution *record* exists. Execution *engine* does not. `workflow_id` is a bare string, **not a FK** — deliberate (ADR-0017). |
| Execution policy / tool allowlist | **VERIFIED SHIPPED** | `lib/agentExecution/policy.ts` (164 lines): 4 frozen `ExecutionPolicy` objects, `allowedTools`, `resolveExecutionPolicy` fails closed to `PROSPECT_DEMO` | The brief's "Tool Policy" + "default-deny" is **already implemented** at mode granularity. Extend, do not rebuild. |
| Gate-bound authorization | **VERIFIED SHIPPED** | `EXECUTION_MODE_ACTIVATION_GATES` binds each mode to a *named* gate; a boolean would let one approval unlock another mode | The brief's "Safety Gates" have a working, well-reasoned precedent. |
| Runtime-readiness validation | **VERIFIED SHIPPED** | `lib/agentExecution/operatingConfiguration.ts`: `evaluateOperatingConfiguration` returns `{ready, missing, conflicts}` | The brief's validation layer 3 exists for tenant config. |
| Immutable checksummed template | **VERIFIED SHIPPED** | `lib/prospectBootstrap/template.ts`: `PROSPECT_RECEPTIONIST_TEMPLATE` + `PROSPECT_RECEPTIONIST_TEMPLATE_CHECKSUM` (SHA-256); `validateProspectAssistantPreflight` | A capability *version* already exists — Git-authored, not DB-authored. **The pattern to generalize.** |
| Hash-pinned publication manifest | **VERIFIED SHIPPED** | `BootstrapPromotion` (`schema.prisma:916`): `manifest_json`, `manifest_hash`, `source_snapshot_hash`, draft→exported→imported; `validatePromotionManifest` + `assertNoForbiddenPromotionKeys` | The brief's "publication resolution to deterministic manifest" has a working precedent. |
| Git-as-source-of-truth for policy | **VERIFIED SHIPPED** | `lib/agentExecution/policy.ts` docstring: `service.ts` "compares a stored `AgentProfile.system_policy_json` against that frozen object, so its shape and values must not drift" | The repo has **already decided** definition lives in Git, DB holds the assignment. |
| Audit substrate | **VERIFIED SHIPPED** | `AuditLog` (`schema.prisma:645`) with `before_ref`/`after_ref`/`category`/`target_type`; real writers in `lib/auth/clerk-sync.ts`, `lib/data/prospectIntakes.ts`, `lib/professional/intake.ts`, `lib/prospectBootstrap/service.ts` | Publication and permission-broadening audit can reuse this directly. `AuditCategory.workflow` already exists. |
| Approval workflow | **VERIFIED SHIPPED** | `app/api/admin/prospect-bootstraps/[id]/approve|activate|complete/route.ts`; `BootstrapPromotionStatus` | An operator approval lifecycle exists and is a usable model. It is **request/response**, not a *suspended execution* gate. |
| Mock-first provider resolution | **VERIFIED SHIPPED** | `lib/providers/resolve.ts` (ADR-0001): env-absent → mock; `createLive` omitted → always mock | Simulation can run safely today. Strongest enabler in the repo. |
| Test + fixture infrastructure | VERIFIED | 65 test files; `tests/{unit,integration,e2e,fixtures,factories}`; tenant-isolation matrix in `data-tenant-matrix.integration.test.ts` | Simulation harness has foundations. |
| Operator role exists | VERIFIED | `UserRole` enum (`schema.prisma:42`): `aj_admin`, `operator`, `client_admin`, `client_viewer` | A non-engineer operator persona is modeled. *Whether staff in that role author capabilities today* is **UNKNOWN** — operator decision. |
| `admin/playbooks` surface | **VERIFIED DOCUMENTED_ONLY** | `app/(admin)/admin/playbooks/page.tsx`: hardcoded 3-element array, banner "activates in v0.3" | Not a system. **Naming-collision risk**: "playbook" vs "capability" vs "template". Must be reconciled. |
| `Automation` model | VERIFIED (unused by Studio path) | `schema.prisma:360`, `AutomationTriggerType`, `AutomationStatus`; `app/(admin)/admin/automations/page.tsx` | Pre-existing trigger concept. **Overlaps the brief's Triggers.** Must not be duplicated. |
| `AgentProfile.system_policy_json` | **VERIFIED SHIPPED** | `schema.prisma:1210`; parsed by `lib/professional/policy.ts` | The existing per-tenant capability-config row. **The natural extension point.** |
| Conversation runtime ownership | **VERIFIED (split)** | Prospect-demo lane: prompt + `dynamicVariables` pushed to a provider assistant (`lib/prospectBootstrap/template.ts`). Professional lane: `answerProfessionalQuestion` executes turns in-process | **Both models are in force simultaneously.** A capability engine must decide which lane it targets; in-call deterministic steps are executable only in the ResponseOS-owned lane. |
| Evidence writers (`Call`, `CallTranscript`, `QaLog`) | **VERIFIED SHIPPED** | `lib/providers/telnyx/normalize.ts:154,191` (call + transcript upsert); `lib/data/callTranscripts.ts:132`; `lib/data/qaLogs.ts:90` | Unlike `WorkflowRun`, these have real production writers. Evidence capture is operational. |
| v0.3 authorization | VERIFIED (closed) | `ROADMAP.md` "Next milestone: v0.3 — gated"; doctrine §23 D-1 open | No live provider path. Simulation-only is the *only* lane available. |
| Doctrine §22 item 7 (the pivot) | **VERIFIED NOT DONE** | §22 "Item 7 is the pivot"; no reconciled pilot in repo or changelog | The Studio optimizes capability N+1 before capability 1 is proven. |
| Latest ADR | VERIFIED | `ADR-0053` is highest in `docs/DECISIONS.md` | A new decision would be **ADR-0054**. |

---

## 3. Existing Reusable Primitives

Concrete, by path:

| Primitive | Path | Reuse for |
|---|---|---|
| `ExecutionPolicy` + `resolveExecutionPolicy` | `lib/agentExecution/policy.ts` | Tool policy, default-deny, capability permission block |
| `EXECUTION_MODE_ACTIVATION_GATES` | `lib/agentExecution/policy.ts` | Safety gates, publication gating |
| `evaluateOperatingConfiguration` | `lib/agentExecution/operatingConfiguration.ts` | Validation layer 3 (runtime readiness) |
| `PROSPECT_RECEPTIONIST_TEMPLATE` + checksum | `lib/prospectBootstrap/template.ts` | **The capability-version pattern to generalize** |
| `validateProspectAssistantPreflight` | `lib/prospectBootstrap/template.ts` | Pre-activation validation |
| `contentHash`, `validatePromotionManifest`, `assertNoForbiddenPromotionKeys` | `lib/prospectBootstrap/{memory,promotion}.ts` | Publication manifest hashing + secret-leak prevention |
| `BootstrapPromotion` | `prisma/schema.prisma:916` | Publication lifecycle precedent |
| `AuditLog` + `recordAuditLog` | `schema.prisma:645`, `lib/data/auditLogs.ts` | Publication audit, permission-broadening record |
| `WorkflowRun` + `recordWorkflowRun`/`finalizeWorkflowRun` | `schema.prisma:1142`, `lib/data/workflowRuns.ts` | Execution record (needs a caller) |
| `resolveProvider` | `lib/providers/resolve.ts` | Simulation isolation |
| `lib/mock/*` (16 modules) | `lib/mock/` | Simulation fixtures |
| `AgentProfile.system_policy_json` | `schema.prisma:1210` | Per-tenant capability assignment |
| `runCrmSyncForCall` | `lib/crm/syncFinalizedCall.ts:68` | **The orchestration pipeline to generalize** — idempotent steps, state transitions, evidence refs |
| `answerProfessionalQuestion` + `applyPolicy` | `lib/professional/receptionist.ts:126,37` | **Deterministic policy-branch precedent** — classify → structured value → policy decision |
| Telnyx call/transcript normalizer | `lib/providers/telnyx/normalize.ts:154` | Post-call evidence ingest |
| `QaLog.rubric_version` | `schema.prisma:1114` | Versioned-artifact precedent |
| Tenant-isolation matrix test | `tests/integration/data-tenant-matrix.integration.test.ts` | Extend for new tables |
| `Result`/`ok`/`err` convention | `lib/data/*` | Validation return shape |

---

## 4. Architecture Gaps

Only what is genuinely missing for a *reduced-scope* MVP:

1. **A capability execution engine** — ordered step traversal, deterministic condition
   evaluation, suspend/resume at approval gates. **The dominant cost.** Nothing exists.
2. **Suspended-execution approval state.** Existing approvals are request/response over HTTP
   routes; none suspends and resumes a run.
3. **A typed capability schema** generalizing the single hardcoded template to N.
4. **Per-tenant runtime version pinning** — which tenant executes which checksummed version.
   `AgentProfile.system_policy_json` holds policy but no pinned capability version.
5. **Evidence classification** (`KNOWN`/`INFERRED`/`ASSUMED`/`UNKNOWN`) as structured state.
   No enum or field exists.
6. **Simulation trace record.** Mocks exist; a persisted, inspectable trace does not.
7. **Permission-broadening detection** between two versions.

Explicitly **not** gaps (already present): tool allowlists, default-deny, checksummed
immutability, publication manifests, audit, mock isolation, tenant scoping, approval routes.

---

## 5. Proposed Domain Model (reduced scope)

| Entity | Kind | Notes |
|---|---|---|
| `CapabilityDefinition` | **new (Git, not DB)** | Typed module + SHA-256 checksum. Generalizes `PROSPECT_RECEPTIONIST_TEMPLATE`. Identity = stable slug. |
| `CapabilityVersion` | **new (Git)** | The checksum *is* the version. Immutable by construction — a Git artifact cannot be mutated in place. |
| `CapabilityReleaseAssignment` | **new (DB table)** | The one genuinely new table: `account_id`, `capability_slug`, `version_checksum`, `execution_mode`, `approved_by`, `approved_at`, `status`. |
| `ExecutionPolicy` | **extension** | Add per-capability policy alongside per-mode. Effective policy = intersection (never union — intersection cannot escalate). |
| `WorkflowRun` | **extension** | Add `capability_slug` + `capability_version_checksum`. Gives version-pinned lineage. Additive, nullable. |
| `AuditLog` | **existing, unchanged** | Reuse `category: workflow`, `before_ref`/`after_ref` for publication + permission deltas. |
| `AgentProfile` | **existing, unchanged** | Remains the tenant config row. |
| `SimulationRun` | **deferred** | Persist only when simulation proves it needs history. Start in-memory. |
| `Component` / `ComponentVersion` | **deferred** | Extract only when ≥3 capabilities share a block. Premature at N=1. |
| `CapabilityDraft` | **deferred** | A Git branch *is* the draft. |

**Net new schema for MVP: one table, two nullable columns.** That is the smallest model that
creates version-pinned execution lineage.

**Why one table and not ten.** "Immutable published version" costs differently in each design.
In a DB model immutability must be *enforced* — update guards, triggers, tests proving no
mutation path. In the Git model it is free: a checksummed committed artifact cannot change
without changing its hash, and the merge policy already requires independent human review to
alter it. The substrate that makes the hardest invariant free is the cheaper one to get right.

---

## 6. Versioning Model

- **Drafting** — a feature branch. Components referenced by import; normal code review applies.
- **Publication** — merge to `master`. The checksum over the frozen capability object is the
  version identifier, computed exactly as `PROSPECT_RECEPTIONIST_TEMPLATE_CHECKSUM` is today.
- **Resolution** — the checksum covers the whole object graph (prompt text, scripts, steps, tool
  policy, validators), so pinning one hash pins every dependency transitively. This is the
  brief's "deterministic manifest," obtained structurally rather than by assembling one.
- **Runtime pinning** — `CapabilityReleaseAssignment` names an exact checksum per tenant.
  Execution resolves *that* checksum or **fails closed**. Never `latest`/`current`/`head`.
- **Restoration** — re-point the assignment at a prior checksum (both artifacts remain in Git).
  No "restore" mutation; it is a new assignment row.
- **Deprecation** — assignment `status`. The artifact itself is never deleted, preserving the
  ability to reconstruct any historical execution.

---

## 7. Execution and Evidence Model

```text
Capability Definition   → Git module (slug) ......................... NEW
→ Published Version     → SHA-256 checksum ......................... NEW (pattern exists)
→ Release Assignment    → CapabilityReleaseAssignment .............. NEW (1 table)
→ Workflow Run          → WorkflowRun + capability_version_checksum . EXTENSION
→ Execution Evidence    → AuditLog + Call/CallTranscript/QaLog ...... EXISTING
→ Business Outcome      → Appointment / LeadQualification /
                          ProfessionalOpportunity / RevenueMetrics .. EXISTING
```

**Honest gap, per the brief's instruction not to claim unimplemented provenance:** the *evidence*
end of this chain is real — `Call`, `CallTranscript`, and `QaLog` have verified production
writers (`lib/providers/telnyx/normalize.ts`, `lib/data/callTranscripts.ts`,
`lib/data/qaLogs.ts`). The break is precisely at **`WorkflowRun`, which no production code
writes**. So evidence is captured but cannot currently be attributed to a capability version.
Until a writer exists, version-pinned execution provenance is *designed*, not *operational*. No claim to the contrary should appear in any document,
dashboard, or customer-facing copy — doctrine §20 applies.

---

## 8. Permission and Governance Model

- **Tool permissions** — per-capability `allowedTools`, intersected with the mode's
  `ExecutionPolicy.allowedTools`. Intersection is structurally incapable of escalation.
- **Write boundaries** — reuse the existing capability booleans (`crmSyncEnabled`,
  `schedulingEnabled`, `paymentEnabled`, `outboundEnabled`). Do not invent parallel flags.
- **Default-deny** — inherited from `resolveExecutionPolicy`'s fail-closed behavior.
- **Human gates** — publication is a human merge (`AGENTS.md`, governance kernel). Activation is
  the existing operator approval route pattern. **Agents must not merge.**
- **Tenant scope** — `account_id` from authenticated server session only, never client input
  (`docs/SECURITY.md`). New table joins the tenant-isolation matrix test.
- **Publication controls** — `EXECUTION_MODE_ACTIVATION_GATES` continues to govern; a published
  capability still cannot run live without its named gate open.

---

## 9. Validation Model

| Layer | Where | Status |
|---|---|---|
| **Structural** | `typecheck` + a Zod schema over the capability module | Mostly free — the type system does it |
| **Governance** | New pure function: allowlist subset check, no undeclared tools, owner present, supported trigger, no gate bypass | **New. Small. High value.** |
| **Runtime readiness** | `evaluateOperatingConfiguration` + provider/adapter availability | **Exists**, needs extension |

The three must return distinct statuses: a capability can be structurally valid, governance-valid,
and still not runtime-ready (no live provider — which is the state of *every* capability today).

---

## 10. Simulation Architecture

Strongest area. `resolveProvider` guarantees env-absent → mock, and `createLive` omission forces
mock permanently. With no live credentials configured, simulation **cannot** reach an external
system — this is enforced by construction, not convention.

MVP: execute a pinned capability version against `lib/mock/*` fixtures, emitting an in-memory
trace (inputs, resolved context, steps, decisions, mock tool calls, gates, outputs, validation).
Assert expected downstream state via existing factories. Persist traces only if history proves
necessary.

**Constraint:** simulation is only as meaningful as the engine it exercises. Absent an engine,
"simulation" degrades to validating a static artifact — still useful, but it must not be
described as simulating execution.

---

## 11. UX Recommendation

**Recommendation: none of the four — no builder UI in MVP.**

Comparing as the brief requires:

| Option | Authoring speed | Governance | Complexity | Domain fit | Verdict |
|---|---|---|---|---|---|
| Sectioned forms | Medium | Good | Low | Good | Best *if* a UI is built |
| Ordered steps | High | Good | **High** (needs engine) | Best | Right target, wrong time |
| Graph canvas | Low | Poor | Very high | Poor | Reject (brief agrees) |
| Hybrid | Medium | Medium | Very high | Medium | Reject |

**If and when** a UI is warranted, the brief's ordered-step builder is correct and the graph
canvas correctly rejected. But at N=1, with the authoring population plausibly being engineers
and agents, a typed module + PR review *is* the authoring interface — and it already delivers
diff, review, approval, and audit. Build the UI when a non-engineer operator is actually blocked.

**Read-only operator surface is worth building:** a page listing capabilities, pinned versions
per tenant, validation status, and last simulation result. That is genuine operator value with
no authoring risk, and it gives `admin/playbooks` real content instead of a hardcoded stub.

---

## 12. Initial Capability Templates

**A — Missed Call Recovery.** Reusable blocks: resolve contact (`lib/data/contacts.ts`), retrieve
approved context (`BusinessMemorySnapshot`), classify urgency (`LeadUrgency` enum exists),
qualify (`lib/scoring/leadQualificationScore.ts` exists), attempt booking (`Appointment`),
escalate, record evidence (`AuditLog`). **Blocked:** outbound is `false` at every mode below
`MANAGED_AUTONOMY`, whose gate is `post-pilot-operator-authorization`. Recovery *contact* is
therefore not executable today in any authorized mode — simulation only.

**B — Inbound Lead Qualification & Booking.** Same context/qualify blocks, plus availability and
booking. `schedulingEnabled` is `true` only at `PRODUCTION_SUPERVISED`+, gated on
`v0.3-live-communications` (D-1, open).

**Both flagship capabilities are gate-blocked from live execution.** They can be authored,
validated, and simulated. Neither can run against a real caller until v0.3 is authorized. This
is the clearest evidence for reduced scope: the MVP's own acceptance criteria stop at simulation.

---

## 13. Implementation Sequence

Smallest reviewable increments. **Each is a separate PR; none is authorized by this document.**

1. **ADR-0054** — where the capability definition of record lives. *Decision only, no code.*
2. **Typed capability schema + checksum** — generalize the template pattern; port the existing
   prospect template to it as proof. Pure `lib/`, no schema change.
3. **Governance validator** — pure function + unit tests. No schema change.
4. **`CapabilityReleaseAssignment`** — one table, migration `0014`, data accessor, tenant-matrix
   test.
5. **`WorkflowRun` lineage columns** — two nullable columns; a writer on the existing post-call
   path.
6. **Simulation harness** — mock-backed, in-memory trace.
7. **Read-only operator view** — replace the `playbooks` stub.

**Stop after 7.** Re-evaluate the engine, builder UI, components, and AI authoring only with
≥3 capabilities and doctrine §22 item 7 complete.

---

## 14. Files Expected to Change

*Increments 1–7 only.*

```
docs/DECISIONS.md                              ADR-0054
docs/ROADMAP.md                                placement
docs/CHANGELOG.md                              per PR
docs/product/…-architecture-assessment.md      this file
dashboard/dashboard-data.json                  task tracking
lib/capabilities/{schema,checksum,validate,registry}.ts   new
lib/agentExecution/policy.ts                   extend (preserve frozen shapes)
lib/data/capabilityReleases.ts                 new
lib/data/workflowRuns.ts                       extend
prisma/schema.prisma                           +1 model, +2 nullable columns
prisma/migrations/0014_capability_release/     new
tests/unit/capabilities/*.test.ts              new
tests/integration/data-tenant-matrix…          extend
app/(admin)/admin/playbooks/page.tsx           replace stub
```

---

## 15. Risks and Unknowns

| Risk | Severity | Note |
|---|---|---|
| **No generic step-execution engine** | **Critical** | Authored steps/conditions/pausing gates have no runtime. Dominant cost; must be sized before committing. Partly mitigated: `runCrmSyncForCall` is a concrete pipeline to generalize rather than a blank page. |
| **Split runtime ownership** | **High** | Prospect-demo turns are provider-hosted; professional-lane turns are ResponseOS-executed. An engine must target one lane first, or it gets built twice. |
| Premature abstraction at N=1 | High | Directly contrary to `AGENTS.md` scope discipline. |
| Frozen-policy drift | High | `service.ts` compares `system_policy_json` byte-identically; any change to `PROSPECT_DEMO_POLICY` shape breaks stored-policy comparison. |
| Doctrine §22 ordering | High | Optimizes capability N+1 before item 7 (the pivot). |
| §22.1 adjacency | Medium | "Generalized multi-agent orchestration" is deferred. The brief disclaims marketplace/generic automation, but scope creep lands here. |
| Naming collision | Medium | `playbooks` / `Automation` / capability / template must be reconciled. |
| v0.3 gate | Medium | Both flagship capabilities are simulation-only. |
| Authoring audience | **UNKNOWN** | `operator` role exists in `UserRole`; whether such staff author capabilities is an **operator decision**. Materially changes UI value. |
| Provenance overclaim | Medium | `WorkflowRun` has no production writer. Doctrine §20 prohibits present-tense claims. |

---

## 16. ADR Decision

**Yes — ADR-0054 is required, and it is the first increment.**

> **Decision required:** Does the capability definition of record live in Git (typed,
> checksummed module) with the database holding only the release assignment — or does it live in
> the database as a draft/version model with an authoring UI?

This is ADR-grade because it (a) determines whether immutability is free or enforced, (b) either
preserves or inverts the existing `AgentProfile.system_policy_json`-vs-frozen-constant pattern,
(c) decides whether publication approval is the existing human-merge gate or a new in-app
approval authority, and (d) is expensive to reverse once an authoring UI exists.

**Recommended narrowest safe default:** Git-of-record + DB release assignment, revisited at
≥3 capabilities.

Secondary decisions to record: naming (`capability` vs existing `playbook`/`Automation`);
whether per-capability policy intersects the mode policy (**recommended**) or replaces it.

---

## Appendix — Doctrine §21 Checklist

| # | Question | Answer |
|---|---|---|
| 1 | Which layer (§8)? | Authoring/governance layer above execution, below product surface. Layer placement itself needs ADR-0054. |
| 2 | Built, integrated, or deferred (§11)? | **Partially deferred.** Schema+validation+pinning built; engine, UI, components deferred. |
| 3 | Improves the live pilot path? | **No — not yet.** No live path exists; both flagship capabilities are gate-blocked. |
| 4 | Produces or preserves evidence? | Yes — version-pinned lineage on `WorkflowRun` + `AuditLog`, once a writer exists. |
| 5 | Supports verified outcomes? | Indirectly. Does not itself verify outcomes. |
| 6 | Creates proprietary learning? | Yes — a governed library of service-business revenue procedures is a genuine compounding asset. **The strongest argument for the brief.** |
| 7 | Commodity we should buy? | **Partly already owned:** Git + the PR process supply immutability, diff, review, approval, audit. Runtime pinning, permission-delta detection, and simulation trace are legitimately new. |
| 8 | Duplicates CRM/FSM/telecom/workflow-platform (§5.2)? | Not if constrained as the brief specifies. Risk is real if step types generalize. |
| 9 | Vendor lock-in? | No. Reduces it (behavior pinned in our artifacts, not a provider console). |
| 10 | Preserves tenant isolation? | Yes, if `account_id` derives from session and the new table joins the tenant matrix test. |
| 11 | Increases attribution ambiguity? | **Reduces it** — version-pinned execution makes "which behavior produced this outcome" answerable. |
| 12 | Creates an unsupportable claim (§20)? | **Yes, if mishandled.** No provenance claim may be made while `WorkflowRun` has no production writer. |
| 13 | Requires a new human-approval control (§16)? | Yes if DB-authored (new in-app publication authority). **No** under the recommended Git default — human merge already is the control. |
| 14 | Increases compliance exposure? | Slightly — authored behavior must not bypass disclosure/prohibited-advice. Mitigated by policy intersection. |
| 15 | Required now, or strategically interesting? | **Strategically interesting; not required now.** N=1, no engine, pivot (§22 item 7) not done. This is the decisive answer, and the basis for reduced scope. |

---

## Execution Gate

Per the brief's own gate: a consequential unresolved decision **does** exist (ADR-0054, plus the
provider-vs-ResponseOS runtime-ownership question). Both are named precisely above, with the
narrowest safe default recommended for each.

**Recommendation: do not proceed into implementation beyond increment 1 (ADR-0054) without
operator sign-off**, because the reduced scope materially narrows what the brief requested — and
scaling work down is the operator's call, not the agent's.
