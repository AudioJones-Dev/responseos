# PRD — ResponseOS

**Owner:** AJ Digital LLC / Audio Jones
**Status:** Living document. Updated each minor version.
**Companion docs:** [`strategy/responseos-platform-doctrine-v1.md`](./strategy/responseos-platform-doctrine-v1.md) (**platform doctrine** — product boundary, layered architecture, build-vs-buy, claims policy), [`product-spec.md`](./product-spec.md) (full positioning + framework detail), [`client-facing-offer.md`](./client-facing-offer.md) (buyer-facing summary), [`ROADMAP.md`](./ROADMAP.md) (what ships when), [`product/RESPONSEOS_PRD.md`](./product/RESPONSEOS_PRD.md) (expanded product definition).

> **Positioning note.** "AI Revenue Recovery Platform" and "Managed Business Memory System" are adjacent stages of one progression, not competing brands: *business memory is the mechanism; recovered revenue is the proof; founder intelligence is the destination.* The buyer enters through revenue recovery (primary CTA "Revenue Recovery Demo", ADR-0035); the public pricing model is capacity-based memory tiers (ADR-0028). See ADR-0022 and the doctrine §4.1. What ResponseOS is **not** — CRM, FSM, carrier, voice-model provider, generic automation builder — is enumerated in the doctrine §5.2 and ADR-0040.

> This PRD is the short operational product source of truth for what ResponseOS is, who it's for, and what the current scope is. `product/RESPONSEOS_PRD.md` is the expanded product-definition companion. If the two conflict, this short PRD, `ROADMAP.md`, and `DECISIONS.md` win until the documentation governance canonicalization pass is approved.

## What it is

**ResponseOS is the Business Memory system that delivers Revenue Recovery.** It captures calls, notes, decisions, and follow-up into structured operational memory, then uses that memory to qualify and route leads, automate follow-up, book opportunities, and prove recovered revenue.

It is **not** an AI receptionist clone. The receptionist is one input. ResponseOS is the recovery layer that sits on top of every demand signal — phone, SMS, web form, AI-answered call, outbound campaign — and makes sure none of it leaks.

## Positioning

> "ResponseOS turns scattered service-business activity into Business Memory — so missed demand becomes booked revenue you can prove."

**Public wedge (ADR-0022 / ADR-0046):** Business Memory is the *system*; Revenue Recovery is the *outcome*. Primary CTA: **Revenue Recovery Demo** (ADR-0035).

## Target user

- Service businesses with phone-driven demand: home services (HVAC, roofing, plumbing, electrical), med spas, contractors.
- Owner / operator or office manager who feels the pain of missed calls but does not want to hire a 24/7 receptionist.
- Currently using a CRM (often GoHighLevel or HubSpot) plus disconnected tools (a VoIP, a calendar, a quoting doc, a follow-up Google Sheet).

## Two surfaces

| Surface | Audience | Current state |
|---|---|---|
| **Operator Console** — `app/(admin)/` | AJ Digital staff | v0.1 mock + v0.2 DB-backed; cross-tenant read/write |
| **Client Portal** — `app/(client)/` | Per-tenant `client_admin` / `client_viewer` | v0.1 mock + v0.2 DB-backed; tenant-scoped reads |
| **Marketing site** — `app/(marketing)/` | Public | Static landing surface |

## Commercial motion

Sold in two phases (public quote sheet = **Recovery** tiers per ADR-0046; Memory capacity tiers stay planning-only until billing v0.5):

1. **Phase 1 — Readiness & Revenue Leak Assessment.** $1,000 flat ($750–$1,500 range). Paid diagnostic that determines AI-readiness, revenue leak size, and fit/no-fit before any implementation conversation.
2. **Phase 2 — Implementation + Monthly Revenue Recovery Retainer.** Setup fee + monthly retainer in one of three tiers (Recovery Core / Recovery Pro / Recovery Performance), with optional outcome fees layered on top. First 1–3 pilots may invoice **manually** (Stripe Dashboard) until the v0.5 money rail.

Qualification gates before Phase 2: ~$300+ average job value, ~20+ missed calls/month, clear booking or quote process, owner/staff buy-in, CRM/calendar access, low compliance risk, measurable ROI path. Full detail in [`pricing-and-onboarding.md`](./pricing-and-onboarding.md).

## RECOVER framework (canonical operator mapping)

| Stage | Operator meaning | Business outcome |
|---|---|---|
| **Respond** | Answer every inbound call or text immediately | Fewer missed opportunities |
| **Evaluate** | Qualify service type, geography, urgency, budget, intent | Better lead quality |
| **Capture** | Normalize customer, job, transcript, attribution data | Reliable CRM and reporting |
| **Offer** | Present estimate, financing, self-scheduling, callback path | Faster conversion |
| **Verify** | Confirm appointment, consent, payment intent, routing | Lower no-shows, fewer errors |
| **Escalate** | Hand off edge cases, high-value jobs, compliance-sensitive calls | Better customer trust |
| **Report** | Prove recovered leads, booked jobs, revenue by tenant and source | Outcome-based pricing |

