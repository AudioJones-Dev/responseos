# ResponseOS Platform Doctrine v1.0

**Owner:** AJ Digital LLC / Audio Jones
**Status:** **Proposed — awaiting operator ratification.** Documentation only. No runtime code, dependency, schema, environment variable, provider configuration, or deployment behavior is changed by this document.
**Scope:** Architecture, product boundaries, provider strategy, intelligence flywheel, moat development, claims policy.
**Current-state basis:** Verified against the working tree on branch `claude/responseos-platform-doctrine-5a2675` (base `1510139`). Every current-state claim in §3 was checked against code, schema, or tests — not against strategy documents.

---

## 1. Purpose and authority

### 1.1 What this document governs

This doctrine is the **strategic source of truth** for ResponseOS. It answers the questions that no single ADR, roadmap row, or spec answers on its own:

- What ResponseOS is today, and what it is not.
- What it is intended to become, and in what order.
- Which capabilities are built internally and which are bought.
- Which claims are currently supported by evidence, and which are prohibited until they are.
- How the AI receptionist wedge connects to Business Memory, and how Business Memory becomes Operational, Benchmark, and Founder Intelligence.
- How future roadmap, ADR, implementation, and GTM proposals are evaluated.

### 1.2 Precedence order

The repository carries three coexisting layers of canon. This doctrine does not replace them; it sits above them for *strategy* and below them for *decisions*.

| Rank | Layer | Authority |
|---|---|---|
| 1 | **[`DECISIONS.md`](../DECISIONS.md) (ADRs)** | Binding for any ratified decision. Where this doctrine implies a change to a ratified ADR, the change is not in force until a superseding ADR is filed. |
| 2 | **This doctrine** | Binding for strategy, product boundaries, claims policy, build-vs-buy, evidence standards, and sequencing rationale. Governs how new proposals are evaluated. |
| 3 | **`RESPONSEOS_*` canonical set** (`product/`, `architecture/`, `ops/`, `brand/`, `research/`) | Go-forward specification detail per ADR-0011. Loses to ADRs. |
| 4 | **Original prose docs** (`architecture.md`, `api-spec.md`, `product-spec.md`, …) | Authoritative only where the layers above do not restate the topic. Several carry knowingly stale stack framing — see §3.5. |

**Operating rule.** A ratified ADR beats this doctrine on *what was decided*. This doctrine beats every prose document on *what may be claimed*.

### 1.3 How this doctrine changes

- A strategy change → amend this document and record the amendment in §25.
- A decision change (provider, schema, architecture, sequencing gate) → file an ADR in [`DECISIONS.md`](../DECISIONS.md) **and** update this document to match.
- A claim change → §20 governs. A claim graduates only on the evidence listed there.

This document is **proposed, not ratified**. Until the operator ratifies it, it is a recommendation. Doctrine and principles are an operator-held decision; this draft exists to be edited and signed, not to bind by publication.

---

## 2. Evidence and epistemic rules

### 2.1 Status vocabulary

Every capability claim in this repository should carry one of these states. Ambiguity between them is the single most common failure mode in this codebase's documentation.

| State | Definition |
|---|---|
| `SHIPPED` | Implemented, tested, and available in the current repository. |
| `PARTIALLY_SHIPPED` | Some schema, interface, route, UI, or supporting implementation exists, but the complete operational workflow does not. |
| `DOCUMENTED_ONLY` | Described in strategy, ADRs, architecture, or roadmap documents but not implemented. |
| `ROADMAP` | Explicitly planned for a future version. |
| `EXPERIMENTAL` | Implemented or proposed for validation but not approved as durable architecture. |
| `NOT_PLANNED` | Outside the current roadmap. |
| `PROHIBITED_CLAIM` | Must not be represented publicly as available, proven, or operational. |

### 2.2 Non-negotiable honesty rules

1. **Documentation must not imply that planned features are shipped.** Present tense is reserved for shipped behavior.
2. **Architecture must not imply that integrations are live.** An interface plus a mock adapter is architecture preparation, not an integration.
3. **Estimated revenue is never represented as verified revenue.**
4. **Mock provider support is never represented as live provider support.**
5. **Planned compliance architecture is never represented as certification.** ResponseOS is not HIPAA-certified (ADR-0004).
6. **Future blockchain compatibility is never represented as Web3 implementation.**
7. **Roadmap status is not implementation status.** A ratified ADR is a decision, not a shipped feature.

### 2.3 The verification duty

Any agent or contributor asserting current state must confirm it **against the repository** — code, schema, migrations, tests — not against strategy documents. Strategy documents in this repo have repeatedly outlived the code they describe (§3.5).

---

## 3. Current-state truth

> **ResponseOS is presently an architecture, operator-console, data-model, and product-positioning build progressing toward a live pilot. It is not yet a production-proven revenue-recovery platform.**

### 3.1 What is `SHIPPED`

Verified in the working tree:

| Capability | Evidence |
|---|---|
| Next.js App Router application with four route groups — marketing, operator console (`(admin)`), client portal (`(client)`), clickable demo (`(demo)`) | `app/` |
| Account-scoped relational data model — 22 Prisma models across 8 migrations (`0001`–`0008`) | `prisma/schema.prisma`, `prisma/migrations/` |
| Tenant-scoped data-access layer; every read/write derives `accountId` from the session, never from client input | `lib/data/*`, `lib/data/session-helpers.ts`, `lib/auth/session.ts` |
| Clerk authentication — identity schema, session derivation, webhook sync, route protection | `lib/auth/*`, `proxy.ts`, migration `0008` |
| Clerk webhook signature verification before body parse and before mutation (the ADR-0009 reference implementation) | `app/api/webhooks/clerk/route.ts`, `lib/auth/clerk-webhook.ts` |
| Audit-log model with actor, category, reason, before/after refs, retention field | `prisma/schema.prisma` (`AuditLog`, `AuditCategory`) |
| Webhook ingest ledger model with raw body, signature header, `signature_valid`, dedupe hash, process status | `prisma/schema.prisma` (`WebhookEvent`), `lib/data/webhookEvents.ts` |
| Workflow-run and QA-log models | `WorkflowRun`, `QaLog` |
| Call-intelligence substrate — conversations, SMS messages, call segments, call transcripts with retention lane | migrations `0004`–`0005` |
| Provider-credential encryption module — AES-256-GCM, versioned envelope, mock fallback when no key | `lib/providers/encryption/index.ts`, ADR-0020 |
| Mock voice-provider abstraction — typed interface plus deterministic mock adapter | `lib/providers/voice/{types,mock,index}.ts` |
| Deterministic lead-qualification score (0–100, weighted heuristic) | `lib/scoring/leadQualificationScore.ts` |
| Estimated recovered-revenue and ROI-multiple estimation functions | `lib/revenue/*` |
| Deterministic seed keyed to mock fixtures | `prisma/seed.ts` |
| Test suite — 13 unit files, 5 integration files, including cross-tenant isolation matrices, seed determinism, mock parity | `tests/` |
| CI gates — `validate` (lint, typecheck, unit, build, dependency audit) and `integration` (Postgres 16, migrate diff/deploy, seed, integration tests, DB-backed build) | `.github/workflows/` |
| Opt-in Doppler secrets injection; app still boots with zero credentials | `doppler.yaml`, ADR-0038 |
| Architecture, product, ops, brand, and research documentation set, plus 38 ADRs | `docs/` |

