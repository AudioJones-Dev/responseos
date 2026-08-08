# Critical Path & Task Register

**Base:** `master` @ `ed77c26` · Organized by **dependency**, not calendar.

> **Format note.** The mandated 15-field task schema is rendered in full for the **20 Gate-A tasks**
> (the critical path — where precision matters most). Gate B and C tasks use a compact register with
> the same fields collapsed into columns, to keep the document usable. No task is omitted.

---

## 1. Task counts

```
Current → Operational (Gate A):        20
Operational → Serviceable (Gate B):    20
Serviceable → GTM Ready (Gate C):      16
Total remaining discrete tasks:        56
```

By priority:

```
P0 blockers:                    18
P1 required:                    27
P2 valuable but non-blocking:   11
```

**Counting rule applied:** a task is a discrete implementation or verification outcome with a
testable definition of done. Phases, headings, and aspirations are excluded. Where an existing but
unwired model can be used (`WebhookEvent`, `QaLog`, `WorkflowRun`, `ProviderConnection`), the task is
scoped as *wiring*, not *design* — reflected in the effort values.

---

## 2. The critical path

The shortest dependency chain from current state to a demonstrable call → action loop:

```
A01 Telnyx carrier adapter
 ↓
A03 Telnyx inbound webhook + signature validation
 ↓
A04 Vapi agent adapter ──────────→ A05 Vapi assistant config
 ↓                                        ↓
A06 Vapi call-ended webhook (real handler) ←┘
 ↓
A07 Call / segment / transcript persistence
 ↓
A08 Extraction pipeline ──→ A09 CallIntelligence model
 ↓
A10 Entity normalization → Contact
 ↓
A11 Lead creation      ──→ A13 Event ledger
 ↓
A14 Business-memory model + write path
 ↓
A15 Decision engine (rule-based)
 ↓
A16 Task/Action model + generation
 ↓
A17 Sandbox action execution
 ↓
A18 Provenance chain
 ↓
C05 Call-lifecycle UI   ←── the demo becomes real here
 ↓
DEMO READY
```

**Parallelizable immediately (no dependency on the chain):**
`A19` idempotency/retry · `A20` observability · `A02` number provisioning · `B03` secrets/KMS ·
`C01` demo tenant + fixtures · `C08` demo reset · `C13` pricing/positioning · `C14` demo script

**The single longest pole is `A08` (extraction).** Everything from `A10` onward consumes its output,
and its quality determines whether the demo is impressive or embarrassing. Start it early behind a
fixed-transcript fixture so it can be developed before `A01`–`A07` deliver live data.

---

## 3. Gate A — Operational (20 tasks)

