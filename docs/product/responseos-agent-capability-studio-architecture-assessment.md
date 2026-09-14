# Agent Capability Studio — Architecture Assessment

**Status:** §1–16 are assessment (`DOCUMENTED_ONLY`). The increment plan below is operator-directed (2026-09-13), and **Increment 1 is implemented in the same PR as this document**. Nothing beyond Increment 1 is authorized here.
**Date:** 2026-09-13
**Base commit:** `ec4eb1d`
**Author:** Claude Opus 5 (agent-authored; requires independent review per operator governance policy)
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

**(a) Much of the governance stack the brief specifies is already built.** `ExecutionPolicy`
(`lib/agentExecution/policy.ts`) implements explicit `allowedTools` allowlists, fail-closed
default-deny resolution, gate-bound authorization, `templateVersion` pinning, required
disclosure, and prohibited-advice lists. `PROSPECT_RECEPTIONIST_TEMPLATE` is already
a SHA-256-checksummed capability artifact with preflight validation — though see §2
on the limits of its immutability.
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
| Checksummed template | **PARTIALLY_SHIPPED** | `lib/prospectBootstrap/template.ts`: `PROSPECT_RECEPTIONIST_TEMPLATE` + `PROSPECT_RECEPTIONIST_TEMPLATE_CHECKSUM` (SHA-256); `validateProspectAssistantPreflight` | A capability *version* already exists — Git-authored, not DB-authored. **The pattern to generalize**, but not yet the *proven immutable* pattern: see the row below. |
| Template immutability is shallow | **VERIFIED DEFECT (pre-existing)** | `Object.freeze` on the template freezes only the outer object; `dynamicVariables` and `allowedTools` remain mutable arrays, and the checksum is computed once at module load. `instructions` is `.join("\n")`ed into a string at construction and is therefore immutable | An importer mutating either array makes the executable template diverge from the checksum `validateProspectAssistantPreflight` accepts. Raised by Codex on PR #174. **Not introduced by this PR and not fixed here** — a separate change; noted so the containment argument is not read as stronger than the code. |
| Hash-pinned publication manifest | **VERIFIED SHIPPED** | `BootstrapPromotion` (`schema.prisma:916`): `manifest_json`, `manifest_hash`, `source_snapshot_hash`, draft→exported→imported; `validatePromotionManifest` + `assertNoForbiddenPromotionKeys` | The brief's "publication resolution to deterministic manifest" has a working precedent. |
| Git-as-source-of-truth for policy | **VERIFIED SHIPPED** | `lib/agentExecution/policy.ts` docstring: `service.ts` "compares a stored `AgentProfile.system_policy_json` against that frozen object, so its shape and values must not drift" | The repo has **already decided** definition lives in Git, DB holds the assignment. |
| Audit substrate | **VERIFIED SHIPPED** | `AuditLog` (`schema.prisma:645`) with `before_ref`/`after_ref`/`category`/`target_type`; real writers in `lib/auth/clerk-sync.ts`, `lib/data/prospectIntakes.ts`, `lib/professional/intake.ts`, `lib/prospectBootstrap/service.ts` | Publication and permission-broadening audit can reuse this directly. `AuditCategory.workflow` already exists. |
| Approval workflow | **VERIFIED SHIPPED** | `app/api/admin/prospect-bootstraps/[id]/approve\|activate\|complete/route.ts`; `BootstrapPromotionStatus` | An operator approval lifecycle exists and is a usable model. It is **request/response**, not a *suspended execution* gate. |
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
| Latest ADR | VERIFIED | `ADR-0053` is highest in `docs/DECISIONS.md` | A new decision would be **ADR-0057**. |

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
5. ~~**Evidence classification** (`KNOWN`/`INFERRED`/`ASSUMED`/`UNKNOWN`) as structured state.~~
   **Not a gap — rejected brief requirement.** This originally read "no enum or field exists",
   which was wrong: `KnowledgeFactStatusSchema` (`lib/prospectBootstrap/contracts.ts`) already
   defines a richer six-state provenance vocabulary, and `knowledgeFallback: "verified_only"`
   is the receptionist's evidence rule. The four-state enum is explicitly rejected in §B in
   favour of that vocabulary plus required-known fields. Listing it here as a genuine gap
   would have pointed later increments at the duplicate ontology the accepted plan forbids.
   Raised by Codex on PR #174.
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

1. **ADR-0057** — where the capability definition of record lives. *Decision only, no code.*
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
docs/DECISIONS.md                              ADR-0057
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