### 3.2 What is `PARTIALLY_SHIPPED`

These are the entries most likely to be misread as complete. Each has real substrate and no complete workflow.

| Capability | What exists | What does not |
|---|---|---|
| **Webhook signature validation (ADR-0009)** | The rule, the schema field (`signature_valid`), and one verified implementation (Clerk) | Telnyx, Twilio, Vapi, Retell, Stripe, GHL, and n8n routes are acknowledgement stubs carrying `TODO: verify … signature` and mutate nothing. Consistent with ADR-0009's staging (mandatory *before production traffic*), but the platform does **not** today validate provider signatures. |
| **Event ledger (ADR-0002)** | `WebhookEvent` ingest ledger with dedupe hash and idempotency test coverage; substrate models for calls, conversations, transcripts, workflow runs | No generic canonical `Event` model. Only the Clerk path writes to the ledger. No provider event has ever transited it. |
| **Estimated-vs-verified revenue separation** | `RevenueMetrics` carries **both** `estimated_recovered_revenue` and `verified_recovered_revenue` columns, plus `roi_multiple` | No verification workflow, no evidence linkage, no correction or dispute path, no reconciliation. The distinction exists as two integers, not as a process. |
| **Diagnostic-first commercial motion** | `AssessmentReport` model with readiness score, leak estimate, `FitDiagnosis` (`ai_fit` / `borderline` / `no_fit`), workflow maps, projected ROI, proposed terms; `Engagement` model with tiers, outcome-fee kinds, usage model; public `/audit` route and validated capture endpoint | The capture endpoint acknowledges only — no CRM write, no scoring pipeline, no delivery workflow. The diagnostic is executed manually. |
| **Provider abstraction** | One typed interface plus mock adapter (`voice/`), an encryption module, and webhook helpers | Every other provider directory (`twilio/`, `telnyx`-absent, `vapi/`, `retell/`, `hubspot/`, `ghl/`, `stripe/`, `resend/`, `n8n/`, `bland/`) is a `.gitkeep` placeholder. The voice interface has no consumer anywhere in the app. |
| **Compliance lanes (ADR-0004)** | Lane definitions, transcript retention-lane enum, credential encryption, PII-hiding read projections | No lane-specific infrastructure, no BAA chain, no HIPAA lane. |
| **Business Memory** | The capture substrate (conversations, transcripts, segments, QA logs) that Phase-1 memory is defined to write into (ADR-0034) | No memory assembly, retrieval, timeline reconstruction, or narrative layer. |

### 3.3 What is `DOCUMENTED_ONLY`

The entire ratified v0.3 communications stack. Telnyx, Vapi, Retell, HubSpot sync, Calendly scheduling, the Communications Abstraction Layer, the Node voice gateway, Redis session state, R2 evidence storage, Resend, Stripe billing, and the outcome-fee ledger are all decided and unbuilt. See §12 for the per-provider status table.

### 3.4 Current limitations — stated plainly

ResponseOS has:

- no proven production deployment from this repository (`vercel.json` currently **disables** automatic `master` deploys);
- no validated live customer workflow;
- no verified recovered-revenue history;
- no live end-to-end communications pipeline proven in production;
- no complete missed-call recovery automation;
- no complete Business Memory layer;
- no production Benchmark Intelligence;
- no cross-client outcome dataset;
- no outcome-fee reconciliation system;
- no blockchain or distributed-ledger integration.

**None of these is a defect.** Each is the correct consequence of ADR-0001 (mock-first) and ADR-0019 (v0.3 gate). The failure mode to guard against is not the absence of these capabilities — it is *describing them as present*.

### 3.5 Known documentation drift

Recorded so it is not rediscovered as a surprise. These are not authorized to be rewritten wholesale here; each is flagged, and the ADRs win.

1. **`architecture.md`** still describes Supabase hosting (superseded by ADR-0026), a Twilio + Retell/Vapi/Bland primary voice lane with Grok as experimental (superseded by ADR-0031/0032), Clerk and R2 as "planned" (Clerk shipped), and "no migrations yet" (eight exist). A supersession banner has been added; the body is left intact for provenance.
2. **`prisma/schema.prisma` `ProviderConnectionProvider`** enumerates `twilio, grok, openai, retell, vapi, bland, hubspot, google_calendar, calcom, stripe` — it contains **neither `telnyx` nor `calendly`**, the two providers ADR-0031 and ADR-0037 ratified. The schema encodes a superseded provider stack. ADR-0036 §4 explicitly requires a separate approved PR to change it; this is expected, not a violation. It is recorded here because it is the clearest available example of *decision status ≠ implementation status*.
3. **`lib/automations/`, `lib/config/`, `lib/notifications/`** are empty directories that `architecture.md` describes as populated modules.

---

## 4. Canonical strategic doctrine

