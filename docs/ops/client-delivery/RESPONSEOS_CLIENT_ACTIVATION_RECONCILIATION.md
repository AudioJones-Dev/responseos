# ResponseOS Client-Activation Reconciliation

**Status:** Current-state reconciliation. Documentation only — no runtime code, schema, environment, provider configuration, or deployment behaviour is changed by this document.
**Owner:** AJ Digital LLC / Audio Jones
**Base:** `master` @ `271353e` (2026-09-10), read from worktree branch `claude/responseos-client-activation-0111aa`.
**Method:** Repository evidence only — code, schema, migrations, tests, and open pull requests. Per doctrine §2.3, prose documents were not treated as evidence of implementation.
**Scope note:** This audit reads the repository and the GitHub PR list. It does **not** read Telnyx, HubSpot, Neon, Clerk, or Vercel consoles. Anything whose truth lives in an external console is `UNVERIFIED`, not assumed.

## Why this document exists

A proposed master specification ("FRL Supervised Pilot & Reusable Client Activation System") asks for a
reusable client-activation substrate, with Florida Ramp & Lift as the first reference deployment. Its §42
requires a current-state reconciliation *before* implementation, and its §5 and §8 forbid creating parallel
architecture beside existing equivalents.

That instruction is load-bearing here. The dominant finding of this reconciliation is that **most of the
proposed substrate already exists** — some shipped, some in unmerged draft pull requests, some shipped but
scoped to a narrower domain than the specification assumes. Building the proposed module tree as written
would create duplicate architecture in at least eight places.

Status tokens below are the doctrine §2.1 vocabulary: `SHIPPED`, `PARTIALLY_SHIPPED`, `DOCUMENTED_ONLY`,
`ROADMAP`, `EXPERIMENTAL`, `NOT_PLANNED`. These describe *capability state*. They are deliberately not the
specification's `PASS`/`PARTIAL`/`BLOCKED`/`NOT RUN` vocabulary, which describes *what was executed in a
session* and is not used in this document.

---

## 1. Headline

**The reusable client-activation substrate is largely present but unconsolidated.** It is split across
(a) shipped code scoped to the internal professional-receptionist domain, (b) three unmerged draft pull
requests, and (c) a canonical client-delivery documentation set that already occupies the directory the
specification proposes to create.

The correct next unit of work is **consolidation and generalisation**, not new module creation.

Three findings carry this reconciliation:

1. **`docs/ops/client-delivery/` is already the client-activation documentation home.** It contains the
   R0–R3 readiness-gate standard and twelve onboarding templates. The specification's proposed
   `docs/client-activation/` would duplicate it.
2. **PR #132 (`codex/client-environment-blueprint`, draft) already implements the client configuration
   contract and the source-of-truth authority hierarchy** the specification requests in §4, §6, and §3.
   It is unmerged, 13 commits behind `master`, and carries a blocking ADR number collision.
3. **The specification's §19 "prohibited claims" mechanism is `SHIPPED`** as
   `lib/professional/authority.ts` + `lib/professional/policy.ts`, enforced in code — but typed to the
   career/recruiter domain rather than a service business.

---

## 2. Verified repository baseline

| Measure | Value at `271353e` | Evidence |
|---|---|---|
| Prisma models | 34 | `prisma/schema.prisma` |
| Migrations | 13 (`0001`–`0013`) | `prisma/migrations/` |
| Unit test files / tests | 48 / 531, all passing | `npm test`, this session |
| Integration + e2e test files | 11 | `tests/integration/`, `tests/e2e/` |
| Open pull requests | 9 (5 draft) | `gh pr list` |

Node/npm note: `package.json` `engines` pins Node `24.18.0` / npm `11.16.0`; the operator workstation used
for this reconciliation runs Node `26.8.1` / npm `11.19.0`. The unit suite passes on the newer runtime. This
is recorded as drift, not as a defect.

---

## 3. Governance constraints that bound the specification

