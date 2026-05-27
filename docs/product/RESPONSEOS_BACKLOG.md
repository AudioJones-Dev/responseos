# ResponseOS — Backlog

**Owner:** AJ Digital LLC / Audio Jones
**Status:** Canonical (go-forward). Epics → stories → acceptance criteria, mapped to the phases in [`RESPONSEOS_PHASE_PLAN.md`](./RESPONSEOS_PHASE_PLAN.md).
**Read first:** [`RESPONSEOS_PHASE_PLAN.md`](./RESPONSEOS_PHASE_PLAN.md) · [`RESPONSEOS_BUILD_SOURCE.md`](./RESPONSEOS_BUILD_SOURCE.md)

> This is a planning backlog, not a tracker. IDs are stable references for PRs/issues. Acceptance criteria are written so an implementer (human or Codex) can build + verify without guessing. Every story inherits the global definition of done (§ Definition of Done).

---

## Epic E1 — v0.2 closeout (Phase 1)

| ID | Story | Acceptance criteria |
|---|---|---|
| E1-S1 | `Organization` → `Account` rename | Migration applied; types + `lib/data/*` updated; no stale `Organization` refs; CI green |
| E1-S2 | Real auth provider wiring | Session resolves `organization_id` + role for all four roles; client never supplies `organization_id`; `403 TENANT_SCOPE_DENIED` on mismatch |
| E1-S3 | UI rebuild vs `../DESIGN.md` tokens | Dark-first tokens applied; empty/loading/error states on every major page; accessibility checks pass |
| E1-S4 | Model expansion (v0.2 remaining) | `provider_connections`, `conversations`, `sms_messages`, `call_segments`, `call_transcripts`, `workflow_runs`, `qa_logs`, `audit_logs` migrated + seeded; isolation tests per table |
| E1-S5 | Go-forward tables | `call_sessions`, `tool_calls`, profile tables, `crm_mappings` added forward-compatibly (Data Model § 4); seeded; tested |

---

## Epic E2 — Voice gateway + provider abstraction (Phase 2)

| ID | Story | Acceptance criteria |
|---|---|---|
| E2-S1 | Gateway service skeleton | Node.js service deployable separately; health endpoint; boots with zero keys (mock) |
| E2-S2 | `VoiceProvider` interface + mock adapter | Interface per Backend Spec §4; mock returns deterministic fixtures; unit-tested |
| E2-S3 | Grok adapter | Implements interface; translates payloads → canonical events; no business logic in adapter |
| E2-S4 | OpenAI Realtime adapter | Implements interface; same canonical mapping |
| E2-S5 | Session lifecycle + Redis state | States per Backend Spec §3; Redis keyed `org:<id>:sess:<id>` with TTL; Redis loss degrades in-flight only |
| E2-S6 | Failover controller | Grok→OpenAI mid-session resume carries Redis context; emits `voice.provider_failover`; increments `failover_count` |
| E2-S7 | Policy engine | Loads versioned policy profile; enforces allowed tools/escalation/ceilings; breach → escalate + log |
| E2-S8 | Tool router + internal API | `/internal/tools/:name`; each call emits `tool.invoked`/`tool.result`; idempotent mutations |
| E2-S9 | Twilio Media Streams handler | Per-call socket; resolves tenant via routing profile; spam check |
| E2-S10 | Provider-readiness gate | All criteria in Backend Spec §12 pass before any live traffic; documented results |

---

## Epic E3 — Live integrations (Phase 3)

| ID | Story | Acceptance criteria |
|---|---|---|
| E3-S1 | Live Twilio | Per-tenant numbers via routing profile; `X-Twilio-Signature` validated; dedupe by `CallSid`/`MessageSid`; persisted |
| E3-S2 | HubSpot connector | OAuth connect/callback; contact/deal/ticket mirror; `crm_mappings`; signed webhooks land in ledger first; conflict state surfaced |
| E3-S3 | Calendar connector | Google `freeBusy`/Cal.com availability; booking sync captures `external_event_id` |
| E3-S4 | Post-call normalizer | Lane-aware redaction before persistence; raw/redacted separate paths; canonical objects written; replayable |
| E3-S5 | n8n playbooks (7) | Each RECOVER playbook runs live; `workflow_runs` logged; idempotent by `workflowRunId`; never in audio loop |
| E3-S6 | Notifications | SMS/email/in-app/slack via adapters; statuses tracked; consent-gated |
| E3-S7 | Resend report email | Monthly report email to `client_admin`; no PHI in subject/body |