> **Enter through revenue recovery. Deploy the AI receptionist as the communications wedge. Build Business Memory from operational evidence. Convert verified outcomes into Operational and Benchmark Intelligence. Emerge as the Founder Intelligence System.**

Short internal form:

> **ResponseOS is the wedge. Founder Intelligence is the destination.**

The progression:

```text
Diagnostic
    ↓
Revenue Recovery
    ↓
AI Receptionist
    ↓
Business Memory
    ↓
Operational Intelligence
    ↓
Verified Outcomes
    ↓
Benchmark Intelligence
    ↓
Founder Intelligence System
    ↓
Trust Infrastructure
```

### 4.1 This resolves the two-narrative problem

The repository has carried two positioning narratives in parallel:

- **"AI Revenue Recovery Platform"** — `PRD.md`, `product-spec.md`, `client-facing-offer.md`, the `EngagementTier` enum (`recovery_core` / `recovery_pro` / `recovery_performance`), and the shipped marketing surface.
- **"Managed Business Memory System"** — the GTM roadmap, ratified as positioning by ADR-0022 and as the public pricing *model* by ADR-0028.

They are not competing brands. They are **adjacent stages of one progression**, and the doctrine fixes their relationship:

| Question | Answer | Authority |
|---|---|---|
| What does the buyer come for? | Revenue recovery. Primary CTA is **"Revenue Recovery Demo"**. | ADR-0035 |
| What is the mechanism? | Business Memory — captured operational evidence. | ADR-0022 |
| What proves it worked? | Recovered revenue, separated into estimated and verified. | ADR-0022, §14 |
| What is the public pricing model? | Capacity-based Business Memory tiers, with optional outcome fees layered on. Price points remain open. | ADR-0028 |
| What does it become? | Founder Intelligence. | This doctrine, §8 |

**Business memory is the mechanism; recovered revenue is the proof; founder intelligence is the destination.** Any asset that leads with memory *instead of* recovery, or that treats them as alternatives, is off-doctrine.

---

## 5. Product definition

### 5.1 What ResponseOS is

ResponseOS is a **managed revenue-recovery and operational-intelligence system for founder-led service businesses.**

Its near-term job is to:

- capture legitimate inbound demand;
- prevent missed leads from dying silently;
- recover conversations after missed calls;
- qualify opportunities;
- preserve customer and operational context;
- route or schedule appropriate follow-up;
- measure estimated and verified outcomes **separately**;
- provide an accountable operational view to the business owner.

Its long-term role is to become the communications and evidence-capture layer of a Founder Intelligence System.

### 5.2 What ResponseOS is not

ResponseOS is **not**:

- a general-purpose CRM;
- a field-service management platform;
- a native telecom carrier;
- a native voice-foundation-model provider;
- a generic automation builder;
- a replacement for ServiceTitan, Housecall Pro, Jobber, HubSpot, or GoHighLevel;
- a crypto product;
- a blockchain platform;
- an agent marketplace;
- a tokenized business network;
- an enterprise BI replacement today;
- a production-proven revenue-attribution system, until live reconciliation is demonstrated.

This list is load-bearing. A feature request that moves ResponseOS toward any of these requires a superseding ADR, not a sprint ticket. See §19.

---

## 6. Buyer-facing job to be done

The doctrine anchors the initial product on one buyer problem:

> **A legitimate inbound customer should never disappear because a small service business missed the call, failed to respond, lost the context, or neglected the follow-up.**

### 6.1 Lead with these

- fewer missed opportunities
- faster response
- clearer qualification
- consistent follow-up
- preserved customer context
- measurable recovery
- predictable operating costs
- transparent attribution

### 6.2 Do not lead with these

Not banned — **not the opening line** in SMB-facing material:

`operating system` · `agent orchestration` · `MCP` · `RAG` · `vector database` · `event sourcing` · `multi-agent architecture` · `blockchain` · `distributed ledger` · `model routing` · `cognitive infrastructure`

These belong in technical documentation, where they are accurate and useful. In buyer-facing copy they describe the seller's architecture rather than the buyer's problem.

---

## 7. Diagnostic-first doctrine

**Immutable commercial principle: diagnose before implementation.**

The diagnostic determines: inbound call volume · missed-call volume · after-hours demand · lead quality · response latency · current call-routing setup · current CRM or FSM · current booking process · follow-up process · average job value · close-rate assumptions · data readiness · integration readiness · compliance requirements · whether ResponseOS is likely to produce measurable value.

### 7.1 The diagnostic must be allowed to say no

It is explicitly permitted — and expected — for the diagnostic to conclude that:

- ResponseOS is not needed;
- the business is not ready;
- a simpler intervention is sufficient;
- an existing system should be configured instead;
- the prospect should first fix basic operating processes;
- the prospect should use a different vendor.

This is a **product-quality and trust mechanism**, not a lead-generation tactic. A diagnostic that cannot return no is a sales call with a worksheet.

The schema already encodes this: `FitDiagnosis` has a `no_fit` value, and `AssessmentStatus` has `declined`. The commercial doctrine in [`pricing-and-onboarding.md`](../pricing-and-onboarding.md) already states that a no-fit assessment still delivers a workflow map, a leak estimate, and a diagnosis. Keep both.

**Status:** `PARTIALLY_SHIPPED` — schema and commercial doctrine exist; the diagnostic is executed manually and the `/audit` endpoint acknowledges only.

---

## 8. Layered platform architecture

Nine layers. Each carries its current status so the architecture cannot be mistaken for a description of the running system.

### Layer 1 — Communications Capture · `PARTIALLY_SHIPPED`

**Purpose.** Capture inbound and outbound communication events.

**Includes.** Calls, missed calls, voicemail, SMS, email, forms, chat, appointment requests, CRM events.

**Output.** Canonical communication events.

**Status.** Models exist (`Call`, `Conversation`, `SmsMessage`, `CallSegment`, `CallTranscript`, `LeadEvent`). No live provider writes into them. The one public capture surface (`/audit`) acknowledges without persisting to a lead pipeline.

### Layer 2 — Business Memory · `PARTIALLY_SHIPPED` (capture substrate only)

**Purpose.** Preserve tenant-specific operational context.