These come from the repository contract and ratified ADRs, not from the specification. They constrain what
any FRL activation work may do, and the specification does not account for them.

| Constraint | Source | Effect on the specification |
|---|---|---|
| No live provider integrations until v0.3 is explicitly authorised | `AGENTS.md` hard rules; ADR-0019 | Specification PRs 5, 6, 7 and **all of §43** (locate the FRL Telnyx number, reconcile HubSpot records) cannot execute. |
| Client knowledge base + agent grounding layer is **v0.4**, gated on tenant isolation, audit log, and retention controls being in force | `docs/ROADMAP.md` version table; ADR-0029, ADR-0034 | Specification PR 2 (knowledge ingestion) is v0.4 work. Contracts may be drafted; ingestion may not be activated. |
| Mock adapters must never be described as integrations | `AGENTS.md`; doctrine §2.2 rule 4 | The specification's §44 report template must not record mock behaviour as provider state. |
| Webhook signature validation is mandatory before any business mutation | ADR-0009 | Constrains specification §22 — see §6 of this document for current per-provider state. |
| ResponseOS is not HIPAA-certified | ADR-0004 | Constrains any FRL accessibility/medical-adjacent copy. |
| Merge to `master` is human-only | Governance kernel; `AGENTS.md` branch policy | No PR opened from this work self-merges. |

**Consequence.** Of the specification's seven proposed pull requests, only **PR 1** is fully executable
under current authorisations. PR 2 is executable as contracts only. PRs 3 and 4 are partially executable
against mocks. PRs 5, 6, and 7 are gated.

---

## 4. Florida Ramp & Lift — existing repository footprint

FRL is **not** new to this repository, but no FRL tenant, configuration, or code exists.

| Item | State | Evidence |
|---|---|---|
| FRL named as anchor case study for the primary vertical (General Home Services) | Ratified | ADR-0035, `docs/DECISIONS.md:599` |
| FRL referenced in doctrine vertical section | `DOCUMENTED_ONLY` — "No vertical model is built" | `docs/strategy/responseos-platform-doctrine-v1.md:465` |
| FRL tenant / account record | Does not exist | Repo-wide grep: no match outside the four documentation references |
| FRL client profile, source pack, knowledge snapshot, number assignment | Do not exist | Repo-wide grep |
| Stair-lift phrasing in demo script | Present as demo copy only | `docs/readiness/CONTROLLED_DEMO_SPEC.md:135` |

So the specification's §7 and §32 (FRL client profile, FRL source pack) are genuine greenfield — but they
must be instantiated **through** the existing contract identified in §5 below, not as a new one.

---

## 5. Where the proposed architecture already exists

This is the section that determines what may be built. Each row is a specification concept mapped to its
existing equivalent.

