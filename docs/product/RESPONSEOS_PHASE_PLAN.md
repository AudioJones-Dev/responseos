# ResponseOS — Phase Plan

**Owner:** AJ Digital LLC / Audio Jones
**Status:** Canonical (go-forward). Implementation sequencing with entry/exit gates so phases can be built without guessing.
**Read first:** [`RESPONSEOS_ROADMAP.md`](./RESPONSEOS_ROADMAP.md) · [`RESPONSEOS_BUILD_SOURCE.md`](./RESPONSEOS_BUILD_SOURCE.md)

> Each phase has **entry gates** (must be true to start), **work**, **exit gates** (must be true to finish), and **owner**. No phase starts before its predecessor's exit gates pass. The validation gates referenced throughout are: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:integration` (Postgres 16) — both CI jobs (`validate` + `integration`) green.

---

## Phase 0 — Foundation (DONE)

**Status:** ✅ v0.1 + v0.2 A–D shipped.
**Delivered:** Next.js App Router scaffold; 11 typed models; mock adapters; Postgres schema + deterministic seed; tenant-aware data layer (`account_id` from session); integration tests + Postgres-backed CI; webhook event-ledger foundation; audit-log foundation.
**Exit gate (met):** CI green; tenant scoping enforced at the data layer; app boots without secrets.

---

## Phase 1 — v0.2 closeout (DONE)

**Status:** ✅ Shipped (see [`../ROADMAP.md`](../ROADMAP.md)).
**Entry gate:** Phase 0 exit met.
**Owner:** core/platform.
**Delivered:** `Organization` → `Account` and `Booking` → `Appointment` renames; Clerk auth wiring; UI rebuild against [`../DESIGN.md`](../DESIGN.md); remaining model expansion (`provider_connections`, conversations/SMS, call segments/transcripts, workflow_runs, qa_logs, audit_logs); CI green; no live providers; no deploy.

---

## Phase 2 — v0.3 CAL + provider abstraction (MVP live, part A)

**Entry gate:** Phase 1 exit met; **staged written v0.3 authorization** per [`responseos-v0.3-founding-pilot-scope.md`](./responseos-v0.3-founding-pilot-scope.md) §5 (start with Stage A mock CAL — [`responseos-v0.3-authorization-brief.md`](./responseos-v0.3-authorization-brief.md)).
**Owner:** backend/voice.
**Work:**
1. Implement CAL interfaces + **mock adapters only** (`CarrierProvider`, `VoiceAgentProvider`, `SmsProvider`, `CrmProvider`, `SchedulingProvider`) mirroring `lib/providers/voice/`.
2. Provider resolver: env-absent → mock (ADR-0001).
3. Schema/env placeholder alignment (e.g. `telnyx`, Calendly) only under a **separate** Stage B auth — not in the first mock slice.
4. **Node voice gateway + Redis deferred** (ADR-0036) unless readiness testing later requires them.
5. Live adapters (Telnyx / Vapi / Twilio failover) only under later staged auths — never in the mock-CAL slice.

**Exit gates:**
- [ ] Mock CAL merged; app boots with zero secrets; unit tests assert mock resolution.
- [ ] CI `validate` + `integration` green.
- [ ] No live SDKs, secrets, or deploys in this phase’s first slice.
- [ ] Provider-readiness checklist path documented for the live stages ([`responseos-v0.3-provider-readiness.md`](./responseos-v0.3-provider-readiness.md) §7).

---

## Phase 3 — v0.3 live integrations + RECOVER playbooks (MVP live, part B)

**Entry gate:** Phase 2 mock CAL exit met; staged auths for schema + each live provider ([founding-pilot scope](./responseos-v0.3-founding-pilot-scope.md) §5 Stages B–H).
**Owner:** core + integrations.
**Work:**
1. Live **Telnyx** (primary carrier voice + A2P SMS; signature validation; persistence) with **Twilio** failover.
2. Live **Vapi** orchestration (OpenAI preferred in-Vapi brain; Retell secondary).
3. **HubSpot** connector (OAuth, contact/deal/ticket mirroring, `crm_mappings`, signed webhooks) — default CRM SoR (ADR-0033).
4. **Calendly** scheduling (Google Calendar compatible; Cal.com deferred — ADR-0037).
5. Post-call normalization pipeline (lane-aware redaction → canonical objects → CRM mirror → ROI); Phase-1 Business Memory **ledger capture only** (vault/RAG stays v0.4).
6. n8n async flows for the 7 RECOVER playbooks (`workflow_runs`, idempotent).
7. Notifications (SMS/email/in-app/slack) via adapters; Resend email for reports.