```yaml
- id: A01
  title: Telnyx CarrierProvider interface + mock and live adapter
  readiness_gate: A
  priority: P0
  status: MISSING
  reason: Telnyx is the ratified primary carrier but appears only in demo fixture strings; no adapter, enum, env, or route exists.
  repository_evidence: "lib/providers/telnyx/ absent; grep telnyx -> app/(demo)/_data/scenario.ts, demo integrations page, docs/product/demo-assets/hubspot-sync-event.json only"
  dependencies: []
  parallelizable_with: [A04, A19, A20, C01]
  implementation_scope: CarrierProvider interface, mock adapter, live adapter behind env factory with mock fallback
  affected_components: lib/providers/telnyx, lib/providers/resolve
  acceptance_criteria: App boots with zero Telnyx env vars and resolves the mock; with env present resolves live; interface covers inbound call metadata.
  tests_required: adapter resolution unit tests, mock-fallback boot test
  demo_impact: Without it there is no phone number to call.
  gtm_impact: Blocks the "answers the call" claim entirely.
  risk: Medium — first live vendor surface; must not break mock-first boot.
  effort: M

- id: A02
  title: Telnyx number provisioning + routing configuration
  readiness_gate: A
  priority: P1
  status: MISSING
  reason: No configuration path binds a purchased number to a tenant or agent.
  repository_evidence: no telnyx config in .env.example or schema
  dependencies: [A01]
  parallelizable_with: [A08, C01]
  implementation_scope: per-tenant number record + routing to the Vapi assistant
  affected_components: prisma/schema.prisma, lib/data/providerConnections.ts
  acceptance_criteria: A number maps to exactly one tenant and one assistant; cross-tenant lookup impossible.
  tests_required: tenant-isolation test on number lookup
  demo_impact: Required for a dedicated demo number.
  gtm_impact: Required for pilot onboarding.
  risk: Low
  effort: S

- id: A03
  title: Telnyx inbound-call webhook route with signature validation
  readiness_gate: A
  priority: P0
  status: MISSING
  reason: No Telnyx route exists; ADR-0009 makes signature validation mandatory before any mutation.
  repository_evidence: app/api/webhooks/ has no telnyx directory
  dependencies: [A01]
  parallelizable_with: [A04, A08]
  implementation_scope: route + verifier following the working lib/auth/clerk-webhook.ts pattern
  affected_components: app/api/webhooks/telnyx
  acceptance_criteria: Bad signature -> 401 and zero writes; valid signature -> persisted call record.
  tests_required: signature accept/reject, replay rejection
  demo_impact: Entry point for every demo call.
  gtm_impact: Security precondition for any pilot.
  risk: High — this is a business-mutation boundary.
  effort: M

- id: A04
  title: Vapi VoiceAgentProvider adapter (mock + live)
  readiness_gate: A
  priority: P0
  status: MISSING
  reason: lib/providers/vapi/ is an empty directory.
  repository_evidence: "lib/providers/vapi/ contains only .gitkeep"
  dependencies: []
  parallelizable_with: [A01, A08]
  implementation_scope: VoiceAgentProvider interface split from the conflated VoiceProvider, mock + live adapters
  affected_components: lib/providers/vapi, lib/providers/voice, lib/providers/resolve
  acceptance_criteria: Mock fallback preserved with no secrets; live adapter reaches Vapi when configured.
  tests_required: resolution + mock-parity tests
  demo_impact: No agent handles the call without it.
  gtm_impact: Blocks "understands the conversation".
  risk: Medium
  effort: M

- id: A05
  title: Vapi assistant configuration (prompt/playbook) per tenant
  readiness_gate: A
  priority: P0
  status: MISSING
  reason: No prompt, playbook, or assistant config is stored or versioned anywhere.
  repository_evidence: no prompt/playbook files in repo
  dependencies: [A04]
  parallelizable_with: [A07]
  implementation_scope: versioned assistant config per tenant + a demo playbook for the home-services scenario
  affected_components: prisma/schema.prisma, lib/data/providerConnections.ts
  acceptance_criteria: Config is per-tenant, versioned, and reproducible from the repo.
  tests_required: config resolution + isolation test
  demo_impact: Determines whether the call sounds credible.
  gtm_impact: Per-client tuning is a core service deliverable.
  risk: Medium — conversation quality is the demo's first impression.
  effort: M

- id: A06
  title: Replace Vapi call-ended ack stub with a real handler + signature validation
  readiness_gate: A
  priority: P0
  status: SCAFFOLDED
  reason: The route acknowledges and discards; it has a literal "TODO verify signature".
  repository_evidence: "app/api/webhooks/vapi/call-ended/route.ts — 7 lines, ackWebhook(...) only"
  dependencies: [A04]
  parallelizable_with: [A03]
  implementation_scope: verify signature, parse payload, dispatch to persistence
  affected_components: app/api/webhooks/vapi/call-ended
  acceptance_criteria: Valid payload persists a Call + transcript; invalid signature 401s with zero writes.
  tests_required: signature tests, payload-shape tests, idempotent redelivery
  demo_impact: This is where the demo's data actually enters the system.
  gtm_impact: Security precondition.
  risk: High — business-mutation boundary.
  effort: M

- id: A07
  title: Call / CallSegment / CallTranscript persistence from webhook payload
  readiness_gate: A
  priority: P0
  status: PARTIAL
  reason: Models and accessors exist; nothing writes them from a real call.
  repository_evidence: "lib/data/{calls,callSegments,callTranscripts}.ts exist; no caller outside tests"
  dependencies: [A06]
  parallelizable_with: [A05]
  implementation_scope: map provider payload -> existing models via tenant-scoped accessors
  affected_components: lib/data/calls.ts, callSegments.ts, callTranscripts.ts
  acceptance_criteria: A completed call produces one Call, N segments, one transcript, correct accountId.
  tests_required: mapping tests, tenant-isolation test
  demo_impact: Stage 1 of the lifecycle view.
  gtm_impact: Foundation for every downstream claim.
  risk: Low — the storage layer is already proven.
  effort: S

- id: A08
  title: Transcript extraction pipeline (LLM) producing the structured field set
  readiness_gate: A
  priority: P0
  status: MISSING
  reason: No extraction code exists anywhere in the repository.
  repository_evidence: "grep 'extract|entit|memory|summariz' over lib/**/*.ts + app/api/**/*.ts returns only lib/auth/{clerk-sync,session}.ts"
  dependencies: [A07]
  parallelizable_with: [A01, A03, A04]
  implementation_scope: prompt + schema-validated extraction over a transcript, deterministic under fixture
  affected_components: lib/intelligence (new)
  acceptance_criteria: A fixed fixture transcript yields the documented field set with a stable snapshot.
  tests_required: snapshot test on fixture, schema-validation failure handling
  demo_impact: The single most visible step in the demo.
  gtm_impact: Underwrites "extracts business information".
  risk: High — output quality is the demo's credibility.
  effort: L

- id: A09
  title: CallIntelligence model persisting extraction output with confidence
  readiness_gate: A
  priority: P0
  status: MISSING
  reason: No model holds extracted intelligence.
  repository_evidence: 22 models present; none for extraction/entities
  dependencies: [A08]
  parallelizable_with: [A13]
  implementation_scope: additive migration + accessor; FK to Call and CallTranscript
  affected_components: prisma/schema.prisma, lib/data
  acceptance_criteria: Extraction persists with provenance to its transcript; tenant-scoped.
  tests_required: migration test, isolation test
  demo_impact: Backs the intelligence panel.
  gtm_impact: Required for provenance.
  risk: Low — additive.
  effort: S

- id: A10
  title: Entity normalization -> Contact create/update with dedupe
  readiness_gate: A
  priority: P0
  status: MISSING
  reason: Contact model exists; nothing creates one from a call.
  repository_evidence: lib/data/contacts.ts has no caller from any ingestion path
  dependencies: [A09]
  parallelizable_with: [A13]
  implementation_scope: normalize phone/email/name; match-or-create within tenant
  affected_components: lib/data/contacts.ts, lib/intelligence
  acceptance_criteria: Repeat caller updates the existing Contact rather than duplicating.
  tests_required: dedupe tests, isolation test
  demo_impact: "It remembered me" — the returning-caller moment.
  gtm_impact: Core memory claim.
  risk: Medium — dedupe correctness.
  effort: M

- id: A11
  title: Lead + LeadQualification creation from extraction
  readiness_gate: A
  priority: P0
  status: MISSING
  reason: Models and enums exist; no path populates them from a call.
  repository_evidence: "LeadQualification, LeadUrgency, QualificationStatus enums exist; lib/data/leadQualifications.ts unwired"
  dependencies: [A10]
  parallelizable_with: [A13]
  implementation_scope: map extraction fields onto existing enums; persist qualification
  affected_components: lib/data/leads.ts, leadQualifications.ts
  acceptance_criteria: A high-intent call yields a qualified lead with urgency and status set.
  tests_required: mapping + isolation tests
  demo_impact: The headline object the prospect sees created.
  gtm_impact: Directly demonstrates revenue recovery.
  risk: Low
  effort: S

- id: A12
  title: Conversation state machine across call/SMS touchpoints
  readiness_gate: A
  priority: P1
  status: PARTIAL
  reason: Conversation model + ConversationStatus enum exist and are unwired.
  repository_evidence: "lib/data/conversations.ts exists; no state transitions implemented"
  dependencies: [A11]
  parallelizable_with: [A14]
  implementation_scope: transitions driven by ingestion events
  affected_components: lib/data/conversations.ts
  acceptance_criteria: Status reflects real progression; illegal transitions rejected.
  tests_required: state-transition tests
  demo_impact: Moderate — supports the timeline.
  gtm_impact: Needed for multi-touch narrative.
  risk: Low
  effort: M

- id: A13
  title: Generic event ledger — model + write path
  readiness_gate: A
  priority: P0
  status: MISSING
  reason: LeadEvent is lead-scoped; architecture.md describes an event-ledger-first design that does not exist generically.
  repository_evidence: no generic Event model among the 22
  dependencies: [A07]
  parallelizable_with: [A09, A10, A11]
  implementation_scope: append-only Event model with actor, subject, payload, provenance
  affected_components: prisma/schema.prisma, lib/data
  acceptance_criteria: Every ingestion and action writes an event; ledger is append-only and tenant-scoped.
  tests_required: append-only enforcement, isolation test
  demo_impact: Powers the timeline view.
  gtm_impact: Underwrites auditability claims.
  risk: Medium — schema shape is load-bearing for v0.3+.
  effort: L

- id: A14
  title: Business-memory model + write path
  readiness_gate: A
  priority: P0
  status: MISSING
  reason: The central product claim has no model and no code.
  repository_evidence: no Memory model; no memory code repo-wide
  dependencies: [A11, A13]
  parallelizable_with: [A12]
  implementation_scope: durable per-tenant facts with source provenance and supersession
  affected_components: prisma/schema.prisma, lib/memory (new)
  acceptance_criteria: A call writes durable facts; each cites its source; later calls supersede rather than duplicate.
  tests_required: provenance integrity, supersession, isolation
  demo_impact: The differentiator — step 7 of the runbook.
  gtm_impact: Underwrites the entire "Business Memory" narrative.
  risk: High — this is the product's core abstraction; wrong shape is expensive later.
  effort: L

- id: A15
  title: Rule-based decision engine selecting the next action
  readiness_gate: A
  priority: P0
  status: MISSING
  reason: No decision code or model exists.
  repository_evidence: no decision/policy code found
  dependencies: [A14]
  parallelizable_with: []
  implementation_scope: deterministic rules over extraction + memory, emitting a decision with the rule cited
  affected_components: lib/decisions (new)
  acceptance_criteria: Same inputs always yield the same decision; the selecting rule is recorded and displayable.
  tests_required: rule-coverage tests, determinism test
  demo_impact: Runbook step 8 — explainability without chain-of-thought.
  gtm_impact: Underwrites "determines what needs to happen next".
  risk: Medium — keep it rules-based; an LLM here costs explainability.
  effort: M

- id: A16
  title: Task/Action model + generation from decisions
  readiness_gate: A
  priority: P0
  status: MISSING
  reason: No task/action model exists.
  repository_evidence: 22 models, none for tasks or actions
  dependencies: [A15]
  parallelizable_with: []
  implementation_scope: Task model with FK to decision; generation on decision emit
  affected_components: prisma/schema.prisma, lib/data
  acceptance_criteria: Each decision yields >=1 task with provenance to its decision.
  tests_required: generation + provenance tests
  demo_impact: Runbook step 9.
  gtm_impact: Underwrites "executes the appropriate workflow".
  risk: Low
  effort: S

- id: A17
  title: Sandbox action execution adapters (lead, task, notify, draft SMS)
  readiness_gate: A
  priority: P0
  status: MISSING
  reason: lib/automations/ is an empty .gitkeep; no execution layer exists.
  repository_evidence: "lib/automations/.gitkeep is the directory's only file"
  dependencies: [A16]
  parallelizable_with: []
  implementation_scope: execution adapters that default to sandbox and record WorkflowRun
  affected_components: lib/automations, lib/data/workflowRuns.ts
  acceptance_criteria: Actions execute against sandbox targets only; no external side effect without explicit live authorization; each run recorded.
  tests_required: sandbox-routing test, no-external-call assertion
  demo_impact: Runbook step 9-10.
  gtm_impact: The claim that separates this from transcription tools.
  risk: High — this is where accidental real-world side effects would first become possible.
  effort: L

- id: A18
  title: Provenance chain linking action -> decision -> memory -> extraction -> transcript -> call
  readiness_gate: A
  priority: P0
  status: MISSING
  reason: No linking layer exists.
  repository_evidence: no provenance code; models lack the FK chain end to end
  dependencies: [A17]
  parallelizable_with: []
  implementation_scope: FK integrity + a resolver that walks the chain in both directions
  affected_components: prisma/schema.prisma, lib/memory, lib/decisions
  acceptance_criteria: Every action resolves to its originating call in one query; orphans are impossible.
  tests_required: integrity test asserting no orphaned action
  demo_impact: Runbook step 11 — the moment that closes deals.
  gtm_impact: Underwrites "maintains provenance"; strongest competitive differentiator.
  risk: Medium
  effort: M

- id: A19
  title: Webhook idempotency, retry, and failure logging
  readiness_gate: A
  priority: P1
  status: PARTIAL
  reason: WebhookEvent model and WebhookProcessStatus enum exist but nothing populates them.
  repository_evidence: "lib/data/webhookEvents.ts exists; no ingestion path writes it"
  dependencies: [A06]
  parallelizable_with: [A08, A20]
  implementation_scope: wire the existing model as an idempotency store with retry + dead-letter
  affected_components: lib/data/webhookEvents.ts, app/api/webhooks/*
  acceptance_criteria: Duplicate delivery processes once; failures are logged and replayable.
  tests_required: duplicate-delivery test, failure-path test
  demo_impact: Prevents duplicate leads mid-demo.
  gtm_impact: Baseline reliability for a pilot.
  risk: Medium
  effort: M

- id: A20
  title: Observability baseline — error tracking + failure surface
  readiness_gate: A
  priority: P1
  status: MISSING
  reason: No Sentry/PostHog/OTel dependency in package.json.
  repository_evidence: "package.json contains no observability dependency"
  dependencies: []
  parallelizable_with: [A01, A08, A19]
  implementation_scope: error tracking + a control-plane view of ingestion failures
  affected_components: app, lib
  acceptance_criteria: A failed webhook is visible without reading server logs.
  tests_required: error-capture smoke test
  demo_impact: A silent demo failure in front of a prospect is worse than no demo.
  gtm_impact: Required to support a pilot.
  risk: Low
  effort: S
```