| Spec § | Proposed concept | Existing equivalent | Status | Evidence |
|---|---|---|---|---|
| §5, §33 | `docs/client-activation/` | `docs/ops/client-delivery/` — R0–R3 gates, 12 templates, canon reconciliation register | `SHIPPED` | `docs/ops/client-delivery/README.md` |
| §4, §6 | Client Activation Package / `ClientProfile` | `lib/clientEnvironment/contracts.ts` — `client-environment.v1` manifest (identity, snapshot hash/version, discovery counts, agent policy hash). **Precedent, not the finished profile** — see note below | **Unmerged draft** | PR #132 |
| §3 | Source-of-truth hierarchy | `authorityRank()` + `selectApprovedFacts()` in `lib/prospectBootstrap/memory.ts` — `owner_confirmed` (2) > `operator_approved_for_demo` (1), with deterministic `reviewed_at` → `valid_as_of` → `id` tie-breaks; `DiscoveryFindingAuthoritySchema` = `consultant_observed` / `client_stated` / `client_confirmed` | **Unmerged draft** | PR #132 |
| §8 | `ClientKnowledgeSnapshot` | `BusinessMemorySnapshot` model | `PARTIALLY_SHIPPED` | `prisma/schema.prisma:853` |
| §9 | `BusinessKnowledgeSource` + manifest | `KnowledgeSource`, `KnowledgeSourceType`, `KnowledgeFact`, `KnowledgeIngestionRun` | `PARTIALLY_SHIPPED` | `prisma/schema.prisma:803`, `:828`, `:783` |
| §11 | Knowledge promotion workflow | `ProspectBootstrap` → `BootstrapPromotion`; `lib/prospectBootstrap/{lifecycle,promotion,policy,attestation}.ts` | `PARTIALLY_SHIPPED` | ADR-0048; migrations `0012`–`0013` |
| §6 | Agent configuration record | `AgentProfile` + `AgentProfile.system_policy_json` | `SHIPPED` | `prisma/schema.prisma:1210`; `lib/professional/policy.ts` |
| §19 | Prohibited-claims mechanism | `lib/professional/authority.ts` — `CLAIM_AUTHORITY` matrix (`answer`/`escalate`/`refuse`), `ALWAYS_ESCALATE`, `knowledgeFallback: "verified_only"` | `SHIPPED` | `lib/professional/authority.ts`, `policy.ts` |
| §15 | Interaction classification | `lib/professional/intent.ts`; `ProfessionalOpportunityType` | `PARTIALLY_SHIPPED` — career-domain taxonomy | `lib/professional/intent.ts` |
| §16 | Intake contract | `lib/professional/intake.ts`; `ProspectIntake` model | `PARTIALLY_SHIPPED` | `lib/professional/intake.ts` |
| §22 | Number assignment + tenant resolution | `TelephonyNumber`, `TelephonyNumberAssignment` | `PARTIALLY_SHIPPED` | `prisma/schema.prisma:874`, `:894` |
| §22 | Virtual extension / routing contracts | `lib/routing/virtualExtensions/` | **Unmerged draft**, `EXPERIMENTAL` | PR #123 |
| §14, §20 | CRM abstraction + HubSpot adapter | `lib/providers/crm/{types,index,mock,hubspot}.ts`; `lib/crm/syncFinalizedCall.ts` | `PARTIALLY_SHIPPED` — flag- and token-gated | ADR-0047, ADR-0050 |
| §20 | CRM writeback durability | `CrmSyncOperation` + `CrmSyncOperationStatus` | `PARTIALLY_SHIPPED` | `prisma/schema.prisma:723` |
| §17 | Qualification scoring | `lib/scoring/leadQualificationScore.ts`; `LeadQualification` | `SHIPPED` — deterministic, but global not per-tenant | `lib/scoring/` |
| §27 | Observability substrate | `WorkflowRun`, `QaLog`, `AuditLog`, `WebhookEvent` | `PARTIALLY_SHIPPED` | migrations `0006`, `0007` |
| §36 | Readiness states | `docs/readiness/PILOT_READINESS.md` (12 blockers); `CRITICAL_PATH.md` (A01–A20, B01–B17, C13) | `SHIPPED`, stale | `docs/readiness/` |
| §6 | Tenant classification | `AccountType` — customer / internal / internal_demo / sandbox | `SHIPPED` | ADR-0046; migration `0009` |
| — | Obsidian as operator-side authoring layer, **not** live RAG | **ADR-0016 — already ratified**, extended by ADR-0029 | Ratified | `docs/DECISIONS.md:223` |

**Note on PR #132's manifest — verified against the branch, not its description.** The
`client-environment.v1` manifest is a **discovery-preview artifact and structurally cannot express a
supervised pilot.** Verified in `lib/clientEnvironment/contracts.ts` on `origin/codex/client-environment-blueprint`:

- `lifecycleStage` is `z.enum(["discovery", "implementation_ready"])` — two states, none of them a pilot tier;
- `agent.executionMode` is `z.literal("DISCOVERY_PREVIEW")` and `agent.liveActivationAuthorized` is `z.literal(false)`;
- `integrations` is entirely literal — `telephony: "review_required"`, `crm`/`scheduling`/`payments`: `"disabled"`;
- `businessIdentity` carries only name, canonical website, industry, timezone — **no business hours, holidays,
  service area, escalation contacts, or consent posture.**