**Yes — ADR-0057 is required, and it is the first increment.**

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
| 1 | Which layer (§8)? | Authoring/governance layer above execution, below product surface. Layer placement itself needs ADR-0057. |
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

Per the brief's own gate: a consequential unresolved decision **does** exist (ADR-0057, plus the
provider-vs-ResponseOS runtime-ownership question). Both are named precisely above, with the
narrowest safe default recommended for each.

**Recommendation: do not proceed into implementation beyond increment 1 (ADR-0057) without
operator sign-off**, because the reduced scope materially narrows what the brief requested — and
scaling work down is the operator's call, not the agent's.

---

# Increment Plan (operator-directed, 2026-09-13)

Added after the operator accepted the *direction* ADR-0057 proposes and revised the implementation
strategy. This section supersedes §13's sequence. Sections 1–16 above remain the
current-state assessment that justified it.

**Accepting a direction is not ratifying the decision.** ADR-0057 remains `Proposed`
pending explicit operator ratification, which is the operator's act and not an agent's.
Work proceeding under its direction does not advance its status.

## A. Evidence supporting the ADR-0057 decision

| Claim | Evidence at `ec4eb1d` |
|---|---|
| Git is already the definition-of-record | `lib/agentExecution/policy.ts` docstring: `service.ts` compares stored `AgentProfile.system_policy_json` **byte-identically** against the frozen Git constant, "so its shape and values must not drift" |
| Published versions are already checksummed | `PROSPECT_RECEPTIONIST_TEMPLATE_CHECKSUM` = SHA-256 over the template, computed once at module load; `validateProspectAssistantPreflight` throws `assistant_template_checksum_mismatch`. The template's outer object is frozen but its arrays are not — see §2 |
| Version labels already exist alongside checksums | `PROSPECT_AGENT_TEMPLATE_VERSION = "home-services-receptionist.v1"`; `BootstrapPromotionManifestSchema` pins it with `z.literal` |
| Publication-by-manifest is already proven | `BootstrapPromotion.manifest_hash`, `validatePromotionManifest`, `assertNoForbiddenPromotionKeys` |
| Tenant config already narrows, never widens | `AgentProfilePolicy`: "can only narrow what the claim-authority matrix already permits — `escalate` categories can be made `refuse`, never `answer`"; `parseAgentProfilePolicy` falls back to the strict default so "a malformed policy must never widen" |
| Default-deny is already structural | `resolveExecutionPolicy` returns `PROSPECT_DEMO_POLICY` on unrecognised mode or unauthorized gate |
| A canonicalizing hash helper already exists | `contentHash` (`lib/prospectBootstrap/memory.ts`) = SHA-256 over `stableJson` |
| No generic engine exists | No step walker, condition evaluator, or suspend/resume primitive in `lib/` |
| Hardcoded orchestration does exist | `runCrmSyncForCall`; `answerProfessionalQuestion` → `applyPolicy` |

## B. Contradictions and alternatives considered

**Database-of-record with a draft UI.** Rejected *for now*, not forever (ADR-0057 q11/q12).
It inverts a pattern the repo already relies on, makes immutability a thing to defend rather
than a property, and needs a new in-app publication authority that partially duplicates the
human merge gate the governance kernel reserves.

**A four-state evidence enum (`KNOWN`/`INFERRED`/`ASSUMED`/`UNKNOWN`) from the brief.**
**Rejected — the repository already has a richer, real vocabulary.** `KnowledgeFactStatusSchema`
is `source_observed | cross_source_confirmed | operator_approved_for_demo | owner_confirmed |
conflicted | rejected`, and `knowledgeFallback: "verified_only"` is the receptionist's rule.
Adding a parallel four-state enum would be the research ontology overriding repository evidence,
which decision 8 forbids. The shared abstraction is **required-known fields**, expressed over
existing vocabulary.

**A new trigger enum.** Rejected. `AutomationTriggerType` (`missed_call`, `after_hours_call`,
`new_lead`, …) and `LeadEventType` already exist. Inventing a third is the collision ADR-0057
decision 9 names.

**A third hash helper.** Rejected. `contentHash` canonicalizes key order; capability checksums
reuse it. Accepted coupling: `lib/capabilities` imports one pure function from
`lib/prospectBootstrap/memory`. Revisit only if a third consumer appears.

**Naming resolution (ADR-0057 decision 9), settled here.** **"Capability"** is the term for a
governed unit of ResponseOS behaviour. **`Automation`** keeps its current meaning — n8n trigger
configuration (ADR-0017) — and is not renamed. The **`playbooks`** admin stub is retargeted in
Increment 7, not now. "Template" stays scoped to the provider-assistant artifact it already names.