**Includes.** Customer history, conversation history, call transcripts, lead history, appointment history, quote history, job or service context, follow-up history, SOPs, decisions, escalation rules, business-specific qualification logic.

**Output.** A durable, tenant-isolated business-memory graph or timeline.

**Status.** ADR-0034 defines Phase-1 as *operational capture into the event ledger* — transcript, summary, identity, intent, qualification, appointment request, follow-up requirement, source channel, CRM-sync status, next action. The substrate models are shipped; the capture pipeline is not. Per-tenant knowledge ingestion, retrieval, vector search, and RAG remain **v0.4-gated** behind the full control set (ADR-0016, ADR-0029, ADR-0034, [`ROADMAP.md`](../ROADMAP.md) *Future Knowledge Layer*). This doctrine relaxes none of those gates.

### Layer 3 — Operational Models · `DOCUMENTED_ONLY`

**Purpose.** Transform stored events into business-specific models.

**Examples.** Lead qualification · response latency · missed call · booking · follow-up · estimate-to-job · job-to-payment · escalation · service area · business hours · customer value.

**Output.** Structured interpretations of how the business operates.

**Status.** One model exists in code: `leadQualificationScore` — a fixed-weight heuristic, not learned from tenant data. Everything else is undefined.

### Layer 4 — Revenue Intelligence · `PARTIALLY_SHIPPED`

**Purpose.** Identify potential and actual revenue movement.

**Must distinguish.** Existing revenue · estimated recovered · influenced · booked · completed · collected · disputed attribution · unattributed.

**Output.** Revenue signals with explicit evidence and confidence.

**Status.** Two of nine distinctions exist as columns (`estimated_recovered_revenue`, `verified_recovered_revenue`). §14 defines the full state set; ADR-0041 ratifies it.

### Layer 5 — Operational Intelligence · `DOCUMENTED_ONLY`

**Purpose.** Identify operational patterns and intervention opportunities.

**Examples.** Response bottlenecks · missed-call patterns · repeat-caller behavior · lead-quality trends · scheduling failures · follow-up gaps · staff escalation patterns · conversion drop-offs · service-area mismatches · provider failure patterns.

**Output.** Operational findings and recommended actions.

### Layer 6 — Verified Outcomes · `DOCUMENTED_ONLY`

**Purpose.** Reconcile interventions with real business outcomes.

Minimum outcome chain:

```text
Inbound event
    ↓
ResponseOS intervention
    ↓
Qualified opportunity
    ↓
Appointment or quote
    ↓
Booked work
    ↓
Completed work
    ↓
Collected payment
```

Every state change must preserve: **source · timestamp · evidence · actor · tenant · confidence · attribution status · correction history.**

This is the layer that turns ResponseOS from a tool into an asset. Nothing above Layer 6 is defensible without it.

### Layer 7 — Benchmark Intelligence · `DOCUMENTED_ONLY` (and gated)

**Purpose.** Develop comparative intelligence from verified, permissioned, privacy-preserving outcome data.

**Examples.** Response-time benchmarks · booking-rate ranges · missed-call recovery rates · follow-up completion rates · lead-qualification distributions · seasonal demand patterns · estimate-to-close benchmarks · collected-revenue lag · intervention effectiveness by vertical.

**Benchmark Intelligence must never expose client-specific data.** It requires, without exception:

tenant isolation · privacy review · aggregation thresholds · consent or lawful processing basis · de-identification · suppression of small cohorts · documented metric definitions · data-quality gates · confidence ranges.

**Output.** Vertical and cohort-level operating benchmarks.

### Layer 8 — Founder Intelligence · `DOCUMENTED_ONLY`

**Purpose.** Provide decision support to the owner or operator.

**Examples.** Which revenue leaks matter most · which intervention to prioritize · whether additional staffing is justified · whether call coverage should expand · which lead sources produce completed revenue · which services convert poorly · where the business is operationally fragile · which process change has the highest likely impact.

**Output.** **Evidence-linked recommendations — not autonomous executive authority.** See §16.

### Layer 9 — Trust Infrastructure · `PARTIALLY_SHIPPED` (audit substrate only)

**Purpose.** Preserve verifiability and accountability.

**Includes.** Event history · audit logs · agent action logs · provider event logs · workflow execution logs · evidence references · record hashing · digital signatures · corrections and supersession · model/version provenance · human approval records · access history.

**Output.** A verifiable history of system activity and business-relevant decisions.

**Status.** `AuditLog` (with `break_glass` category), `WebhookEvent` (with dedupe hash and `signature_valid`), and `WorkflowRun` are shipped. Hashing, signing, chaining, and provenance are not. See §15 and ADR-0043.

---

## 9. The ResponseOS Intelligence Flywheel

```text
Communications
    ↓
Business Memory
    ↓
Operational Models
    ↓
Interventions
    ↓
Verified Outcomes
    ↓
Benchmark Intelligence
    ↓
Founder Recommendations
    ↓
Improved Operations
    ↓
New Communications and Outcomes
```

### 9.1 When the flywheel becomes defensible

Only when it contains **all** of:

- real operating data;
- verified outcome data;
- durable metric definitions;
- interventions tied to evidence;
- cross-client aggregation performed lawfully;
- vertical-specific models;
- repeatable findings that measurably improve decisions.

**Documentation, schemas, prompts, and dashboards do not by themselves create a moat.** The flywheel currently has zero turns. Every element above is either absent or unexercised. Stating otherwise is a `PROHIBITED_CLAIM` (§20).

---

## 10. Moat doctrine

> **ResponseOS has no proven moat until live customer outcomes accumulate.**

Five candidate moat sources. All are **candidates**, none is established.

### 10.1 Installed workflow switching costs

Client-specific qualification logic · escalation paths · integrated provider configuration · business-hour rules · staff assignments · service-area rules · call-handling policy · CRM mapping · outcome reconciliation · operational history.

*Status: no installed client. Switching cost is currently zero.*

### 10.2 Verified intervention-to-outcome dataset

Missed call → intervention → response → booking → completion → collection, with time-to-outcome and attribution confidence.

*Status: zero rows. This is the single highest-leverage moat and the one the near-term build priorities (§22) target.*

### 10.3 Vertical operational models