These literals are deliberate non-live gating, not oversight. The manifest is therefore the correct
**precedent** for a client profile — manifest + content hash + version + authority-ranked facts — but it is
not the profile itself. Widening it to a pilot requires changing five literal fields, which is an ADR-level
change to a deliberately fail-closed contract, not a field addition.

**Note on the Obsidian correction.** The architectural correction supplied with the specification is
**already ratified in full** by ADR-0016 (`docs/DECISIONS.md:223-238`), extended by ADR-0029 and ADR-0034.
ADR-0016 states Obsidian is the "internal, operator-side SOP and brand-knowledge layer… an authoring/
source-of-truth surface for humans" and explicitly **not** "a vector index, embeddings store, RAG runtime,
or client document-upload pipeline" and **not** "a store of tenant PII or transcripts." On auto-propagation
it is equally explicit: "If Obsidian content ever feeds live agent prompts, it does so through the reviewed
prompt/policy profile pipeline, **not as free-form runtime retrieval**."

One refinement: ADR-0016 ratifies the *policy* and names the mechanism only as "the reviewed prompt/policy
profile pipeline." The **versioned-artifact mechanism** (snapshot + checksum + effective dates) exists in
code today only for the prospect lane (`BusinessMemorySnapshot`), not for the operator-vault → agent-runtime
lane. So the correction needs no new decision; it needs (a) the v0.4 gate to open and (b) the existing
snapshot mechanism extended to that lane.

---

## 6. Open pull requests carrying load-bearing work

Specification §41 requires that unmerged load-bearing work is not duplicated. Three open PRs qualify.

| PR | Branch | Carries | Blocking defect |
|---|---|---|---|
| **#132** (draft) | `codex/client-environment-blueprint` | `lib/clientEnvironment/` contracts + service; `client-environment.v1` manifest; authority-aware snapshot compilation; discovery-findings provenance; operator-only routes; unit + integration tests | Three, compounding: (1) adds `docs/architecture/ADR-0049-client-environment-continuity.md`, but **`master` already assigns ADR-0049** to "Environment promotion is contract-driven…" (`docs/DECISIONS.md:861`) — number collision; (2) **convention divergence** — it files the ADR as a standalone file under `docs/architecture/`, whereas every ratified ADR on `master` is a section inside `DECISIONS.md`; (3) 13 commits behind `master`, and it modifies `lib/prospectBootstrap/memory.ts`, which is shipped code. |
| **#123** (draft) | `docs/virtual-extension-routing` | `lib/routing/virtualExtensions/` deterministic routing contracts, reason codes, tenant isolation tests | Declared Stage 1 `EXPERIMENTAL`; persistence, operator config, and provider adapters explicitly out of scope. |
| **#115** | `feat/internal-reference-tenant-foundation` | Account classification (customer/internal/internal_demo/sandbox), agent profiles, opportunities, reporting exclusion | Adds migration `0009_internal_reference_tenant_foundation`, but **`master` already has `0009_internal_demo_professional_receptionist`**. Migration collision — must renumber to `0014`. |

### Superseded branches

| Branch | Verdict | Evidence |
|---|---|---|
| `codex/prospect-bootstrap` | **Fully superseded.** Work landed on `master` via PR #125. | `tests/unit/prospect-bootstrap.test.ts`, `telnyx-assistant-initialization.test.ts`, `telnyx-prospect-call-routing.test.ts` all present on `master`; `lib/prospectBootstrap/` present |
| `codex/h0-telnyx-hubspot-contract` | **Partially superseded.** `lib/providers/crm/` landed on `master` in a different shape (`hubspot.ts`, 202 lines). Unlanded: a 367-line ingestion implementation brief plus `crm/policy.ts` and `crm/fixtures.ts`. | `docs/product/` has no `h0`/telnyx brief; `lib/providers/crm/` lacks `policy.ts`/`fixtures.ts` |

