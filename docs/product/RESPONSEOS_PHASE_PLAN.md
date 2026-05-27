# ResponseOS — Phase Plan

**Owner:** AJ Digital LLC / Audio Jones
**Status:** Canonical (go-forward). Implementation sequencing with entry/exit gates so phases can be built without guessing.
**Read first:** [`RESPONSEOS_ROADMAP.md`](./RESPONSEOS_ROADMAP.md) · [`RESPONSEOS_BUILD_SOURCE.md`](./RESPONSEOS_BUILD_SOURCE.md)

> Each phase has **entry gates** (must be true to start), **work**, **exit gates** (must be true to finish), and **owner**. No phase starts before its predecessor's exit gates pass. The validation gates referenced throughout are: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:integration` (Postgres 16) — both CI jobs (`validate` + `integration`) green.

---

## Phase 0 — Foundation (DONE)

**Status:** ✅ v0.1 + v0.2 A–D shipped.
**Delivered:** Next.js App Router scaffold; 11 typed models; mock adapters; Postgres schema + deterministic seed; tenant-aware data layer (`organization_id` from session); integration tests + Postgres-backed CI; webhook event-ledger foundation; audit-log foundation.
**Exit gate (met):** CI green; tenant scoping enforced at the data layer; app boots without secrets.

---

## Phase 1 — v0.2 closeout (IN FLIGHT)

**Entry gate:** Phase 0 exit met.
**Owner:** core/platform.
**Work:**
1. `Organization` → `Account` rename (migration + types + data layer).
2. Real auth provider wiring (session → `organization_id` + role).
3. UI rebuild against [`../DESIGN.md`](../DESIGN.md) tokens.
4. Remaining model expansion: `provider_connections`, `conversations`/`sms_messages`, `call_segments`/`call_transcripts`, `workflow_runs`, `qa_logs`, `audit_logs`.
5. Add go-forward tables forward-compatibly: `call_sessions`, `tool_calls`, profile tables (`routing_/prompt_/policy_/workflow_profiles`), `crm_mappings` (see [`../architecture/RESPONSEOS_DATA_MODEL.md`](../architecture/RESPONSEOS_DATA_MODEL.md) § 4).

**Exit gates:**
- [ ] Rename complete; no `Organization` references in code/docs that should be `Account`.
- [ ] Auth wired; role-aware sessions for all four roles.
- [ ] UI on `../DESIGN.md` tokens; empty/loading/error states present.
- [ ] New tables migrated + seeded; integration tests assert tenant isolation on each.
- [ ] CI `validate` + `integration` green. No live providers. No deploy.

---

## Phase 2 — v0.3 voice gateway + provider abstraction (MVP live, part A)

**Entry gate:** Phase 1 exit met; v0.3 explicitly authorized.
**Owner:** backend/voice.
**Work:**
1. Stand up the **Node.js voice gateway** as a separate deployable (Backend Spec §1).
2. Implement the `VoiceProvider` interface + **mock adapter** (still no live keys).
3. Implement **Grok** + **OpenAI Realtime** adapters behind the interface.
4. Session lifecycle + Redis ephemeral state (ADR-0014).
5. Failover controller (Grok→OpenAI), `voice.provider_failover` events.
6. Policy engine + tool router + internal gateway↔core API (API Contracts §4).
7. Twilio Media Streams handler.

**Exit gates:**
- [ ] **Provider-readiness gate passed** for Grok + OpenAI (Backend Spec §12): telephony path, barge-in, latency, concurrency, webhook reliability, tool calling, failover, transcript handling, escalation, compliance posture reviewed.
- [ ] Gateway runs on mock with zero keys; live providers gated behind verified keys.
- [ ] Failover verified mid-session in staging.
- [ ] All gateway outputs land in the ledger; no business mutation bypasses signature validation.
- [ ] CI green; gateway has its own tests + SLOs defined.

---

## Phase 3 — v0.3 live integrations + RECOVER playbooks (MVP live, part B)

**Entry gate:** Phase 2 exit met.
**Owner:** core + integrations.
**Work:**
1. Live Twilio (numbers per tenant via routing profile; signature validation; persistence).
2. **HubSpot** connector (OAuth, contact/deal/ticket mirroring, `crm_mappings`, signed webhooks) — default CRM SoR (ADR-0015).
3. Calendar connector (Google `freeBusy` / Cal.com).
4. Post-call normalization pipeline (lane-aware redaction → canonical objects → CRM mirror → ROI).
5. n8n async flows for the 7 RECOVER playbooks (`workflow_runs`, idempotent).
6. Notifications (SMS/email/in-app/slack) via adapters.
7. Resend email for reports.

**Exit gates:**
- [ ] All 7 RECOVER playbooks run end-to-end live on the Standard lane.
- [ ] HubSpot bi-directional sync verified; conflict handling exercised.
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
5. Monthly ROI report (portal page + PDF + email); outcome-fee **preview**.
6. Basic white-label (theme vars, wildcard subdomain).

**Exit gates:**
- [ ] A new tenant can be provisioned + onboarded with **no code change**.
- [ ] ≥1 pilot client live on the Standard lane producing a defensible monthly ROI report.
- [ ] Zero cross-tenant data-exposure incidents (verified by isolation tests + review).
- [ ] Break-glass logged + tenant-notified; audit logs populated.
- [ ] CI green. **Production deploy authorized only after these gates.**

---

## Phase 5 — v0.4 knowledge grounding (Phase 2)

**Entry gate:** v0.3 MVP live + the ingesting tenant's compliance lane controls in force (isolation, source ownership, audit, retention, PII minimization, deletion/export, approved-source, human review — per `../ROADMAP.md`).
**Owner:** core/AI.
**Work:** per-tenant client knowledge ingestion + agent grounding; retrieval substrate chosen at v0.4 (no vector store committed before then).
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
| No premature microservices | only the voice gateway is split |
| Scope discipline | no abstractions beyond the phase's need |
| Docs hygiene | new decision → ADR; new milestone → roadmap; merged PR → CHANGELOG line |

---

## Implementation sequencing (one-line view)

`v0.2 closeout` → `gateway + provider abstraction (mock→Grok/OpenAI, readiness gate)` → `live Twilio + HubSpot + calendar + playbooks` → `provisioning + reporting + basic white-label (pilot live)` → `v0.4 knowledge` → `v0.5 billing` → `v1.0 white-label OS`.

---

## Assumptions & open questions

**Assumptions:** v0.3 is authorized after Phase 1; provider-readiness gate is achievable; pilot sourced from AJ Digital's book.
**Open questions:** gateway hosting target; whether v0.4 or v0.5 goes first if a pilot demands billing; concurrency-ceiling defaults.

---

*ResponseOS Phase Plan — AJ Digital LLC / Audio Jones. Documentation phase only.*
