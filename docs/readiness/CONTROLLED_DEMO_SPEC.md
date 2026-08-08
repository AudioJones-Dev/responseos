# Controlled Demo — status and minimum spec

**Verdict: `NOT PRESENT`.**

---

## 1. Why NOT PRESENT

The target demo is: *"Call this number and pretend you need service"* → the prospect calls → the
system visibly converts that conversation into intelligence, memory, a decision, and an executed action.

**Every stage of that chain is unimplemented.**

| Stage | Required | Repository evidence | Status |
|---|---|---|---|
| Demo phone number | Telnyx number routed to a demo tenant | no Telnyx adapter, enum, env, or route | **MISSING** |
| Telnyx → Vapi transport | carrier adapter | `lib/providers/telnyx/` does not exist | **MISSING** |
| Vapi agent handles call | agent runtime adapter | `lib/providers/vapi/` empty | **MISSING** |
| Vapi → ResponseOS ingestion | webhook that persists | `webhooks/vapi/call-ended/route.ts` is a 7-line ack-and-discard stub | **SCAFFOLDED** |
| Call/transcript persistence | write path from webhook | models + accessors exist; **nothing writes them from a call** | **PARTIAL** |
| Extraction → structured fields | LLM extraction pipeline | no extraction code repo-wide | **MISSING** |
| Business-memory write | memory model + write | no model, no code | **MISSING** |
| Decision / next action | policy engine | no model, no code | **MISSING** |
| Action execution | sandbox adapters | `lib/automations/` = `.gitkeep` | **MISSING** |
| Lifecycle visualization | live UI | demo pages are static, **zero DB access** | **SCAFFOLDED** |
| Demo reset | reset tooling | none found | **MISSING** |

What exists today is a **storyboard**: 6 walkthrough pages rendering a 171-line hardcoded scenario
(`app/(demo)/_data/scenario.ts`, header comment: *"no provider calls, no DB"*). It is well-built and
honest about being a mock — but a prospect cannot call it, and nothing they did would appear in it.

## 2. Extraction field coverage

Of the target extraction schema, **zero fields are produced by any pipeline** (none exists).
Storage-adjacency is the only partial credit available:

| Field | Storage today | Pipeline |
|---|---|---|
| `caller`, `phone`, `email`, `company` | `Contact` model | **MISSING** |
| `intent`, `service_requested` | — | **MISSING** |
| `urgency` | `LeadUrgency` enum | **MISSING** |
| `qualification_status` | `QualificationStatus` enum, `LeadQualification` model | **MISSING** |
| `appointment_intent` | `Appointment` model | **MISSING** |
| `quote_intent` | `QuoteRequest` model | **MISSING** |
| `sentiment` | `CallSentiment` enum | **MISSING** |
| `location`, `budget_or_value_signal`, `objections`, `commitments`, `questions`, `risks`, `confidence`, `recommended_next_action` | — | **MISSING** |

**Useful consequence:** roughly half the target fields already have a typed home in the schema. The
work is the pipeline that fills them, not a schema redesign.

## 3. Controlled-environment isolation

| Requirement | Status |
|---|---|
| demo tenant | **MISSING** (seed has fixtures; no dedicated isolated demo tenant) |
| sandbox database | **PARTIAL** — Neon staging is planned in PR #110, `UNVERIFIED` externally |
| demo phone number | **MISSING** |
| demo Vapi agent | **MISSING** |
| demo Telnyx config | **MISSING** |
| mock CRM / calendar / quoting / payment | **MISSING** — all provider dirs empty |

Nothing can currently produce an external side effect, because no adapter can reach an external
system. **The demo is safe today by absence, not by design.** That flips the moment a live adapter
lands — sandbox routing must exist *before* the first live provider, not after.

---

## 4. DEMO MVP — the minimum convincing version

Deliberately smaller than the product. The goal is to make one call visibly become intelligence,
memory, a decision, and an action.

### Required components
- Telnyx carrier adapter (inbound only — no outbound, no SMS in v1 of the demo)
- Vapi agent adapter + one scripted assistant configuration
- Telnyx inbound webhook + Vapi `call-ended` webhook, both with signature validation
- Call/segment/transcript persistence from the webhook payload
- Extraction pipeline producing the schema in §2
- `Memory` + `Decision` + `Task` models with provenance FKs
- Rule-based next-action selector (**not** an LLM agent — deterministic and explainable)
- Sandbox action adapters: create lead, create task, notify operator, draft follow-up SMS

### Required integrations
Telnyx (inbound), Vapi (agent + webhook), one LLM for extraction. **No CRM, no calendar, no
payments** in the demo MVP — those are sandbox-mocked.

### Required UI
One page: **Call Lifecycle**. Left-to-right or top-down —
`Call → Transcript → Extracted → Memory changes → Decision (+ rule cited) → Action → Result`,
with every node linking back to its source. This single view *is* the demo.

### Required fixtures / demo data
One demo tenant, a seeded business profile (home-services vertical), and a clean baseline the reset
tool restores.

### Required scripts
`seed:demo` and `reset:demo` — reset must clear generated leads/tasks/appointments/memory and restore
fixtures without touching any other tenant.

### Required tests
Webhook signature rejection; extraction snapshot on a fixed transcript; provenance integrity
(every action resolves to a call); tenant isolation on all new write paths; demo-reset idempotency.

### Required observability
Error tracking + a failure log visible in the control plane. A demo that fails silently in front of
a prospect is worse than no demo.

### Required salesperson workflow
Open control plane (clean) → give the number → prospect calls → lifecycle populates → walk the
provenance chain → show ROI framing → hit reset.

---

## 5. Required scenarios

| Scenario | Expected chain | Additional work beyond MVP |
|---|---|---|
| **A — High-intent lead** | qualified lead → appointment offered → follow-up created → operator notified | none (this is the MVP path) |
| **B — Quote request** | requirements extracted → quote request created → missing info identified → follow-up started | quote-request action + missing-field logic |
| **C — Human escalation** | risk/value recognized → escalation created → context packet delivered | escalation rule + context-packet renderer |

A fourth scenario is **not** recommended until A–C are stable — the marginal GTM value is low
relative to the extraction-tuning cost each new scenario imposes.

---

## 6. Sales demo runbook (5–10 min, proposed)

1. **Clean state** (30s) — control plane, demo tenant, no leads/tasks. Establishes the before.
2. **Hand over the number** (15s) — *"Call this and pretend your stair lift stopped working."*
3. **Prospect calls** (90s) — Vapi handles it. Salesperson says nothing; the silence is the point.
4. **Call completes** (10s) — row appears: caller, duration, disposition.
5. **Transcript** (30s) — verbatim, timestamped.
6. **Extracted intelligence** (60s) — the structured card. *"It didn't record a call. It understood one."*
7. **Memory changes** (60s) — contact created, lead created, service request logged, timeline updated.
8. **Decision** (45s) — next action + **the rule that selected it**. Explainable, not a black box.
9. **Action executes** (30s) — sandbox: task created, operator notified, follow-up drafted.
10. **Result** (30s) — the created objects.
11. **Provenance** (45s) — click the task → back to the decision → memory → extraction → transcript line.
    *This is the moment that closes deals.* Nobody else shows the chain.
12. **ROI framing** (45s) — one missed call ≈ one job ≈ $X; this ran without a human.
13. **Reset** (10s) — prove repeatability.

**Design principle:** the demo must be narratable without a single technical term. Steps 8 and 11 are
the differentiators — transcription is a commodity; *decision with provenance* is not.
