# ROADMAP — ResponseOS

**Status:** Live. The board below is the single forward source of truth **for what ships when**. Historical implementation briefs live in [`archive/`](./archive/).

> **Strategy vs. shipping.** This roadmap tracks version milestones. The *capability phases* behind them — Communications → Verified Revenue Loop → Business Memory → Operational Intelligence → Benchmark Intelligence → Founder Intelligence → Trust Infrastructure — and their evidence-based exit gates live in [`strategy/responseos-platform-doctrine-v1.md`](./strategy/responseos-platform-doctrine-v1.md) §17–§18, which also maps the two axes onto each other. Where they disagree, **this roadmap governs shipping status and the doctrine governs sequencing rationale**. Phase 0 (architecture + internal console) is complete; Phase 1 (live pilot communications) is gated on explicit v0.3 authorization, not on engineering work.

## Version table

Narrow terminal-error successor: migration0025 preserves0024 and restores0021's exact post-marker withdrawal error. Runtime validation remains gated by isolation; no milestone advances. [Local correction](readiness/FRL_TERMINAL_ERROR_2026-10-19.md).

Local bounded receipt correction is partial: receipt-visible state guards and per-case test environment restoration are prepared; SQL-only PG16/17/18 checks pass. Dispatch/continuation decisions and isolated application runtime validation remain blocked. No milestone or activation gate advances. [Scope and evidence limits](readiness/FRL_BOUNDED_CORRECTION_2026-10-19.md).

Database hardening under review: [Neon standardization](database/README.md) reconciles existing environments and adds local configuration/history/restore gates plus a PostgreSQL 16/17/18 CI matrix. No milestone promotion, hosted migration or live activation is authorized; deployed connection identity, role/RLS acceptance and hosted recovery remain open.