---

## 4. Gate B — Serviceable (20 tasks)

| ID | Title | Pri | Status | Effort | Note |
|---|---|---|---|---|---|
| B01 | Tenant configuration: business hours, service area, escalation policy | P1 | MISSING | M | No config surface exists |
| B02 | RBAC enforcement audit + implementation | P1 | UNVERIFIED | M | `UserRole` enum exists; enforcement not audited |
| B03 | Secrets management: KMS/Vault ADR + rotation | P1 | PARTIAL | M | AES-256-GCM exists; single env key, no rotation |
| B04 | Client onboarding workflow (10 required inputs) | P1 | DOCUMENTED ONLY | L | Docs only |
| B05 | Phone-number provisioning flow (operator-facing) | P1 | MISSING | M | Depends A02 |
| B06 | Per-tenant provider config storage wiring | P1 | PARTIAL | S | `ProviderConnection` exists, unwired |
| B07 | Webhook replay tooling | P1 | PARTIAL | S | Builds on A19 |
| B08 | Queue handling + backpressure | P2 | MISSING | M | Redis deferred per ADR-0036 |
| B09 | Monitoring + alerting | P1 | MISSING | M | Depends A20 |
| B10 | Audit-trail coverage for all new write paths | P1 | PARTIAL | S | `AuditLog` exists |
| B11 | Transcript retention policy enforcement | P1 | PARTIAL | S | `TranscriptRetentionLane` enum unwired |
| B12 | Call recording + disclosure/consent configuration | P0 | MISSING | M | **Legal exposure — blocks pilot** |
| B13 | Usage metering | P2 | MISSING | M | Needed before usage pricing |
| B14 | Cost controls + provider kill switch | P1 | MISSING | S | Runaway spend protection |
| B15 | Runbooks + named owners | P1 | PARTIAL | S | `RESPONSEOS_RUNBOOK.md` exists, owners unnamed |
| B16 | Tenant data export | P1 | MISSING | M | Pilot contract expectation |
| B17 | Client offboarding + data deletion | P1 | MISSING | M | Pairs with B16 |
| B18 | Backup/recovery verification drill | P1 | UNVERIFIED | S | Neon-managed; unverified |
| B19 | Rollback drill (mock fallback + deploy revert) | P1 | MISSING | S | Named in #109 §4.3 |
| B20 | QA review loop wiring | P2 | PARTIAL | S | `QaLog` model unwired |

