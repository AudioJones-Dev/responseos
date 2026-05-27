# PRD — ResponseOS

**Owner:** AJ Digital LLC / Audio Jones
**Status:** Living document. Updated each minor version.
**Companion docs:** [`product-spec.md`](./product-spec.md) (full positioning + framework detail), [`client-facing-offer.md`](./client-facing-offer.md) (buyer-facing summary), [`ROADMAP.md`](./ROADMAP.md) (what ships when).

> This PRD is the short, opinionated source of truth for what ResponseOS is, who it's for, and what the current scope is. For deep product context (RECOVER mapping, buy-vs-build, success metrics), read `product-spec.md`. For commercial detail, read `pricing-and-onboarding.md`.

## What it is

**ResponseOS is the AI Revenue Recovery Platform.** It captures missed demand for service businesses, qualifies and routes leads, automates follow-up, books opportunities, and proves the recovered revenue.

It is **not** an AI receptionist clone. The receptionist is one input. ResponseOS is the recovery layer that sits on top of every demand signal — phone, SMS, web form, AI-answered call, outbound campaign — and makes sure none of it leaks.

## Positioning

> "ResponseOS helps service businesses recover missed revenue by capturing calls, qualifying leads, automating follow-up, booking opportunities, and reporting ROI."

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

Sold in two phases:

1. **Phase 1 — Readiness & Revenue Leak Assessment.** $1,000 flat ($750–$1,500 range). Paid diagnostic that determines AI-readiness, revenue leak size, and fit/no-fit before any implementation conversation.
2. **Phase 2 — Implementation + Monthly Revenue Recovery Retainer.** Setup fee + monthly retainer in one of three tiers (Recovery Core / Recovery Pro / Recovery Performance), with optional outcome fees layered on top.

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

## Current scope (v0.2, in progress)

In:

- Postgres-backed data layer with deterministic seed.
- Tenant-aware data access (`aj_admin` / `operator` / `client_admin` / `client_viewer`).
- Client portal reads routed through the v0.2 data layer.
- Integration test suite + CI integration job against Postgres 16.
- Webhook event ledger foundation (raw body, signature header, signature_valid flag, dedupe hash).
- Audit-log foundation.
- Mock provider adapters preserved.

Explicitly out:

- Live provider integrations (Twilio / Retell / Vapi / Stripe / GHL / HubSpot) → v0.3.
- Billing engine + Stripe + outcome-fee ledger → v0.5.
- Knowledge layer → v0.4+.
- Production deploys → gated on v0.3 readiness.

See [`ROADMAP.md`](./ROADMAP.md) for the full version table and milestone status.

## Hard constraints (always)

- No Firebase.
- No live provider integrations until v0.3 is explicitly authorized.
- No real secrets in the repo; `.env.example` is placeholders only.
- No production deploys from this repo yet.
- ResponseOS is **not** HIPAA-certified. The HIPAA-ready lane is a future architectural pattern, not a current product capability.

## Success metrics

- Per workspace, per month: estimated and verified recovered revenue, ROI multiple, response time, admin hours saved, jobs won.
- Internal: time from lead-event ingest to first qualified outbound contact; webhook signature validation success rate.