## C. Consequences

Capability authoring remains an engineering activity; an operator who cannot open a PR cannot
author a capability. Immutability stays free. The human merge stays the single publication
authority. Existing primitives are extended, never displaced. The `operator`-as-author question
stays explicitly open (ADR-0057 decision 10).

## D. Migration path toward database-backed authoring

Additive and reversible. (1) Evidence accumulates against ADR-0057 q11. (2) A superseding ADR
answers q12. (3) Draft rows land in Postgres as *mutable* records with no runtime authority.
(4) Publication resolves a draft into a frozen artifact, checksums it with `contentHash`, and
writes the checksum into a release assignment. (5) Runtime continues to resolve by checksum and
cannot tell whether the artifact originated in Git or a draft. Git-defined capabilities keep
resolving throughout; the two models coexist.

## E. Proposed second capability — Inbound Lead Qualification

**Chosen over Missed Call Recovery on gate evidence.** Missed Call Recovery's core action is
outbound contact, and `outboundEnabled` is `false` at every mode except `MANAGED_AUTONOMY`, whose
gate is `post-pilot-operator-authorization`. It cannot be exercised. Inbound is permitted at every
mode (`inboundOnly: true` permits inbound), and the qualification tail is already modelled:
`leadQualificationScore`, `LeadQualification`, `QualificationStatus`, and a writer in
`lib/providers/telnyx/normalize.ts`. Booking is the gated part and is **excluded** — the capability
terminates at a qualification outcome.

**The duplication it exposes — the key proof point.** The same business decision is computed two
ways depending on entry path:

| Path | How the score is produced |
|---|---|
| `app/api/leads/[id]/qualify/route.ts` | `leadQualificationScore(parsed.data)` — deterministic, weighted, inspectable |
| `lib/providers/telnyx/normalize.ts` | `boundedScore(insight.qualification?.score, status)` — trusts the provider's number, falls back to literals `80`/`20`/`50` |

This is precisely the "LLM decides everything" pattern the brief warns against, present in the
repository today, and it is evidence-grounded rather than inferred. Capability #2's substance in
Increment 2 is routing the provider path through the deterministic rule: provider extracts
structured values, ResponseOS computes the score.

**This is documented, not fixed, in Increment 1.** Changing `normalize.ts` scoring behaviour is a
business-logic change on a provider ingest path and belongs in its own reviewable increment.

**The second piece of Increment 2 evidence, surfaced by writing the descriptors.** The two
descriptors partition `producesRecords` — the receptionist produces `Contact`, `Call`,
`CallTranscript`, `LeadEvent`; qualification produces `LeadEvent`, `LeadQualification`. But
`lib/providers/telnyx/normalize.ts` is a *single* function that writes all five in one pass.
**The capability boundary the descriptors describe does not exist in the code.** That is the
concrete duplication Increment 2 must confront: either `normalize.ts` separates into a
receptionist-ingest concern and a qualification concern, or the descriptors are describing a
boundary that should not be drawn there. Deciding which is Increment 2's first question, and the
answer is evidence for what Increment 3 should extract.

## F. Increment 1 — smallest implementation plan

**Goal: prove the contract is *describable*, not *executable*.** Two descriptors plus a governance
validator demonstrate that one contract fits two real capabilities. Neither executes through
shared primitives; that is Increment 3, after Increment 2 implements capability #2's behaviour.
Nothing in Increment 1 changes runtime behaviour.

**Field-by-field justification** (a field is carried only if *both* capabilities need it):

| Field | Cap #1 receptionist | Cap #2 qualification | Carried? |
|---|---|---|---|
| `slug` / `name` | `prospect-receptionist` | `inbound-lead-qualification` | yes |
| `versionLabel` | `home-services-receptionist.v1` | `inbound-lead-qualification.v1` | yes |
| `checksum` | derived | derived | yes (derived, not stored) |
| `objective` | answer from verified facts, capture callback | produce a scored qualification | yes |
| `trigger` | inbound call | inbound call / lead form | yes — see note below |
| `requiredContext` | approved `BusinessMemorySnapshot` | contact, lead event, service area | yes |
| `requiredKnownFields` | verified facts only | `service_area_match` **and `urgency`** — the scorer's two mandatory inputs | yes |
| `executionMode` | `PROSPECT_DEMO` | `PROSPECT_DEMO` (min) | yes |
| `allowedTools` | `["hangup"]` | `[]` | yes — `[]` is meaningful under intersection |
| `producesRecords` | `Call`, `CallTranscript`, `Contact`, `LeadEvent` | `LeadEvent`, `LeadQualification` | yes — both grounded in `normalize.ts` writers |
| `readinessGates` | mode activation gate + operating config | same | **derived, not stored** — see below |
| generic `steps[]` | — | — | **NO** — no engine; would be ontology, not evidence |
| `evidenceEnum` 4-state | — | — | **NO** — existing vocabulary covers it |
| `componentVersions[]` | — | — | **NO** — containment already pins them (ADR-0057 q7) |