HVAC call patterns · plumbing emergency qualification · roofing estimate workflows · accessibility-installation intake · home-modification job lifecycle · agency lead qualification.

*Status: primary vertical is General Home Services with Florida Ramp & Lift as anchor case study (ADR-0035). No vertical model is built.*

### 10.4 Benchmark Intelligence

Defensible only after sufficient customer count, data quality, outcome volume, vertical consistency, consent and governance, and metric stability.

*Status: not started, and correctly so — see §19 kill criteria.*

### 10.5 Trust and attribution discipline

Honest estimated-vs-verified separation · correction history · disputed-attribution handling · evidence-linked reporting · transparent billing · provider-neutral event history.

*Status: partially designed, minimally implemented. This is the moat source most compatible with current architecture and the one the Web3 research independently identified as strongest ([`research/RESPONSEOS_WEB3_BLOCKCHAIN_OPPORTUNITY_RESEARCH.md`](../research/RESPONSEOS_WEB3_BLOCKCHAIN_OPPORTUNITY_RESEARCH.md)).*

### 10.6 The abstraction-is-not-a-moat rule

The communications-stack document describes the Communications Abstraction Layer as "the platform's primary infrastructure moat." **This doctrine does not ratify that claim.** An abstraction with one mock adapter and no live provider is architecture preparation. Portability becomes a claim only under the standard in §12.3 (ADR-0043).

---

## 11. Build-vs-buy doctrine

### 11.1 Build internally

Where differentiation and proprietary learning occur:

canonical event model · tenant-scoped data access · audit and evidence model · business-memory schema · operational models · qualification rules · intervention logic · revenue-reconciliation logic · estimated-vs-verified ledger · evidence-linked reporting · benchmark definitions · recommendation engine · trust and provenance layer · diagnostic engine · operator workflows.

### 11.2 Buy or integrate

Commodity or infrastructure capabilities:

carrier services · phone numbers · SIP · SMS delivery · voice orchestration · speech-to-text · text-to-speech · foundation models · CRM · field-service systems · scheduling · payment processing · email delivery · identity provider · object storage · observability infrastructure.

### 11.3 Do not build

a general CRM · native telecom infrastructure · a foundational voice model · a field-service dispatch suite · inventory management · route optimization · payroll · accounting · a generic workflow-builder marketplace · a cryptocurrency network · token infrastructure · wallet infrastructure.

### 11.4 The test

If a capability would still be valuable to ResponseOS when the underlying vendor is swapped, **build it**. If it only has value because a specific vendor provides it, **buy it and put it behind an adapter**.

---

## 12. Provider strategy

### 12.1 Ratified stack and its true implementation status

The stack below is decided. The right-hand column is what exists.

| Role | Ratified choice | Authority | Implementation |
|---|---|---|---|
| Carrier / telephony | **Telnyx** primary; **Twilio** failover | ADR-0031, confirmed ADR-0036 §4 | `DOCUMENTED_ONLY` — no adapter; `telnyx` absent from the provider enum |
| AI voice orchestration | **Vapi** primary; **Retell** secondary | ADR-0032, confirmed ADR-0036 §1 | `DOCUMENTED_ONLY` — enum values exist, adapters do not |
| LLM / transcription brain | **OpenAI inside Vapi** where configurable; Vapi-owned selection as fallback | ADR-0036 §2 | `DOCUMENTED_ONLY` |
| Premium / branded voice | **ElevenLabs**, consent-gated add-on | ADR-0024 | `DOCUMENTED_ONLY` |
| External commercial CRM SoR | **HubSpot** default, client-overridable | ADR-0033 (re-amends ADR-0027, ADR-0015) | `DOCUMENTED_ONLY` |
| Scheduling | **Calendly** MVP baseline; **Cal.com** deferred; **Google Calendar** compatibility required | ADR-0037 (amends ADR-0036 §6) | `DOCUMENTED_ONLY` — `calendly` absent from the calendar-provider enum |
| Async orchestration | **n8n**, strictly outside the realtime loop | ADR-0017 | `PARTIALLY_SHIPPED` — `WorkflowRun` model shipped, no n8n integration |
| Structured-memory database | **Neon Postgres**; Prisma ORM | ADR-0026 (supersedes ADR-0003) | `SHIPPED` — host-agnostic Postgres; hosting is a connection-string decision |
| Object / evidence storage | **Cloudflare R2**; S3 in the HIPAA lane | ADR-0006 | `DOCUMENTED_ONLY` |
| Authentication | **Clerk** | ADR-0005 | `SHIPPED` |
| Email | **Resend** | env spec | `DOCUMENTED_ONLY` |
| Payments | **Stripe** | ADR-0010 (v0.5) | `DOCUMENTED_ONLY` |
| Secrets injection | **Doppler**, opt-in | ADR-0038 | `SHIPPED` (configuration only) |
| Realtime voice gateway + Redis | Deferred for the first v0.3 slice; design retained | ADR-0013 / ADR-0014, deferred by ADR-0030 and ADR-0036 §3 | `NOT_PLANNED` for v1 |
| A2P 10DLC registration | Platform-owned for MVP; BYO a future option | ADR-0036 §5 | `DOCUMENTED_ONLY` |
| Sendblue / iMessage | Out of v0.3 | ADR-0036 §7 | `NOT_PLANNED` |

**No provider may be represented as live** unless the integration exists and has been validated. Today, none is.

> **Reconciliation note.** An earlier draft of this doctrine's provider list named Cal.com as the scheduling baseline. ADR-0037 supersedes that: **Calendly is the v0.3 MVP baseline, Cal.com is the deferred platform-native option, Google Calendar compatibility is required regardless.** The ADR wins.

### 12.2 Provider abstraction rule

**ResponseOS controls:** canonical event schemas · business rules · memory · attribution · audit history · workflow state · outcome reporting.

**Providers control only their commodity function.**

Provider-specific payloads are translated into canonical ResponseOS events at the adapter boundary. **No provider-specific logic exists above that boundary** — this rule survives every provider change in ADR-0012, ADR-0024, ADR-0031, ADR-0032, and ADR-0036, and is the reason those reversals cost nothing in code.

### 12.3 Provider portability rule

