# ResponseOS — QA & Validation Plan

**Owner:** AJ Digital LLC / Audio Jones
**Status:** Canonical (go-forward).
**Read first:** [`../product/RESPONSEOS_PHASE_PLAN.md`](../product/RESPONSEOS_PHASE_PLAN.md) · [`../architecture/RESPONSEOS_BACKEND_SPEC.md`](../architecture/RESPONSEOS_BACKEND_SPEC.md) § 12

> Two layers of quality: **code correctness** (type checks, tests, CI gates) and **conversation/feature correctness** (golden-call regression, QA scoring, the provider-readiness gate). Type checks and tests verify code, not feature behavior — voice features are validated by running real conversations, not by assuming success.

---

## 1. Validation gates (must pass locally + in CI before merge)

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration   # needs Postgres 16
```

CI runs **`validate`** (lint + typecheck + unit test + build) and **`integration`** (Postgres 16 service, `prisma migrate diff`, `prisma migrate deploy`, `prisma db seed`, integration tests, DB-backed build). Both must be green. (Inherited from `AGENTS.md` / `README.md`.)

---

## 2. Test pyramid

| Layer | Scope | Tooling |
|---|---|---|
| Unit | scoring, ROI math, adapters (mock), policy engine, tool router, envelope/validation | Vitest |
| Integration | data layer + tenant isolation; webhook ingest + signature + dedupe; CRM mapping; normalization; DB-backed build | Vitest + Postgres 16 |
| Contract | gateway↔core internal API; provider adapter interface conformance (against mocks) | Vitest |
| Realtime/feature | live conversation behavior via the gateway (staging) | golden-call harness |
| E2E (UI) | console + portal flows; onboarding; integrations connect | Playwright/Cypress (target) |

---

## 3. Mandatory test categories

| Category | What it asserts |
|---|---|
| **Tenant isolation** | Every tenant-scoped route/table: no cross-tenant read/write; `account_id` from session only; mismatch → `403 TENANT_SCOPE_DENIED` |
| **Signature validation** | Each webhook (Twilio, Grok, OpenAI, HubSpot, n8n, Stripe): invalid sig → 401, no parse, no mutation; valid sig → ledger write |
| **Idempotency / dedupe** | Replayed webhook = no-op; same `Idempotency-Key` + diff body → 409; same `workflowRunId` = replay |
| **Event-ledger discipline** | No business mutation precedes its ledger write; facts recompute from ledger |
| **Provider abstraction** | Grok/OpenAI/mock all satisfy the `VoiceProvider` interface; no business logic in adapters |
| **Failover** | Grok→OpenAI mid-session resume carries Redis context; emits `voice.provider_failover` |
| **Lane/redaction** | Retention/redaction applied before persistence; raw vs redacted in separate paths |
| **RBAC** | Role gates enforced server-side; break-glass logged + notified |

---

## 4. Provider-readiness gate (v0.3, before live traffic)

Grok Voice + OpenAI Realtime must each pass before any live tenant call (ADR-0012, Backend Spec §12). Owned by backend/voice; results documented and reviewed.

| Criterion | Pass condition | Method |
|---|---|---|
| Telephony path | Twilio Media Streams ↔ provider end-to-end | staging call |
| Barge-in / turn-taking | natural interruption at target latency | golden calls |
| Latency | turn latency within budget; handoff < 3s | load probe |
| Concurrency | sustains target concurrent sessions | load test |
| Webhook reliability | lifecycle/tool/transcript events delivered + validatable | integration test |
| Tool calling | tool round-trip under load | golden calls |
| Failover | Grok→OpenAI mid-session resume | failover drill |
| Transcript/recording | storage + redaction per lane | inspection |
| Escalation/handoff | warm transfer + async task | golden calls |
| Compliance posture | retention + training-data reviewed; regulated lanes blocked | security review |

Until the gate passes, the gateway runs on the **mock** adapter.

---

## 5. Golden-call regression pack

A curated set of representative + edge-case conversations, run before **every** prompt/policy/profile release and before voice-provider changes.

| Golden case | Validates |
|---|---|
| Routine HVAC inbound, qualifies + self-schedules | happy path Respond→Verify |
| After-hours roofing leak (high urgency) | urgency scoring + booking |
| High-value job ($X+) | escalation/warm-transfer trigger |
| Explicit "talk to a human" | escalation tool |
| Spam / robocall | spam handling, no lead created |
| Price-pressure ("just give me a number") | policy ceiling, no hallucinated price |
| Missed call → text-back → SMS qualification | provider-independent recovery |
| Provider failover mid-call | conversation coherence after switch |
| Out-of-service-area caller | service_area_match=false, decline path |
| Consent decline (no recording) | disclosure + consent handling |

Each release compares outcomes against the prior profile version (QA drift). Regressions block the release.

---

## 6. QA scoring (`qa_logs`)

- Weekly: audit 20–30 sampled calls per tenant; escalations sampled at a higher rate.
- Rubric (versioned): disclosure given; correct qualification; no hallucinated pricing/policy; correct routing/escalation; booking accuracy; tone/brand-voice adherence.
- Findings logged to `qa_logs` (rubric version, findings, reviewer type); drift tracked by profile version.

---

## 7. Acceptance criteria conventions (for stories)

Every backlog story (see [`../product/RESPONSEOS_BACKLOG.md`](../product/RESPONSEOS_BACKLOG.md)) carries acceptance criteria + the Definition of Done. Voice/feature stories additionally require golden-call validation, not just unit/integration green.

---

## 8. Pre-release checklist (per milestone)

- [ ] CI `validate` + `integration` green.
- [ ] Tenant-isolation + signature-validation tests cover new paths.
- [ ] Golden-call pack green (no QA-drift regressions).
- [ ] Provider-readiness gate passed (v0.3 / provider changes).
- [ ] Mock fallback preserved for any provider without verified live keys.
- [ ] Rollback path verified (profile revert + deploy rollback).
- [ ] Docs updated (ADR/roadmap/CHANGELOG).
- [ ] No secrets in diff; no Firebase.

---

## 9. Non-negotiables

- **Don't claim a voice feature works without running it.** If you can't run the conversation, say so explicitly.
- **Never disable a safety check to pass a gate.** Fix the root cause.
- **Deterministic tests.** Mocks return deterministic fixtures; seed is byte-deterministic.

---

## 10. Assumptions & open questions

**Assumptions:** staging supports live provider calls behind verified keys; golden-call harness can drive the gateway; Playwright/Cypress E2E lands by v1.0.
**Open questions:** (1) golden-call harness build vs vendor tooling; (2) concurrency targets for the load test; (3) automated QA scoring (LLM-assisted) vs human-only for MVP.

---

*ResponseOS QA & Validation Plan — AJ Digital LLC / Audio Jones. Documentation phase only.*