---

## 7. Documentation contradicted by current code

Recorded per specification §42 "Stale". Each is a claim a reader would act on incorrectly today.

| Document | Stale claim | Contradicted by |
|---|---|---|
| `docs/strategy/responseos-platform-doctrine-v1.md` §3.1 | "22 Prisma models across 8 migrations (`0001`–`0008`)"; "13 unit files" | 34 models, 13 migrations, 48 unit files |
| `docs/strategy/…doctrine-v1.md` §3.5 item 2 | `ProviderConnectionProvider` "contains neither `telnyx` nor `calendly`" | Both present — `prisma/schema.prisma:940`, added by migration `0010_v0_3_provider_enum_alignment` |
| `docs/architecture.md` | Describes `lib/automations/`, `lib/config/`, `lib/notifications/` as populated modules | All three are still empty. Doctrine §3.5 item 3 correctly records this; `architecture.md` is the stale document. Note `lib/notify/prospectIntake.ts` now carries notification logic under a **different path** than the one `architecture.md` names. |
| `docs/readiness/PILOT_READINESS.md` blocker 1 | "Telnyx has no adapter, enum, env var, or webhook route — `lib/providers/telnyx/` does not exist" | `lib/providers/telnyx/{normalize,webhook}.ts` exist; `telnyx` is in the enum; `app/api/webhooks/telnyx/` has two routes |
| `docs/readiness/PILOT_READINESS.md` blocker 6 | "No business memory. No model, no write path… no `Memory` model among 22" | `BusinessMemorySnapshot` model exists; `lib/prospectBootstrap/memory.ts` exists |
| `docs/readiness/CURRENT_STATE_AUDIT.md` §1 | "There is no extraction, intelligence, or memory code anywhere" | `lib/prospectBootstrap/factExtraction.ts`, `memory.ts` landed later via PR #125 |
| `docs/ROADMAP.md` | "Current focus (June 2026)" | Repository head is 2026-09-10 |

`PILOT_READINESS.md` is the document most directly analogous to the specification's §36–§37 and is the most
consequential of these: several of its twelve blockers have been closed since it was written, so it
currently understates readiness.

---

## 8. Genuine gaps

**There are none in the architectural sense.**

Ten subsystem readers surveyed the repository against the specification and raised 25 candidate gaps. Each
was then handed to an independent verifier instructed to refute it by finding an existing equivalent under
any plausible name. The result:

| Verdict | Count |
|---|---|
| `REAL_GAP` — nothing exists, genuine greenfield | **0** |
| `PARTIAL` — substrate exists, wiring or a field is missing | **25** |
| `ALREADY_EXISTS` — fully covered | 0 |

**Every one of the 25 items is missing wiring, a nullable column, or an enum member on an existing model —
not a missing subsystem.** This is the central result of the reconciliation and it determines the shape of
all downstream work: the specification's proposed module tree (`lib/client-config/`, `lib/business-context/`,
`lib/knowledge/`, `lib/intake/`, `lib/qualification/`, `lib/escalation/`) would create parallel architecture
in every case.

### 8.1 The 25 items, grouped by the smallest correct change

**Enum or column additions to existing models (7)**

| Item | Extend | Spec § |
|---|---|---|
| Non-web knowledge source kind (vault / folder / document) | Write the existing `KnowledgeSourceType.manual_reference`; relax `KnowledgeSource.url`/`normalized_url` from NOT NULL | §9 |
| Knowledge sensitivity classification | Generalise `CLAIM_AUTHORITY` + `AgentProfilePolicy` — **do not** define a second PUBLIC/RESTRICTED/PII enum beside it | §10 |
| Caller-resolution match state | `CallerMatchState` enum + `caller_match_state` column on `Call` | §13 |
| Non-sales interaction classes | Add service/admin members to the existing `LeadEventType` (which already hosts non-sales `spam`) | §15 |
| New- vs existing-customer axis | Column on `Contact`, or derive from `LeadEvent` history | §13 |
| Human-routing fallback destination | Nullable `fallback_routing_number` / `fallback_mode` on `Account` | §29 |
| Snapshot revocation | `revokeMemorySnapshot()` beside `createAndApproveMemorySnapshot` | §11 |