Portability is **not proven** until either:

- at least two adapters implement the same interface, **or**
- one live provider and one verified fallback path have been tested end to end.

**A TypeScript interface plus a mock adapter is architecture preparation, not proven provider portability.** Ratified as ADR-0043.

### 12.4 Provider review triggers

Reassess a provider when:

- reliability falls below target;
- cost materially harms unit economics;
- required compliance support is unavailable;
- feature access becomes restrictive;
- vendor lock-in threatens canonical data ownership;
- latency harms the customer experience;
- the provider changes pricing materially;
- the provider becomes a direct strategic competitor;
- required functionality cannot be implemented cleanly.

A trigger opens a review. A review produces an ADR. Neither a trigger nor a preference alone changes the stack.

---

## 13. Communications stack doctrine

Aircall, Dialpad, RingCentral, OpenPhone, Smith.ai, Ruby, GoHighLevel, and similar systems must be **evaluated by role**, not treated as interchangeable providers. Classify each candidate as one or more of:

carrier infrastructure · voice-agent infrastructure · business phone system · unified communications system · contact center · receptionist product · CRM platform · workflow platform · direct buyer-facing competitor · distribution gatekeeper · integration partner.

A system can be a partner in one role and a competitor in another. Smith.ai and Ruby are competitors to the wedge, not providers of it. GoHighLevel is a supported connector and a competitor; ADR-0033 §3 already forbids depending on its telephony.

### 13.1 The bundling rule

**Do not replace Telnyx or Vapi merely because another system has more bundled features.** A provider change must be justified by at least one of:

measurable reliability · materially better economics · required functionality · reduced implementation complexity · stronger compliance posture · superior control of data and workflows · proven fit with the ResponseOS architecture.

**Bundling alone is not sufficient.** A bundle that owns the canonical data is a lock-in risk wearing a discount.

---

## 14. Revenue attribution doctrine

### 14.1 Explicit revenue states

```text
ESTIMATED
INFLUENCED
QUALIFIED
BOOKED
COMPLETED
COLLECTED
DISPUTED
REJECTED
UNATTRIBUTED
```

Ratified as ADR-0041. **Status: `DOCUMENTED_ONLY`** — the schema currently carries only estimated and verified totals. Introducing these states requires a separate approved PR.

### 14.2 Required fields on every revenue claim

amount · state · evidence source · originating event · intervention · customer or lead · timestamp · confidence · attribution rule · human verification status · correction history.

### 14.3 The four rules

> **Estimated revenue is not recovered revenue.**

> **Booked revenue is not collected revenue.**

> **Influence is not causation.**

> **Outcome fees must not be charged until the attribution and dispute process is operationally validated.**

The fourth rule has a commercial consequence: `Engagement.outcome_fee_kind` already supports `pct_recovered_revenue` and `per_verified_recovered_lead`. **Neither may be billed** until §18's Revenue Gate passes. Outcome fees remain optional upside on a retainer — never the whole deal ([`pricing-and-onboarding.md`](../pricing-and-onboarding.md)).

### 14.4 Start manual

Outcome reconciliation may be **manual or semi-manual for pilot customers**. Build the smallest useful reconciliation loop — one pilot, one spreadsheet-grade process, one honest error rate — **before** generalized attribution infrastructure. A reconciliation engine built before a reconciled pilot is a guess with a schema.

---

## 15. Trust Infrastructure doctrine

> **ResponseOS is blockchain-compatible, not blockchain-dependent.**

```text
Business systems
    ↓
Canonical events
    ↓
Evidence and audit history
    ↓
Internal verification
    ↓
Optional verification adapters
    ↓
External ledger or blockchain, if ever justified
```

**Blockchain must never become the system of record for private operational data.** The internal system of record is and remains the ResponseOS event ledger (ADR-0002, ADR-0033 §1).

### 15.1 The sequenced path

Per [`research/RESPONSEOS_WEB3_BLOCKCHAIN_OPPORTUNITY_RESEARCH.md`](../research/RESPONSEOS_WEB3_BLOCKCHAIN_OPPORTUNITY_RESEARCH.md), the correct order is:

1. **Level 1 — conventional cryptography, no blockchain.** Append-only proof layer in Postgres: canonical JSON, SHA-256 hashes, hash chains, Ed25519 signatures, tenant-scoped signing keys, signed exports. This is the only level with a plausible near-term buyer justification, and it requires no new vendor category.
2. **Level 2 — optional external anchoring.** A Merkle root or timestamped commitment published to a timestamping network, only if a concrete buyer, regulator, insurer, auditor, or partner requires third-party verifiability.

Neither level is authorized by this doctrine. Level 1 is a candidate for the Trust Infrastructure phase (§17 Phase 7).

### 15.2 Potential future uses

proof of existence · timestamp verification · digital signatures · service-completion proof · agent identity · audit integrity · portable reputation · escrow or settlement evidence.

### 15.3 Explicitly prohibited current scope

tokens · NFTs · public-chain customer records · customer wallet onboarding · crypto payments as a dependency · DAO governance · speculative assets · blockchain-first architecture · smart contracts in the MVP · **Web3 positioning in market-facing copy**.

No PII, phone number, customer name, transcript, recording, CRM payload, provider secret, or payment detail may ever be written to a public chain or public decentralized storage.

---

## 16. Human authority and agent governance

**Founder Intelligence provides decision support. It does not independently exercise unrestricted business authority.**

### 16.1 Actions requiring human approval

pricing changes · refunds · contractual commitments · employee discipline · financial transfers · destructive CRM updates · deleting customer evidence · changing attribution rules · sending sensitive communications · altering compliance policies · modifying system-wide business rules.

### 16.2 Required agent-action record

Every agent action must record:

actor identity · agent identity · model and version · prompt or policy version where appropriate · tool invoked · input references · output · confidence · approval state · timestamp · tenant · correction or reversal history.

**Status:** `PARTIALLY_SHIPPED`. `AuditLog` carries actor, role, category, reason, before/after refs, IP, and user agent. It does **not** carry agent identity, model version, prompt version, confidence, or approval state. Closing that gap is a Trust Infrastructure (§17 Phase 7) item and does not block earlier phases.