---

## Epic E4 — Provisioning, reporting, white-label basics (Phase 4)

| ID | Story | Acceptance criteria |
|---|---|---|
| E4-S1 | Tenant provisioning wizard | New tenant + profiles created data-only; **no code change**; profiles versioned |
| E4-S2 | Onboarding / Readiness Assessment | 10-input flow; save-and-resume; produces Readiness packet (Score, Leak Estimate, Fit/No-Fit, maps, scope, projected ROI, Pricing Proposal) |
| E4-S3 | Integrations connect UI | Status per provider; OAuth flows; "test connection"; no secrets shown |
| E4-S4 | Transcript/QA review UI | Redacted default; raw only via logged, time-boxed, tenant-notified break-glass; `qa_logs` capture |
| E4-S5 | Monthly ROI report | Portal page + PDF + email; the 9 KPIs; outcome-fee **preview** only |
| E4-S6 | Basic white-label | Theme vars + wildcard subdomain; reuses same components/APIs |
| E4-S7 | Pilot go-live | ≥1 pilot live on Standard lane; defensible ROI report; zero cross-tenant incidents |

---

## Epic E5 — Knowledge grounding (Phase 5 / v0.4 — Phase 2)

| ID | Story | Acceptance criteria |
|---|---|---|
| E5-S1 | Knowledge gates verification | Tenant lane controls in force (isolation, source ownership, audit, retention, PII min, deletion/export, approved-source, human review) before any ingestion |
| E5-S2 | Per-tenant grounding | Grounded answers tied to the ledger + auditable; retrieval substrate chosen at v0.4 |

> No vector store, embeddings, or upload pipeline committed before v0.4 picks a strategy.

---

## Epic E6 — Billing / outcome-fee ledger (Phase 6 / v0.5 — Phase 2)

| ID | Story | Acceptance criteria |
|---|---|---|
| E6-S1 | Pricing engine | Tier config drives feature gating; data-only per tenant |
| E6-S2 | Stripe billing | Payment Intents + hosted pages; signed webhook ingest; **no card data stored** |
| E6-S3 | Outcome-fee ledger + invoices | Fees on **verified** outcomes only; invoices carry ledger-backed evidence links; reconcile to ledger |

---

## Epic E7 — White-label OS (Phase 7 / v1.0 — Future)

| ID | Story | Acceptance criteria |
|---|---|---|
| E7-S1 | Full white-label | Custom domains; partner branding; tenant RBAC for branding |
| E7-S2 | BYO-provider groundwork | BYO Twilio / LLM keys via `provider_connections`; no provider-specific business logic introduced |

---

## Cross-cutting epic E8 — Platform quality (all phases)

| ID | Story | Acceptance criteria |
|---|---|---|
| E8-S1 | Tenant isolation tests | Every tenant-scoped route/table asserts no cross-tenant read/write |
| E8-S2 | Observability wiring | OTel → PostHog/Sentry/Better Stack; tagged `organization_id`, no raw PII; realtime signals (concurrency, failover, latency) |
| E8-S3 | Security gates | Signature validation tests per provider; secrets only in env/DB-encrypted; RBAC enforced server-side |
| E8-S4 | Golden-call regression | Regression pack runs before each prompt/profile release (QA plan) |
| E8-S5 | Docs hygiene | New decision → ADR; milestone → roadmap; merged PR → CHANGELOG line |

---

## Definition of Done (every story)

- [ ] Code + tests; `npm run lint`, `typecheck`, `test`, `build`, `test:integration` all pass; CI `validate` + `integration` green.
- [ ] Tenant scoping enforced at the data layer (where applicable).
- [ ] Mock fallback preserved until the provider's live keys are verified.
- [ ] No secrets in the repo; no Firebase.
- [ ] Docs updated (ADR/roadmap/CHANGELOG as applicable).
- [ ] PR opened as **draft** until CI green, then ready for human merge (per `AGENTS.md`).

---

## Prioritization notes

- **Now:** E1 (closeout) → unblocks everything.
- **Next (on v0.3 authorization):** E2 → E3 → E4 in order; E8 runs alongside.
- **Later:** E5/E6 (Phase 2), then E7 (Future).
- **Deferred:** HIPAA-lane productionization, bidirectional QuoteIQ, mobile.

---

*ResponseOS Backlog — AJ Digital LLC / Audio Jones. Documentation phase only.*