**Missing write accessors — read paths exist, writes do not (5)**

`LeadEvent` / `LeadQualification`, `Notification`, `AgentProfile`, `Account` status transition, and CRM
`review_required` resolution all have read accessors and validation schemas but no tenant-scoped writer.
`lib/data/professionalOpportunities.ts:161-221` is the proven `withTenantScope` write pattern to copy.
Notably `CreateAccountInputSchema`/`UpdateAccountInputSchema` exist at `lib/validation/account.ts:11-33`
with **zero consumers**.

**Missing runtime callers — logic exists, nothing invokes it (5)**

Escalation firing, CRM retry execution (`prepareCrmSyncRetry` exists; nothing schedules it), notification
dispatch, automated QA evaluation, and cross-run conflict detection. Each is a call site, not a component.

**Configuration made per-tenant (4)**

Qualification weights/bands, tenant operating configuration (hours, service area, escalation contacts,
consent posture), supervision tier, and spend/rate caps are all currently global constants or env flags.

**Consolidation defects (4)**

- **Two `normalizeE164` implementations** exist (`lib/prospectBootstrap/service.ts:61`,
  `lib/crm/syncFinalizedCall.ts:61`). Neither is applied at the inbound caller lookup
  (`lib/providers/telnyx/normalize.ts:120-130`). Hoist one; do not author a third.
- Error/alert sink has no destination — **ADR-0018 already specifies the stack**; implement it rather than
  designing a new one.
- Automated QA evaluation is **already scoped** as `CRITICAL_PATH.md:477` item **B20** (P2/PARTIAL/S).
- Admin client UI keys `statusTone` on `active/pending/inactive/churned`; three of four are not
  `AccountStatus` values, so `lead`/`paused`/`cancelled` all render neutral.

### 8.2 Ratified decisions the specification collides with

These are the findings most likely to derail implementation, because they are already-ratified ADRs that
contradict the specification's assumptions.

1. **ADR-0046 §2 forbids hanging runtime behaviour on `account_type`.** It states the classification "must
   never gate tenant isolation, auth, audit logging, provider resolution, workflow execution, or any other
   runtime behaviour. There is no `if (internal_demo)` branch in the data layer." The specification's §6
   lifecycle cannot be implemented on `account_type` without a superseding ADR.

2. **ADR-0046 §9 already declined a generic settings blob on `Account`.** So the specification's
   `ClientProfile` configuration must extend `BusinessMemorySnapshot` +
   `BusinessMemorySnapshotSchema` (`lib/prospectBootstrap/contracts.ts:73`) as the tenant operating-config
   document — not introduce `ClientConfig`/`TenantSettings`.

3. **Supervision today is a deploy-lane property, not a tenant attribute.** ADR-0047 defines isolated lanes
   and every live capability is gated by a **process-wide env flag**
   (`RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED`, `RESPONSEOS_LIVE_HUBSPOT_ENABLED`, `RESPONSEOS_REQUIRE_AUTH`).
   **Consequence: two tenants in the same deployment cannot currently sit at different supervision levels.**
   The specification's §6 tier axis (`supervised_pilot` / `production_supervised` / `managed_autonomy`)
   requires either a superseding ADR or extending `PROSPECT_DEMO_POLICY` (`lib/prospectBootstrap/policy.ts:21`)
   into a mode-indexed policy table with `executionMode` widened from `z.literal('PROSPECT_DEMO')` to an enum.