---

## 5. Gate C — GTM Ready (16 tasks)

| ID | Title | Pri | Status | Effort | Note |
|---|---|---|---|---|---|
| C01 | Demo tenant + seeded fixtures | P0 | MISSING | S | Parallelizable now |
| C02 | Dedicated demo phone number | P0 | MISSING | S | Depends A02 |
| C03 | Demo Vapi agent + scripted playbook | P0 | MISSING | M | Depends A05 |
| C04 | Sandbox adapters: mock CRM, calendar, quoting | P0 | MISSING | M | Isolation for demo actions |
| C05 | **Call-lifecycle control-plane UI** | P0 | MISSING | L | Replaces the static walkthrough; **this is the demo** |
| C06 | Intelligence + memory-change visualization | P0 | MISSING | M | Runbook steps 6–7 |
| C07 | Provenance visualization (clickable chain) | P0 | MISSING | M | Runbook step 11 — the differentiator |
| C08 | Demo reset mechanism | P0 | MISSING | S | Repeatability; parallelizable now |
| C09 | Scenarios A/B/C implemented + rehearsed | P1 | MISSING | M | Depends C05 |
| C10 | Failure-safe demo mode (fallback if live path breaks) | P1 | MISSING | M | Keep the static walkthrough as the fallback |
| C11 | ROI / outcome dashboard | P1 | PARTIAL | M | `RevenueMetrics` exists, unpopulated |
| C12 | Sample reports + proof artifacts | P2 | MISSING | S | Leave-behinds |
| C13 | Pricing/package mapping + positioning resolution | P0 | BLOCKED | S | **Founder decision D1 — three taxonomies, none canonical** |
| C14 | Sales demo script + runbook | P1 | MISSING | S | Draft in `CONTROLLED_DEMO_SPEC.md` §6 |
| C15 | Pilot onboarding checklist | P1 | PARTIAL | S | #109 §5 ladder covers part |
| C16 | Pilot success metrics definition | P1 | MISSING | S | Needed to prove pilot value |