**Correction on the trigger field.** An earlier draft of this plan said `trigger` "reuses existing
vocabulary." On inspection it cannot: `AutomationTriggerType` is n8n automation configuration
(ADR-0017) with no inbound-call member, and `LeadEventSource` describes where a lead came from,
not what starts a capability. Widening either to fit would *be* the collision ADR-0057 decision 9
exists to prevent. `CapabilityTrigger` is therefore a deliberate two-value union —
`inbound_call | lead_form` — carrying exactly the values two capabilities prove, with a third
added only when a third capability needs it.

**Why each new abstraction exists** (ADR-0057 decision 8):

- `CapabilityDescriptor` — the one new abstraction. Justified because two real capabilities share
  every field above; without it there is no way to state "capability N" at all.
- `capabilityChecksum` — a thin wrapper over existing `contentHash`, so a descriptor is identified
  the same way a template already is. Not a new hashing scheme.
- `validateCapabilityGovernance` — one pure function. Justified because ADR-0057 decision 5's
  intersection rule is otherwise unenforceable and untested.

No other abstraction is introduced.

## G. Files expected to change — Increment 1

```
lib/capabilities/contract.ts                          new  — CapabilityDescriptor + checksum
lib/capabilities/validate.ts                          new  — governance validator (pure)
lib/capabilities/descriptors/receptionist.ts          new  — cap #1, wraps existing constants
lib/capabilities/descriptors/inboundLeadQualification.ts  new — cap #2
lib/capabilities/index.ts                             new  — registry (frozen array)
tests/unit/capabilities/contract.test.ts              new
tests/unit/capabilities/validate.test.ts              new
docs/CHANGELOG.md                                     edit — PR line
dashboard/dashboard-data.json                         edit — task state
```

**Constraint:** cap #1's descriptor **imports and wraps** `PROSPECT_RECEPTIONIST_TEMPLATE` and
`PROSPECT_DEMO_POLICY`. It never redefines or restructures them — their shapes are byte-compared
in `lib/prospectBootstrap/service.ts` and the template checksum is surfaced in the admin UI.

## H. Is new schema required?

**No.** Increment 1 adds zero tables, zero columns, zero migrations, zero enum changes. The
descriptor is a frozen TypeScript module; `typecheck` is its structural validator (`AGENTS.md`
validates at boundaries only, and internal code is not a boundary). A release-assignment table is
Increment 5 and only if existing runtime mechanisms cannot represent pinning. Zod is deliberately
not used here — it earns its place when a real boundary (a DB draft, a CLI input) appears.

## I. Increment sequence (revised, operator-directed)

Status language here is load-bearing (doctrine §2, §20). "Drafted" is not "ratified",
and "held" is not "next" — a table that blurs either would misreport what has actually
been authorized.

| # | Increment | Status |
|---|---|---|
| 0 | ADR-0057 | **Proposed / pending ratification** — drafted, not ratified; the operator ratifies |
| 1 | Capability contract + two descriptors + governance validator | **this PR** — open, not merged |
| 2 | Implement capability #2 behaviour; document what stayed bespoke | **Held / requires authorization** — starts only from clean master after #174 merges |
| 3 | Minimal executor extraction — only from duplication two capabilities prove | Held; gated on 2 |
| 4 | Simulation + trace | Held; gated on 3 |
| 5 | Runtime assignment / pinning | Held; gated on 4 |
| 6 | Semantic review tooling (CLI/report first) | Held; gated on 5 |
| 7 | Authoring-interface decision, on measured friction | Held; gated on 6 |

An earlier version of this table marked increment 0 `done` and increment 2 `next`,
which contradicted ADR-0057's own `Proposed` status and the operator's hold on
Increment 2. Raised by Codex on PR #174.

## J. Builder-UI gate

Not built until **at least two** of ADR-0057 q11's conditions are demonstrated. Until then, Git
plus typed contracts plus validation plus simulation is treated as the authoring system, not as a
placeholder for one.