| Version | Theme | Status |
|---|---|---|
| **v0.1** | Internal operator console scaffold; mock provider adapters; 11 typed models; webhook-ready route stubs; canonical envelopes | ✅ Shipped (`6987c59`, May 2026) |
| **v0.2 Phase A** | Postgres schema + deterministic seed | ✅ Shipped (PR #5, `07cb14e`) |
| **v0.2 Phase B** | Auth scaffold + tenant-aware data access layer | ✅ Shipped (PR #6, `f6cfaf8`) |
| **v0.2 Phase C** | Route consumers (admin + client + API) through the v0.2 data layer | ✅ Shipped (PR #7, `c681134`) |
| **v0.2 Phase D** | Integration test suite + CI integration job against Postgres 16 | ✅ Shipped (PR #12, `8a8c6a0`) |
| **v0.2 closeout** | `Organization` → `Account` + `Booking` → `Appointment` renames; **Clerk** auth wiring (identity schema, session derivation, webhook + `proxy.ts` route protection — ADR-0005, *not* Auth.js); UI rebuild against `DESIGN.md` tokens; remaining v0.2-spec models (provider_connections, conversations/sms_messages, call_segments/call_transcripts, workflow_runs, qa_logs, expanded audit_logs) | ✅ Shipped (PRs #37–#43; migrations `0002`–`0008`) |
| **v0.3** | Live **communications stack** — Telnyx + Vapi primary, Twilio failover, HubSpot CRM sync, Phase-1 Business Memory capture, behind a Communications Abstraction Layer ([`product/responseos-communications-stack.md`](./product/responseos-communications-stack.md)) — with signature verification and call/event persistence; real Stripe billing (Payment Intents, hosted pages, webhook ingest); outcome-fee invoicing preview; outbound recovery campaigns; branded client portals; OpenClaw sandboxed gateway experiment | ⏳ Planned |
| **v0.3 Live Call Demo Slice** | Telnyx AI Assistant conversation; signed post-call ingest; canonical call/transcript/qualification persistence; bounded HubSpot test sync; dedicated inbound-only demo number | 🟠 Repository implementation in review; no environment, provider, deploy, or prospect release evidence ([ADR-0047](./DECISIONS.md#adr-0047--the-first-prospect-proof-is-an-isolated-supervised-post-call-evidence-chain)) |
| **Internal demo tenant** | ResponseOS reference account (`internal_demo` classification, agent profiles, professional opportunities, verified-only answering, mock knowledge + handoff adapters, reporting exclusion) — [ADR-0046](./DECISIONS.md#adr-0046--the-internal-demo-tenant-is-a-first-class-account-not-a-second-application-career-truth-stays-outside-responseos), [brief](./product/responseos-internal-demo-professional-receptionist.md) | ✅ Shipped (mock-first; no live provider) |
| **Personalized prospect bootstrap** | Operator-only sandbox lifecycle; bounded public-website acquisition; reviewed facts; immutable demo snapshot; temporal number assignment; signed Telnyx context resolution; retention and allowlisted promotion manifest — [ADR-0048](./DECISIONS.md#adr-0048--personalized-prospect-bootstrap-is-a-bounded-operator-approved-demo-knowledge-slice) | 🟠 Repository implementation in review; activation, provider resources, deployment, production import, and prospect exposure remain gated |
| **v0.4** | Client knowledge base + agent grounding layer (gated on tenant isolation + audit log + retention controls being in force) | ⏳ Planned |
| **v0.5** | Billing / outcome-fee ledger production: pricing engine, Stripe billing implementation, outcome-fee ledger, client invoice logic, in-app pricing-tier selectors | ⏳ Planned |
| **v1.0** | Client-ready Revenue Recovery OS — polished, onboarding flow complete, white-label-ready | ⏳ Planned |
| **HIPAA-ready lane** | Optional per-tenant deployment lane (AWS-hosted, BAA-backed). Only after independent compliance review and full vendor BAA chain verification. **ResponseOS is not HIPAA-certified out of the box.** | ⏳ Architectural pattern only |

## Current focus (June 2026)

**v0.2 closeout is complete.** The data-model expansion (provider_connections, conversations/sms_messages, call_segments/call_transcripts, workflow_runs, qa_logs, expanded audit_logs) shipped and is wired through the data-access layer and routes; the `Organization` → `Account` and `Booking` → `Appointment` renames landed; **Clerk** auth (identity schema, session derivation, webhook + `proxy.ts` route protection — ADR-0005, not Auth.js) is in force; and the UI was rebuilt against `DESIGN.md` tokens (#43). Tenant-isolation, seed-determinism, and mock-parity integration tests cover the new models.

In parallel, a **GTM Phase 0.5** marketing surface shipped (#66/#67): a public conversion path (`/audit` → mock capture endpoint), a trust/security page, pricing clarity, per-page + Open Graph metadata, an expanded demo narrative, and the home OFFER section — all mock-safe, no live integrations.

**Next milestone: v0.3 — gated.** The bounded post-call repository implementation is in review under ADR-0047, but live provider accounts, credentials, deployments, number routing, and prospect release stay **off** until their separate gates clear. Vapi/Twilio/Calendly, real Stripe billing, outbound recovery, recording, and production remain deferred.

## v0.2 acceptance criteria

Carried forward from the v0.2 planning spec ([archived here](./archive/v0.2-planning-spec.md)):

- [x] Supabase / Postgres persistence added.
- [x] Auth scaffold added (real **Clerk** provider wiring landed in v0.2 closeout — ADR-0005).
- [x] Tenant-aware data access added.
- [x] Client portal reads from database.
- [x] Webhook event ledger added (foundation).
- [x] Audit logs started.
- [x] Provider adapters remain safe and mockable.
- [x] `.env.example` updated without real secrets.
- [x] Lint passes.
- [x] Typecheck passes.
- [x] Build passes.
- [x] No Firebase.
- [x] No real keys.
- [x] No production deployment.

## v0.3 preview (not yet authorized)

- **Communications stack (CTO decision — [`product/responseos-communications-stack.md`](./product/responseos-communications-stack.md)):** Telnyx primary carrier (voice + A2P SMS), Vapi primary AI receptionist orchestration, Twilio failover, HubSpot CRM event sync, Cal.com/GHL scheduling — all behind a Communications Abstraction Layer; signature verification + call/event persistence into the ledger. _Ratified by ADR-0031 (Telnyx) + ADR-0032 (Vapi) + ADR-0033 (HubSpot SoR); `BUILD_SOURCE` Grok-primary stack still to be reconciled (comms doc §9–§10)._
- **Live Call Demo Slice (ADR-0045):** a bounded public demo using a Telnyx-first call path, Sent.dm-assisted verification/follow-up messaging, a dedicated ResponseOS demo number, demo-only tenant, inbound call first, and outbound request-call second. Vapi remains optional behind the abstraction if Telnyx AI Assistant cannot satisfy the first demo conversation. The recommended sequence is captured in [`product/responseos-v0.3-live-call-demo-implementation-brief.md`](./product/responseos-v0.3-live-call-demo-implementation-brief.md): contracts and mocks first, signed webhook ingest second, inbound normalization third, outbound request gates fourth, live activation last.
- **Phase-1 Business Memory baseline:** structured capture of every AI receptionist interaction (transcript, summary, intent, qualification, appointment, follow-up, CRM-sync status, next action) into the event ledger. Operational capture only — the v0.4 per-tenant knowledge / RAG layer stays gated.
- **Escalation-triggered CRM follow-up task for outcomes that are not qualified (requires an ADR-0047 amendment):** today the supervised-pilot closure exports a follow-up task when the retained `qualification_status` field is `"qualified"` — `runCrmSyncForCall` checks that single field and never evaluates the canonical outcome, so a builder/GC or commercial inquiry *can* receive a task when the upstream payload marks it qualified. FRL policy §16 records a **proposed** allowlist restricting this to `QUALIFIED_FREE_EVALUATION` and `QUALIFIED_QUOTE_REVIEW`; it is not ratified and not implemented, and adopting it is an open business decision. The deferred scope is a task on escalations that are *not* qualified: an unavailable or failed live transfer (FRL policy §11), and the project-review outcomes `BUILDER_GC_PROJECT_REVIEW` and `COMMERCIAL_PROJECT_REVIEW`. These are real leads, and withholding the CRM task currently leaves them **no automated fallback**: the ledger persistence and completed-interaction notification described in the policy are `DOCUMENTED_ONLY`, and `lib/notifications` holds no implementation. Until that path ships, an unqualified escalation reaches a human only by whatever manual review the operator runs. Widening the trigger expands ratified closure behaviour, so **ADR-0047 must be amended before implementation** — a documentation change alone must not do it. Scope defined in [`ops/client-delivery/FRL_INBOUND_INTAKE_ROUTING_POLICY.md`](./ops/client-delivery/FRL_INBOUND_INTAKE_ROUTING_POLICY.md) §16.
- Real Stripe billing — Payment Intents, hosted pages, webhook ingest.
- Outcome-fee invoicing — verified booked appointments and verified recovered revenue against a baseline, with evidence links per invoice.
- Outbound recovery campaigns — list builder, consent gating, AI dialer integration.
- Branded client portals — custom domain, theme variables, white-label assets, tenant RBAC for branding settings.
- OpenClaw sandboxed workflow gateway experiment — exploratory, isolated from the live phone path.
- HIPAA-ready deployment lane — only after independent compliance review and full vendor BAA chain verification per tenant.

## CRM interoperability architecture phases

These phases are governed by [ADR-0050](./DECISIONS.md#adr-0050--crm-interoperability-uses-canonical-models-governed-mutation-intents-and-provider-adapters). They describe architecture sequencing, not current product completion. CRM-0 doctrine is accepted. The CRM-1 PRD is planning only; CRM-1 runtime and every later phase require separate current-state review, exact-scope operator authorization, implementation, and validation.

| Phase | Status | Scope |
|---|---|---|
| **CRM-0 — Doctrine** | **Accepted — documentation only** | ADR-0050 defines canonical/current/target-state separation, interoperability doctrine, agentic mutation governance, and phase gates. It changed no runtime, schema, provider, credential, workflow, deployment, or production behavior. |
| **CRM-1 — Connection + Registry** | **Planning in review / runtime gated** | The [CRM-1 PRD](./product/responseos-crm-1-connection-registry-prd.md) recommends a domain projection over the existing `ProviderConnection` credential substrate plus a static Provider Registry. The PRD authorizes no implementation. |
| **CRM-2 — Entity Mapping + Generic Operations** | **Future / gated** | `CrmEntityMapping` and generalization of the current call-centric `CrmSyncOperation`. |
| **CRM-3 — Field Mapping + Inbound Sync** | **Future / gated** | `CrmFieldMapping`, `CrmSyncCursor`, `CrmConflict`, and governed inbound reconciliation. |
| **CRM-4 — Agentic Mutation Governance** | **Future / gated** | `CrmMutationIntent`, field/domain authority, execution classes, and approval controls. |
| **CRM-5 — Second Real CRM Adapter** | **Future / gated** | Separately select and implement a second provider to test the abstraction. No provider is selected by CRM-0. |
| **CRM-6 — Broader Adapter Ecosystem** | **Future / gated** | Additional general or vertical CRM adapters only when validated market need justifies them. |

CRM-0 did not expand the live-demo slice, authorize live HubSpot writes, activate a CRM, configure credentials, or advance v0.3 gates. The CRM-1 planning artifact also authorizes nothing; CRM-1 runtime MUST NOT start unless a separately approved task names an exact implementation slice.

## Future Knowledge Layer (v0.4+)

ResponseOS may later include a client-specific knowledge layer that grounds AI voice, SMS, booking, quote, and support workflows in approved business knowledge. This is a roadmap target for **v0.4 or later**. It is **not** part of v0.2, not part of v0.3, and not part of the current database / auth foundation.

> **Distinct from Phase-1 Business Memory capture.** The v0.3 communications stack introduces a *lightweight Business Memory baseline* — structured transcript/summary/intent/qualification records written to the event ledger ([`product/responseos-communications-stack.md`](./product/responseos-communications-stack.md) §4). That is **operational capture** and is **not** gated by this section. What remains **v0.4-gated** is per-tenant *knowledge ingestion, retrieval, vector search, and RAG/grounding* — behind the full controls below (tenant isolation, source ownership, audit, retention, PII minimization, deletion/export). The Phase-1 baseline establishes the capture foundation without enabling any gated knowledge behavior.

> **Distinct from the internal demo tenant's knowledge provider.** ADR-0046 adds `ProfessionalKnowledgeProvider` with a single deterministic fixture adapter for the `internal_demo` reference tenant. It performs **no ingestion, no upload surface, no retrieval index, no embeddings, no vector search, and no RAG**, adds **no knowledge model to the schema**, introduces no dependency or secret, and serves **no client tenant**. The v0.4 gates below are unchanged and still bind every client-facing knowledge capability.

> **Narrow personalized-demo exception.** ADR-0048 authorizes an operator-only, website-only subset for short-lived `sandbox` accounts: bounded acquisition, provenance-backed structured facts, fact-level human approval, and one immutable snapshot supplied to a supervised demo assistant. It excludes uploads, client logins, production tenants, vectors/embeddings, general retrieval/RAG, automated social or private sources, provider memory, CRM writes, and unattended activation. Those broader capabilities remain v0.4-gated.

### Required gates before client-facing knowledge ingestion

Before any client-facing knowledge ingestion ships, ResponseOS must support:

- tenant isolation
- source ownership
- upload permissions
- audit logging
- retention policy
- transcript / recording controls
- PII minimization
- deletion / export workflow
- approved-source controls
- human review for sensitive knowledge
- regulated-workflow restrictions

### Out of scope until v0.4 is scheduled

Documenting this roadmap does **not** authorize any of:

- RAG implementation
- vector search
- embeddings indexes or pipelines
- file-upload surfaces
- Obsidian or other personal-knowledge integrations
- new dependencies, provider SDKs, or secrets
- new database models for knowledge
- production deployment

Architectural placement: [`architecture.md`](./architecture.md) § Future Knowledge Layer. Future data model candidates: [`data-schema.md`](./data-schema.md) § Future Knowledge Layer. Product framing: [`research-report.md`](./research-report.md) § Future Knowledge Layer.

## Hard constraints across all versions

- No Firebase.
- No real secrets in the repo.
- No production deploys from this repo until v0.3 readiness gates clear, except the public read-only demo surface (ADR-0053): the marketing pages and `/demo/receptionist`, on mock adapters, operator-authorized and deployed by hand. Not v0.3 authorization.
- Provider adapters fall back to mock when env vars are missing — the app must boot and run without live keys at every version.
- ResponseOS is not HIPAA-certified or HIPAA-compliant out of the box. The HIPAA-ready lane is an architectural pattern, not a current product capability.

## Mike supervised FRL demonstration

Repository implementation in progress under the [approved brief](./product/responseos-mike-live-demo.md). Reuses the supervised runtime candidate; adds per-call capture authority, pinned approved knowledge, human-reviewed follow-up and operational email. No live activation or readiness gate is cleared.

Local FRL hardening scope (in review): additive webhook fingerprint migration0018 and synthetic recovery/retention tests only. Production ingestion binding, key provisioning, hosted migration and activation are not shipped; see [local scope](readiness/FRL_FINGERPRINT_LOCAL_2026-10-18.md).

Local-only fingerprint runtime successor is under review: [scope, limits and approval gates](readiness/FRL_FINGERPRINT_RUNTIME_2026-10-18.md). This is no milestone promotion or deployment authority; retention conflict and real key policy remain open.

Local L1/L2 remediation is in review: [retention authority](readiness/FRL_RETENTION_REMEDIATION_2026-10-19.md). No milestone promotion or hosted authority.

Local UTC retention correction is in review: [scope and verification](readiness/FRL_RETENTION_UTC_2026-10-19.md). No readiness promotion.

Source-time withdrawal5.8 is a local review candidate: [contract](readiness/FRL_WITHDRAWAL_SOURCE_2026-10-19.md). Hosted and rehearsal gates remain open.

Restricted post-withdrawal transfer: local preflight/simulation under review; hosted execution blocked on qualified cessation and recording evidence. [Scope](readiness/FRL_WITHDRAWAL_TRANSFER_2026-10-19.md).

Local commissioning successor in review: operator End call and exact-call authenticated disconnection evidence, including withdrawn calls. EXPERIMENTAL; no milestone or activation change. [Contract](readiness/FRL_LOCAL_COMMISSIONING_2026-10-19.md).

Disabled commissioning control remains in review with pinned locked tooling and trusted qualification modes. Bounded eligibility/operator-clarity successor is EXPERIMENTAL and in review; no milestone or activation change. [Shared contract](readiness/FRL_END_CALL_ELIGIBILITY_2026-10-19.md).

Disconnection-fact successor (F1, local migration 0022) is EXPERIMENTAL and awaiting separate review; no milestone, hosted migration or activation change. F2 remains an open scope decision. [Amendment](readiness/FRL_END_CALL_ELIGIBILITY_2026-10-19.md).

Local EXPERIMENTAL withdrawal correction under review: [raw-ledger admission race](readiness/FRL_WITHDRAWAL_LEDGER_RACE_2026-10-19.md). No milestone or activation gate moves; F2 remains unimplemented.

Independent withdrawal receipt/drain is a local review candidate under accepted Option B. [Scope](readiness/FRL_WITHDRAWAL_RECEIPT_B_2026-10-19.md). No milestone or hosted readiness promotion.


### Local operator End call successor — October 19
Owner approved the pinned final authorization boundary and isolated tests; no milestone or activation gate moves. [Contract](readiness/FRL_OPERATOR_END_CALL_2026-10-19.md). Prior frozen-pair runtime validation is complete and accepted as relayed; this successor needs its own exact-tree evidence. Other command waits, continuation, F2 and the Low post-drain DB state gap remain separate.


### Narrow local withdrawal recovery — October19
[Database-only continuation and read-only End call phases](readiness/FRL_WITHDRAWAL_DATABASE_RECOVERY_2026-10-19.md) implement the owner-approved recovery scope. No milestone/activation gate moves. Provider start-stop ordering, provider-stop continuation and broader retry changes remain unresolved and out of scope.


### Bounded supervised AI-start safety — October19
[Conditional one-shot AI start](readiness/FRL_AI_START_WITHDRAWAL_SAFETY_2026-10-19.md) is owner-approved for local implementation and isolated validation against the reviewed trim pair. No milestone, provider or activation gate moves. Carrier terminal behavior and two observed rehearsals remain live-demo prerequisites; CRM/email effects are deferred.

### Full Grok Voice 3.0 local experiment — October19
Owner-selected Direct SIP feasibility and offline scaffolding only; no milestone or activation gate moves. [Blocking decisions and exact action-time scopes](readiness/FRL_GROK_DIRECT_SIP_2026-10-19.md). Existing Telnyx qualification is not xAI qualification.

Grok local checkpoint: both safety decisions approved; thirty protocol/model tests include a separate watchdog process after simulated worker death. Runtime wiring, durable binding, provider evidence and independent hosting remain blockers; no live gate advances.

Grok application checkpoint: durable claims and disabled application paths implemented for local testing. Transport reassessment recommends retaining Telnyx Call Control with a post-consent media bridge; no material transport change yet. Hosted qualification and matching control successor remain gated.

Local Grok checkpoint now includes the injected-socket media bridge, exact signed stream binding and bounded audio/withdrawal tests. Production listener/hosting and live qualification remain out of scope for this checkpoint; no activation gate moves.

Grok local socket successor adds actual TLS/WebSocket/HTTPS adapter composition and loopback end-to-end qualification. Status remains EXPERIMENTAL; hosted activation and real-provider qualification are not authorized.

Local EXPERIMENTAL Grok qualification candidate: immutable GrokQualificationReservation (migration0028), one global slot released only by authenticated exact disconnection; no new public authority API or activation. [Contract](readiness/FRL_GROK_QUALIFICATION_2026-10-20.md).

Local Linux packaging and inactive watchdog successor is under review; accepted app8bdd184/control1ff5e37 are preserved and published only to dedicated branches. No milestone or activation gate advances. [Local scope](readiness/FRL_GROK_LINUX_PACKAGE_2026-10-20.md).

Local startup-readiness regression and inactive hosting lifecycle are under review; no release acceptance or hosting approval. The October20 10:30a.m. America/New_York checkpoint favors a labeled local walkthrough if hosted safety evidence is incomplete. [Review scope](readiness/FRL_GROK_STARTUP_LIFECYCLE_2026-10-20.md).

Local EXPERIMENTAL watchdog-readiness P2 successor requires fresh active-loop sweep proof before qualification; inactive liveness cannot authorize calls. See [contract](readiness/FRL_GROK_WATCHDOG_READINESS_2026-10-20.md). No hosted or activation gate advances.

Local caller-impact successor documents and tests termination of active calls on watchdog readiness loss, including restart. Reviewed f7ea48b/958fda6 remains frozen. Caller-impact acceptance, hosted timing/layout and live gates remain open; no runtime or milestone expansion. [Contract](readiness/FRL_GROK_WATCHDOG_READINESS_2026-10-20.md#caller-impact-and-release-acceptance).

Local cross-host watchdog readiness successor is in implementation under ADR-0080. Exact-pair independent review, caller-impact acceptance, hosted timing/safety checks and supervised-demo release acceptance remain open.

Local ADR-0080 P2 successor preserves fd4562f/7d433a6 and addresses transient transport failure and watchdog self-routing. Frozen-pair review, hosted measurements and owner release acceptance remain open.

Local ADR-0081 knowledge successor preserves35920b5/653265f. Synthetic-only validation of approved packet loading and exact realtime acknowledgement is in progress. No hosted gate advances. Owner now requires a real inbound FRL demo; the earlier local-walkthrough fallback does not fulfill that deliverable. $10 target/$20 original general-demo ceiling; subsequent owner authorization reserves up to $15 additional exclusively for xAI API funding, making $35 combined including the $20 already paid. This is not $35 remaining or generic hosting authority. No new recurring subscription authorized. [Contract](readiness/FRL_APPROVED_KNOWLEDGE_2026-10-20.md).

Sam/Ara local successor is in review under ADR-0081. No live-demo milestone advances. [Scope](readiness/FRL_SAM_RUNTIME_2026-10-20.md).

Sam hardening successor fixes optional greeting failures without weakening media gates, clarifies operator-mediated withdrawal and retains exact provider voice acknowledgment. Local review only; hosted/carrier gates remain open.