4. **`BootstrapPromotion` creates a new `Account` rather than transitioning one.** Promotion creates a
   `customer`/`lead` account from a signed manifest while the sandbox account is renamed "Expired prospect"
   and set `cancelled`. The specification assumes a single `ClientProfile` advancing
   sandbox → pilot → production. **That is a design divergence from shipped behaviour and needs an explicit
   operator decision**, not a silent reinterpretation.

5. **Role vocabulary is fixed.** The platform-admin role is `aj_admin`, not `platform_admin`/`superadmin`.
   Introducing a new name creates a parallel role vocabulary.

---

## 9. Recommended treatment

### 9.1 What may proceed now

| Specification PR | Verdict | Reason |
|---|---|---|
| **PR 1 — Client Activation Foundation** | Proceed, **as consolidation** | The contract already exists in PR #132; rehabilitate rather than rewrite |
| **PR 2 — Knowledge governance/ingestion** | Contracts only | Activation is v0.4-gated (ADR-0029, ADR-0034) |
| **PR 3 — CRM-aware caller context** | Partial, mock-only | Caller match state + E.164 consolidation are safe; live HubSpot reads are v0.3-gated |
| **PR 4 — Intake/qualification/escalation** | Partial, mock-only | Per-tenant config and escalation wiring are safe |
| **PR 5 — Telnyx activation readiness** | **Blocked** | v0.3 not authorised (`AGENTS.md`) |
| **PR 6 — HubSpot pilot projection** | **Blocked** | v0.3 not authorised |
| **PR 7 — Hosted pilot certification** | **Blocked** | Requires provider activation + deploy gates |

### 9.2 Ordering

1. **Harvest PR #132 rather than rebasing it in place.** Its two halves have different value:
   - The `memory.ts` authority ranking (`authorityRank`, `selectApprovedFacts`) is **genuinely load-bearing
     and directly reusable** — it implements specification §3 against shipped code. Take it.
   - The `client-environment.v1` manifest is a **discovery-preview precedent**, not the pilot profile (see
     §5 note). Extend `BusinessMemorySnapshotSchema` (`lib/prospectBootstrap/contracts.ts:73`) as the tenant
     operating-configuration document, using the manifest's hash/version/authority shape as the model.

   **Do not rebase and force-push `codex/client-environment-blueprint`.** `AGENTS.md` forbids force-pushing
   a shared branch without explicit approval. Cherry-pick onto a new branch, fix the ADR number and file
   location there, and open a PR that declares it supersedes #132 so a human can close #132.
2. **Renumber PR #115's migration** `0009` → `0014` so it can land without collision.
3. **Consolidate `normalizeE164`** into one shared module before any caller-resolution work.
4. **Take the four operator decisions** in §8.2 — they are not engineering choices.
5. Only then instantiate FRL through the contract.

### 9.3 Documentation treatment

Extend `docs/ops/client-delivery/`. **Do not create `docs/client-activation/`.** The specification's proposed
documents map onto existing homes:

| Proposed | Existing home |
|---|---|
| `CLIENT_ACTIVATION_LIFECYCLE.md` | `RESPONSEOS_FUTURE_CLIENT_READINESS_STANDARD.md` (R0–R3) |
| `PILOT_ACTIVATION_RUNBOOK.md`, `PILOT_CERTIFICATION.md` | `docs/readiness/PILOT_READINESS.md` + `CRITICAL_PATH.md` |
| `BUSINESS_KNOWLEDGE_GOVERNANCE.md` | ADR-0016 / ADR-0029 / ADR-0034 |
| `CRM_CONTEXT_POLICY.md` | ADR-0033 / ADR-0050 |
| `CLIENT_PROFILE_SPEC.md` | PR #132 `client-environment.v1` |

`PILOT_READINESS.md` should be re-verified in the same change as §7 shows several of its twelve blockers
have since closed.

---

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-09-10 | Initial reconciliation against `master` @ `271353e` | Claude Opus 5, for Audio |