### 16.3 Relationship to external governance

Agent approval classification, human escalation, and merge authority for this repository are governed by the operator's governance kernel, which sits outside this repository. This doctrine defines *product* authority boundaries — what the ResponseOS product may do to a customer's business — and does not restate or override the operating governance for contributors.

---

## 17. Roadmap doctrine

### 17.1 Strategic phases

These are **capability phases**, distinct from the repository's version milestones. Each exits on evidence, not on feature completion.

| Phase | Purpose | Exit condition |
|---|---|---|
| **Phase 0 — Architecture and Internal Console** | Schema, auth, tenant isolation, CI and testing, mock parity, core operator experience | Internal architecture is coherent and testable |
| **Phase 1 — Live Pilot Communications** | One live carrier, one live voice integration, missed-call intake, call event capture, transcription, qualification, basic scheduling or escalation, one CRM integration | **One real client workflow runs end to end** |
| **Phase 2 — Verified Revenue Loop** | Intervention → booking → completion → collection; estimated / influenced / verified separated; correction and dispute support | **At least one pilot reconciles below the approved dispute threshold** |
| **Phase 3 — Business Memory** | Customer timelines, business context, SOPs and rules, intervention history, searchable operational memory | **The system can correctly reconstruct why an action occurred and what happened afterward** |
| **Phase 4 — Operational Intelligence** | Recurring pattern detection, revenue and workflow leak detection, evidence-linked recommendations, intervention effectiveness | **Operators judge the recommendations useful and actionable** |
| **Phase 5 — Benchmark Intelligence** | Stable metrics, permissioned de-identified aggregation, vertical cohorts, benchmark confidence | **Benchmark outputs meet privacy, sample-size, and data-quality requirements** |
| **Phase 6 — Founder Intelligence System** | Memory + operational models + verified outcomes + benchmarks + recommendations + decision support | **The system measurably improves recurring founder decisions** |
| **Phase 7 — Trust Infrastructure Expansion** | Cryptographic verification, advanced provenance, portable agent identity, external verification adapters | **A validated buyer, compliance, or partner need justifies the complexity** |

### 17.2 Mapping to repository versions

The strategic phases and the version milestones in [`ROADMAP.md`](../ROADMAP.md) are different axes. They map approximately:

| Strategic phase | Repository milestone |
|---|---|
| Phase 0 | v0.1 → v0.2 closeout — ✅ complete |
| Phase 1 | **v0.3** — gated on explicit authorization |
| Phase 2 | v0.3 outcome-fee preview → **v0.5** billing/ledger |
| Phase 3 | v0.3 Phase-1 capture (ADR-0034) → **v0.4** knowledge layer |
| Phases 4–6 | Beyond v1.0 |
| Phase 7 | Unscheduled |

**Where they disagree, `ROADMAP.md` governs what ships and this doctrine governs why and in what order.** The version table remains the single forward source of truth for shipping status.

### 17.3 Phase 0 is complete; Phase 1 has not started

This is the most important sequencing fact in the repository. v0.2 closeout shipped. **The next milestone is entirely gated on an authorization decision, not on engineering work.** Treating v0.3 items as fix-now tasks is a category error.

---

## 18. Validation gates

**No phase advances on feature completion alone.** Each gate requires evidence.

### Live Pilot Gate (Phase 1)
- live calls successfully processed
- webhook events verified — signature validation actually running (§3.2)
- failure handling tested
- tenant isolation confirmed
- escalation path confirmed
- operator can inspect event history

### Revenue Gate (Phase 2)
- attribution definitions ratified (ADR-0041)
- booked / completed / collected states represented
- correction workflow exists
- dispute workflow exists
- manual reconciliation completed for at least one pilot
- error rate measured and recorded

### Memory Gate (Phase 3)
- retrieval accuracy tested
- stale or conflicting memory handled
- evidence linked
- tenant isolation verified
- deletion and export requirements defined

### Intelligence Gate (Phase 4)
- recommendations linked to evidence
- confidence represented
- false-positive rate measured
- operator acceptance measured
- intervention outcomes tracked

### Benchmark Gate (Phase 5)
- sample thresholds defined
- metrics standardized
- cohorts sufficiently large
- client data protected
- consent and governance approved
- uncertainty represented

These gates sit **above** the repository's engineering gates (`lint`, `typecheck`, `test`, `build`, `test:integration`), which remain mandatory per [`AGENTS.md`](../../AGENTS.md). Green CI is necessary and not sufficient.

---

## 19. Kill criteria and narrowing rules

Explicit stop conditions. Each is a pre-commitment made now, while it is cheap to make.

- **Narrow the offer to missed-call recovery** if buyers do not understand the broader revenue-recovery framing.
- **Abandon or defer outcome-based fees** if disputed attribution exceeds the approved threshold.
- **Defer Benchmark Intelligence** if data quality or client volume is insufficient.
- **Defer a vertical** if no paid pilot is acquired within the defined validation period.
- **Do not build native FSM features** regardless of customer requests, unless strategy is formally re-ratified by ADR.
- **Defer compliance-specific lanes** until a real signed customer requires them.
- **Defer blockchain indefinitely** unless a concrete buyer, regulatory, insurance, audit, or partner requirement exists.
- **Replace a provider only** when documented evidence satisfies §12.4.
- **Do not expand to multiple real voice providers** before one end-to-end production workflow is stable.

Two thresholds are deliberately unset and are operator decisions: the **dispute threshold** for outcome fees and the **vertical validation period**. See §23.

---

## 20. Public claims policy

### 20.1 Prohibited until proven

The following are `PROHIBITED_CLAIM` in any market-facing copy, sales asset, comment, commit message, or demo:

- "ResponseOS recovers revenue"
- "ResponseOS proves every recovered dollar"
- "ResponseOS is provider-independent"
- "ResponseOS is production-ready"
- "ResponseOS is HIPAA-ready" / "HIPAA-certified"
- "ResponseOS has a proprietary data moat"
- "ResponseOS has operational benchmarks"
- "ResponseOS has a live Business Memory system"
- "ResponseOS supports blockchain verification"
- "ResponseOS has autonomous agents running businesses"