Buyer-facing version of the same 7 stages: Revenue Leak Detection · Engagement Automation · Call Capture System · Outcome-Based Booking · Verification + Qualification · Economic ROI Tracking · Reporting + Retention.

## Current scope (v0.2 shipped; v0.3 gated)

Shipped foundation:

- Postgres-backed data layer with deterministic seed.
- Tenant-aware data access (`aj_admin` / `operator` / `client_admin` / `client_viewer`).
- Client portal reads routed through the v0.2 data layer.
- Integration test suite + CI integration job against Postgres 16.
- Webhook event ledger foundation (raw body, signature header, signature_valid flag, dedupe hash).
- Audit-log foundation.
- `Organization` → `Account` rename.
- `Booking` → `Appointment` rename.
- Clerk auth wiring and route protection.
- Provider connection, conversation/SMS, call intelligence, workflow-run, QA, and expanded audit-log substrate.
- Mock provider adapters preserved.

Explicitly out:

- Live provider integrations → **v0.3 Gate Set B**, now specified by the **communications stack** decision ([`product/responseos-communications-stack.md`](./product/responseos-communications-stack.md)): Telnyx + Vapi primary, Twilio failover, HubSpot default commercial system of record, behind a Communications Abstraction Layer; includes a Phase-1 Business Memory capture baseline.
- Billing engine + Stripe + outcome-fee ledger → v0.5.
- Knowledge layer → v0.4+.
- Live-provider production deploys → Gate Set B ([`ops/RESPONSEOS_V0_3_READINESS_GATES.md`](./ops/RESPONSEOS_V0_3_READINESS_GATES.md)). Mock-safe demo deploys → Gate Set A (ADR-0046).

See [`ROADMAP.md`](./ROADMAP.md) for the full version table and milestone status.

## Communications stack (v0.3 direction)

Per the CTO communications decision ([`product/responseos-communications-stack.md`](./product/responseos-communications-stack.md)):

- **Communications Abstraction Layer (requirement).** Carrier, SMS, AI-voice, messaging, webhook, and usage-metering providers sit behind internal interfaces (`CarrierProvider`, `SmsProvider`, `VoiceAgentProvider`, `MessagingChannelProvider`, `WebhookEventAdapter`, `UsageMeteringAdapter`) so Telnyx / Twilio / Vapi / Retell / Sendblue are swappable or routable **without client-facing change**. This abstraction is the platform's primary infrastructure moat. *Document only — not implemented.*
- **Default providers:** **Telnyx** (carrier / A2P SMS) + **Vapi** (AI receptionist) primary; **Twilio** failover; **Retell** + **Sendblue** Phase 2. ResponseOS is not a Twilio-only or GHL-only platform.
- **HubSpot is the default commercial system of record** (client-overridable to GHL / Salesforce); the ResponseOS event ledger remains the **internal** SoR. GHL is a supported connector, not core infrastructure — **no GHL LC Phone dependency**.
- **Phase-1 Business Memory capture.** Every AI receptionist interaction is captured as structured memory (transcript, summary, intent, qualification, appointment, follow-up, CRM-sync status, next action) in the event ledger — **operational capture only**; per-tenant knowledge / RAG stays **v0.4-gated**.

> This direction is **ratified by ADR-0031–0037** ([`DECISIONS.md`](./DECISIONS.md)): Telnyx primary (supersedes ADR-0024's Twilio default), Vapi primary orchestration with OpenAI preferred in-Vapi where configurable, Twilio failover, Retell secondary, HubSpot default commercial SoR, Calendly as the v0.3 MVP scheduling baseline with Cal.com deferred, Phase-1 Business Memory baseline, and no implementation authorization without a separate approved PR.

## Hard constraints (always)

- No Firebase.
- No live provider integrations until v0.3 is explicitly authorized.
- No real secrets in the repo; `.env.example` is placeholders only.
- No deploy is authorized by CI, a preview URL, or a pull request. A separately
  authorized **Gate Set A** promotion may host only the Clerk-gated, mock-safe
  demo; **Gate Set B** live-provider production requires separate written
  authorization.
- ResponseOS is **not** HIPAA-certified. The HIPAA-ready lane is a future architectural pattern, not a current product capability.

## Success metrics

- Per workspace, per month: estimated and verified recovered revenue, ROI multiple, response time, admin hours saved, jobs won.
- Internal: time from lead-event ingest to first qualified outbound contact; webhook signature validation success rate.