**Exit gates:**
- [ ] All 7 RECOVER playbooks run end-to-end live on the Standard lane (staging first).
- [ ] HubSpot sync verified; conflict handling exercised.
- [ ] Signature validation > 99.9%; replays are no-ops.
- [ ] Tenant retention/redaction lane applied before persistence.
- [ ] CI green.

---

## Phase 4 — v0.3 tenant provisioning, reporting, basic white-label (MVP live, part C)

**Entry gate:** Phase 3 exit met.
**Owner:** product/frontend.
**Work:**
1. Tenant provisioning wizard (data-only; profiles created/versioned).
2. Onboarding/Readiness Assessment flow (10 inputs → Readiness packet).
3. Integrations connect UI (HubSpot/calendar OAuth).
4. Transcript/QA review UI (redacted default; break-glass for raw).
5. Monthly ROI report (portal page + PDF + email); outcome-fee **preview** (manual — not Stripe engine).
6. Basic white-label (theme vars, wildcard subdomain) only as needed for the founding pilot — full white-label stays v1.0.

**Exit gates:**
- [ ] A new tenant can be provisioned + onboarded with **no code change**.
- [ ] ≥1 **home-services** pilot client live on the **Standard** lane producing a defensible monthly ROI report ([founding-pilot scope](./responseos-v0.3-founding-pilot-scope.md)).
- [ ] Zero cross-tenant data-exposure incidents (verified by isolation tests + review).
- [ ] Break-glass logged + tenant-notified; audit logs populated.
- [ ] CI green. **Production deploy authorized only after these gates + staged §5 auths.**

---

## Phase 5 — v0.4 knowledge grounding + GTM vault (Phase 2)

**Entry gate:** v0.3 MVP live + the ingesting tenant's compliance lane controls in force (isolation, source ownership, audit, retention, PII minimization, deletion/export, approved-source, human review — per `../ROADMAP.md`).
**Owner:** core/AI.
**Work:** per-tenant client knowledge ingestion + agent grounding; GTM “Business Memory vault” / Obsidian-compatible narrative memory productization; retrieval substrate chosen at v0.4 (no vector store committed before then). **Out of founding-pilot go-live.**
**Exit gates:** grounded answers auditable + tied to the ledger; gates above demonstrably enforced; no regression in isolation/audit/retention.

---

## Phase 6 — v0.5 billing / outcome-fee ledger (Phase 2)

**Entry gate:** v0.3 live + ≥1 production pilot (ADR-0010).
**Owner:** core/finance.
**Work:** pricing engine; Stripe billing (Payment Intents, hosted pages, signed webhook ingest); outcome-fee ledger; invoices with ledger-backed evidence; in-app tier selectors.
**Exit gates:** outcome-fee invoices reconcile to ledger evidence; Stripe webhooks signature-validated; no card data stored.

---

## Phase 7 — v1.0 client-ready + white-label (Future)

**Entry gate:** Phases 5–6 exit met.
**Owner:** product.
**Work:** full white-label (custom domains, partner branding, tenant RBAC for branding); onboarding complete; all surfaces production-grade; BYO-provider groundwork.
**Exit gates:** a white-label tenant onboarded end-to-end; production-grade across surfaces.

---

## Cross-phase discipline

| Discipline | Applies |
|---|---|
| Mock-first; adapters fall back to mock | every phase until live keys per provider verified |
| Tenant isolation tested | every phase that adds a tenant-scoped table/route |
| Signature validation before mutation | every webhook added |
| Event-ledger-first | every write path |
| No premature microservices | gateway/Redis deferred; do not split services for the first founding-pilot slice |
| Scope discipline | no abstractions beyond the phase's need |
| Docs hygiene | new decision → ADR; new milestone → roadmap; merged PR → CHANGELOG line |

---

## Implementation sequencing (one-line view)

`v0.2 closeout` → `CAL mocks (Stage A auth)` → `schema/env placeholders` → `hosted staging (Path A)` → `live Telnyx/Vapi/Twilio/HubSpot/Calendly on staging (Path B)` → `provisioning + ROI report (founding pilot prod)` → `v0.4 knowledge/vault` → `v0.5 billing` → `v1.0 white-label OS`.

---

## Assumptions & open questions

**Assumptions:** staged written auths per [`responseos-v0.3-founding-pilot-scope.md`](./responseos-v0.3-founding-pilot-scope.md) §5; provider-readiness gate is achievable; pilot is home-services Standard lane.
**Open questions:** first pilot client identity; production secret store (Vercel vs Doppler); whether readiness testing forces un-deferring gateway/Redis; whether a pilot demands billing before v0.5.

---

*ResponseOS Phase Plan — AJ Digital LLC / Audio Jones. Documentation phase only.*
