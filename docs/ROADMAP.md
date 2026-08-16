# ROADMAP — ResponseOS

**Status:** Live. The board below is the single forward source of truth **for what ships when**. Historical implementation briefs live in [`archive/`](./archive/).

> **Strategy vs. shipping.** This roadmap tracks version milestones. The *capability phases* behind them — Communications → Verified Revenue Loop → Business Memory → Operational Intelligence → Benchmark Intelligence → Founder Intelligence → Trust Infrastructure — and their evidence-based exit gates live in [`strategy/responseos-platform-doctrine-v1.md`](./strategy/responseos-platform-doctrine-v1.md) §17–§18, which also maps the two axes onto each other. Where they disagree, **this roadmap governs shipping status and the doctrine governs sequencing rationale**. Phase 0 (architecture + internal console) is complete; Phase 1 (live pilot communications) is gated on explicit v0.3 authorization, not on engineering work.

## Version table

| Version | Theme | Status |
|---|---|---|
| **v0.1** | Internal operator console scaffold; mock provider adapters; 11 typed models; webhook-ready route stubs; canonical envelopes | ✅ Shipped (`6987c59`, May 2026) |
| **v0.2 Phase A** | Postgres schema + deterministic seed | ✅ Shipped (PR #5, `07cb14e`) |
| **v0.2 Phase B** | Auth scaffold + tenant-aware data access layer | ✅ Shipped (PR #6, `f6cfaf8`) |
| **v0.2 Phase C** | Route consumers (admin + client + API) through the v0.2 data layer | ✅ Shipped (PR #7, `c681134`) |
| **v0.2 Phase D** | Integration test suite + CI integration job against Postgres 16 | ✅ Shipped (PR #12, `8a8c6a0`) |
| **v0.2 closeout** | `Organization` → `Account` + `Booking` → `Appointment` renames; **Clerk** auth wiring (identity schema, session derivation, webhook + `proxy.ts` route protection — ADR-0005, *not* Auth.js); UI rebuild against `DESIGN.md` tokens; remaining v0.2-spec models (provider_connections, conversations/sms_messages, call_segments/call_transcripts, workflow_runs, qa_logs, expanded audit_logs) | ✅ Shipped (PRs #37–#43; migrations `0002`–`0008`) |
| **v0.3** | Live **communications stack** — Telnyx + Vapi primary, Twilio failover, HubSpot CRM sync, Phase-1 Business Memory capture, behind a Communications Abstraction Layer ([`product/responseos-communications-stack.md`](./product/responseos-communications-stack.md)) — with signature verification and call/event persistence; real Stripe billing (Payment Intents, hosted pages, webhook ingest); outcome-fee invoicing preview; outbound recovery campaigns; branded client portals; OpenClaw sandboxed gateway experiment | ⏳ Planned |
| **v0.3 Live Call Demo Slice** | Telnyx-first live-call path; Sent.dm-assisted verification/follow-up; Vapi optional if Telnyx AI Assistant blocks; dedicated demo number; inbound first, outbound second; demo-only tenant; signature validation, consent, rate limits, spend cap, and kill switch | 🟡 Planned / scoped ([ADR-0045](./DECISIONS.md#adr-0045--v03-live-call-demo-slice-telnyx-first-sentdm-assisted-inbound-first)) |
| **Internal demo tenant** | ResponseOS reference account (`internal_demo` classification, agent profiles, professional opportunities, verified-only answering, mock knowledge + handoff adapters, reporting exclusion) — [ADR-0046](./DECISIONS.md#adr-0046--the-internal-demo-tenant-is-a-first-class-account-not-a-second-application-career-truth-stays-outside-responseos), [brief](./product/responseos-internal-demo-professional-receptionist.md) | ✅ Shipped (mock-first; no live provider) |
| **v0.4** | Client knowledge base + agent grounding layer (gated on tenant isolation + audit log + retention controls being in force) | ⏳ Planned |
| **v0.5** | Billing / outcome-fee ledger production: pricing engine, Stripe billing implementation, outcome-fee ledger, client invoice logic, in-app pricing-tier selectors | ⏳ Planned |
| **v1.0** | Client-ready Revenue Recovery OS — polished, onboarding flow complete, white-label-ready | ⏳ Planned |
| **HIPAA-ready lane** | Optional per-tenant deployment lane (AWS-hosted, BAA-backed). Only after independent compliance review and full vendor BAA chain verification. **ResponseOS is not HIPAA-certified out of the box.** | ⏳ Architectural pattern only |

## Current focus (June 2026)

**v0.2 closeout is complete.** The data-model expansion (provider_connections, conversations/sms_messages, call_segments/call_transcripts, workflow_runs, qa_logs, expanded audit_logs) shipped and is wired through the data-access layer and routes; the `Organization` → `Account` and `Booking` → `Appointment` renames landed; **Clerk** auth (identity schema, session derivation, webhook + `proxy.ts` route protection — ADR-0005, not Auth.js) is in force; and the UI was rebuilt against `DESIGN.md` tokens (#43). Tenant-isolation, seed-determinism, and mock-parity integration tests cover the new models.

In parallel, a **GTM Phase 0.5** marketing surface shipped (#66/#67): a public conversion path (`/audit` → mock capture endpoint), a trust/security page, pricing clarity, per-page + Open Graph metadata, an expanded demo narrative, and the home OFFER section — all mock-safe, no live integrations.

**Next milestone: v0.3 — gated.** Live provider integrations (Telnyx/Vapi/Twilio/HubSpot/Calendly), real Stripe billing, and any production deploy stay **off** until v0.3 is **explicitly authorized** per the AGENTS hard rules. Written founding-pilot scope + acceptance gates: [`product/responseos-v0.3-founding-pilot-scope.md`](./product/responseos-v0.3-founding-pilot-scope.md) (Path B Standard-lane home-services; staged auths still required — start with mock CAL per [`product/responseos-v0.3-authorization-brief.md`](./product/responseos-v0.3-authorization-brief.md)). No live v0.3 code lands before the matching written authorization.

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
- Real Stripe billing — Payment Intents, hosted pages, webhook ingest.
- Outcome-fee invoicing — verified booked appointments and verified recovered revenue against a baseline, with evidence links per invoice.
- Outbound recovery campaigns — list builder, consent gating, AI dialer integration.
- Branded client portals — custom domain, theme variables, white-label assets, tenant RBAC for branding settings.
- OpenClaw sandboxed workflow gateway experiment — exploratory, isolated from the live phone path.
- HIPAA-ready deployment lane — only after independent compliance review and full vendor BAA chain verification per tenant.

## Future Knowledge Layer (v0.4+)

ResponseOS may later include a client-specific knowledge layer that grounds AI voice, SMS, booking, quote, and support workflows in approved business knowledge. This is a roadmap target for **v0.4 or later**. It is **not** part of v0.2, not part of v0.3, and not part of the current database / auth foundation.

> **Distinct from Phase-1 Business Memory capture.** The v0.3 communications stack introduces a *lightweight Business Memory baseline* — structured transcript/summary/intent/qualification records written to the event ledger ([`product/responseos-communications-stack.md`](./product/responseos-communications-stack.md) §4). That is **operational capture** and is **not** gated by this section. What remains **v0.4-gated** is per-tenant *knowledge ingestion, retrieval, vector search, and RAG/grounding* — behind the full controls below (tenant isolation, source ownership, audit, retention, PII minimization, deletion/export). The Phase-1 baseline establishes the capture foundation without enabling any gated knowledge behavior.

> **Distinct from the internal demo tenant's knowledge provider.** ADR-0046 adds `ProfessionalKnowledgeProvider` with a single deterministic fixture adapter for the `internal_demo` reference tenant. It performs **no ingestion, no upload surface, no retrieval index, no embeddings, no vector search, and no RAG**, adds **no knowledge model to the schema**, introduces no dependency or secret, and serves **no client tenant**. The v0.4 gates below are unchanged and still bind every client-facing knowledge capability.

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
- No production deploys from this repo until v0.3 readiness gates clear.
- Provider adapters fall back to mock when env vars are missing — the app must boot and run without live keys at every version.
- ResponseOS is not HIPAA-certified or HIPAA-compliant out of the box. The HIPAA-ready lane is an architectural pattern, not a current product capability.