### 20.2 Allowed phrasing

Language that reflects actual status: **designed to · being validated · pilot architecture · planned · estimated · prototype · documentation-stage · under development.**

The shipped demo surface already models this correctly — it states plainly that it uses clearly-labeled mock data, that it is a simulated walkthrough, that live provider integrations are gated, and that advanced AI memory is not active. **That is the standard.** Every future asset matches it.

### 20.3 How a claim graduates

A prohibited claim becomes allowed only when it can cite:

implementation · tests · production event evidence · customer acceptance · verified outcomes · documented controls.

The citation is recorded in this document's §25 change log when the claim graduates. A claim is never promoted by repetition.

---

## 21. Architecture and PR review checklist

Every meaningful feature or architecture proposal answers all fifteen. A proposal that cannot answer them does not advance.

1. Which layer (§8) does this belong to?
2. Is the capability built, integrated, or deferred (§11)?
3. Does it improve the live pilot path?
4. Does it produce or preserve evidence?
5. Does it support verified outcomes?
6. Does it create proprietary learning?
7. Is it a commodity capability we should buy?
8. Does it duplicate CRM, FSM, telecom, or workflow-platform functionality (§5.2)?
9. Does it introduce vendor lock-in?
10. Does it preserve tenant isolation?
11. Does it increase attribution ambiguity?
12. Does it create a public claim we cannot support (§20)?
13. Does it require a new human-approval control (§16)?
14. Does it increase compliance exposure?
15. Is it required now, or merely strategically interesting?

---

## 22. Near-term build priorities

In order. Each depends on the one before it.

1. Validate one live Telnyx and Vapi communications path.
2. Capture canonical call and message events.
3. Implement webhook verification and idempotency.
4. Complete missed-call recovery.
5. Implement one real CRM synchronization path.
6. Support scheduling or escalation.
7. **Reconcile one pilot manually, from inbound event to collected outcome.**
8. Establish estimated-vs-verified reporting.
9. Preserve customer and operational history.
10. Build evidence-linked operator reporting.
11. Validate the diagnostic sales motion.
12. Acquire pilot-derived outcome evidence.
13. **Only then** expand Business Memory and intelligence capabilities.

**Item 7 is the pivot.** Everything before it is plumbing; everything after it depends on having done it once by hand.

**Every item above is v0.3-gated (ADR-0001, ADR-0019) and requires explicit authorization. This doctrine authorizes none of it.**

### 22.1 Explicitly deferred

multiple provider expansion · native FSM functionality · broad RAG infrastructure · cross-client benchmarking · outcome-based billing automation · white-label reseller mode · advanced compliance lanes · blockchain adapters · agent marketplaces · generalized multi-agent orchestration.

---

## 23. Open decisions

Recorded so they are visibly open rather than silently assumed.

| # | Decision | Owner | Blocking |
|---|---|---|---|
| D-1 | **v0.3 authorization** — the explicit written go/no-go that unblocks live provider work | Operator | All of §22 |
| D-2 | **Price points** for the capacity-based memory tiers; minimum contract length; cancellation and data-export terms; overage rates. The *model* is ratified (ADR-0028); the numbers are not | Operator | Commercial launch |
| D-3 | **Dispute threshold** for outcome fees — the number that defines "reconciles cleanly" in the Phase 2 gate | Operator | Outcome-fee billing |
| D-4 | **Vertical validation period** — how long a vertical gets before the §19 kill rule fires | Operator | Vertical expansion |
| D-5 | **`telnyx` / `calendly` schema representation** — enum extension vs alternative modeling | Engineering, via approved PR | ADR-0036 §4 |
| D-6 | **Whether `architecture.md` is rewritten or retired** in favor of the `RESPONSEOS_*` set | Engineering | Documentation hygiene |
| D-7 | **Level-1 trust ledger scope** — whether hash chains and signatures enter before Phase 7 | Operator + Engineering | Phase 7 |

---

## 24. Related documents

| Topic | Document |
|---|---|
| Decisions of record | [`DECISIONS.md`](../DECISIONS.md) |
| Version milestones and shipping status | [`ROADMAP.md`](../ROADMAP.md) |
| Short product source of truth | [`PRD.md`](../PRD.md) |
| Long-form positioning and buy-vs-build | [`product-spec.md`](../product-spec.md) |
| Commercial motion and diagnostic | [`pricing-and-onboarding.md`](../pricing-and-onboarding.md) |
| Security, tenant isolation, webhook signatures | [`SECURITY.md`](../SECURITY.md) |
| Communications stack decision | [`product/responseos-communications-stack.md`](../product/responseos-communications-stack.md) |
| v0.3 provider readiness | [`product/responseos-v0.3-provider-readiness.md`](../product/responseos-v0.3-provider-readiness.md) |
| v0.3 authorization brief | [`product/responseos-v0.3-authorization-brief.md`](../product/responseos-v0.3-authorization-brief.md) |
| GTM / brand / pricing planning spec | [`product/responseos-gtm-product-roadmap.md`](../product/responseos-gtm-product-roadmap.md) |
| Trust / Web3 research | [`research/RESPONSEOS_WEB3_BLOCKCHAIN_OPPORTUNITY_RESEARCH.md`](../research/RESPONSEOS_WEB3_BLOCKCHAIN_OPPORTUNITY_RESEARCH.md) |
| Canonical spec index | [`product/RESPONSEOS_BUILD_SOURCE.md`](../product/RESPONSEOS_BUILD_SOURCE.md) |
| Agent contract | [`AGENTS.md`](../../AGENTS.md) |

---

## 25. Doctrine change log

| Version | Date | Change |
|---|---|---|
| v1.0 | 2026-07-31 | Initial doctrine. Consolidates positioning (ADR-0022/0028/0035), provider stack (ADR-0031/0032/0033/0036/0037), memory gating (ADR-0016/0029/0034), and trust posture into a single strategic source of truth. Adds the nine-layer architecture, the intelligence flywheel, the moat doctrine, the evidence-state vocabulary, the claims policy, and the review checklist. Ratifies ADR-0039 through ADR-0043. **Proposed — not yet operator-ratified.** |