---

## 6. Gap classification

| Class | Tasks |
|---|---|
| **Product gap** (software must function) | A01–A18, C04 |
| **Operational gap** (AJ Digital can run it) | A19, A20, B01–B20 |
| **Demo gap** (can demonstrate convincingly) | C01–C10, C12, C14 |
| **GTM gap** (can sell/onboard/measure) | C11, C13, C15, C16 |
| **Nice-to-have** (must not delay launch) | B08, B13, B20, C12 |

---

## 7. DEFER UNTIL AFTER PILOT

Challenging the existing roadmap. Each of these is currently planned or implied and should **not**
block the first pilot:

| Defer | Rationale |
|---|---|
| **Node voice gateway + Redis** (ADR-0036) | Already deferred and correctly so. Telnyx→Vapi handles transport; a gateway solves scale problems one pilot cannot produce. |
| **Live Twilio failover** (#109 Stage F) | Failover from a carrier that is not yet live is premature. Ship Telnyx; add failover when uptime data justifies it. |
| **HubSpot + Calendly live integrations** (Stages G/H) | The demo is more convincing with sandbox adapters — no external side effects. Real CRM sync is an onboarding task for pilot #1, not a demo task. |
| **Stripe money rail / outcome-fee ledger** (v0.5, C8) | Manual invoicing bridges the first 1–3 pilots. Building billing before proving the model is the classic premature-abstraction trap. |
| **RLS database backstop** (PL1) | Application-layer isolation is real and tested (21 tests). RLS is defense-in-depth; add after the first live client. |
| **Knowledge layer / RAG** (v0.4) | Correctly out of scope. Nothing in the demo needs it. |
| **Generalized multi-vendor CAL abstraction** | Build the interface for Telnyx + Vapi specifically. A five-provider abstraction with one implementation each is speculative generality — the CAL work in PR #108 is the right *size*, but resist widening it. |
| **The 9 empty provider directories** (`bland`, `ghl`, `n8n`, `resend`, `retell`) | Delete or leave dormant. Each implies a commitment the roadmap has not made. |
| **True browser e2e suite** | Contract-level smoke tests cover the demo path. Full Playwright infrastructure is post-pilot. |
| **Enterprise SSO / advanced RBAC** | One pilot with a handful of operators does not need it. |

**Principle:** the objective is minimum reliable serviceability, not architectural completeness. The
repository's current risk is not under-engineering — it is a substrate built well ahead of the
product that sits on it.
