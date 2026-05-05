# Product Spec — ResponseOS

## What it is

**ResponseOS = AI Revenue Recovery Platform.** It captures missed demand for service businesses, qualifies and routes leads, automates follow-up, books opportunities, and proves the recovered revenue.

It is **not** an AI receptionist clone. The receptionist is one input. The product is the recovery layer that sits on top of every demand signal — phone, SMS, web form, AI-answered call, outbound campaign — and makes sure none of it leaks.

## Positioning

> "ResponseOS helps service businesses recover missed revenue by capturing calls, qualifying leads, automating follow-up, booking opportunities, and reporting ROI."

## Target user

- Service businesses with phone-driven demand: home services (HVAC, roofing, plumbing, electrical), med spas, contractors.
- Owner/operator or office manager who feels the pain of missed calls but does not want to hire a 24/7 receptionist.
- Currently using a CRM (often GoHighLevel or HubSpot) plus disconnected tools (a VoIP, a calendar, a quoting doc, a follow-up Google Sheet).

## Two surfaces

### Internal — AJ Digital Operator Console (v0.1, ships first)
- Manage clients/workspaces.
- Log call events manually or via mock provider adapters.
- Move lead events through qualification → booking → quote → won/lost.
- View revenue recovery metrics per workspace.
- Configure automations (mock).

### Client-facing — Workspace Portal (v0.2, roadmap)
- "Recovered Revenue This Month" hero.
- Calls / Leads / Bookings / Quotes / Revenue tabs.
- Monthly business review export.

## Frameworks

### OFFER (philosophy)
Outcomes First · Front the Work · Framework Driven · Earn on Outcomes · ROI-Aligned Partnerships.

### RECOVER — operational mapping (canonical)

This is the operator-level mapping of RECOVER. It maps each stage to a concrete operator action and a measurable business outcome.

| Stage | Operator meaning | Business outcome |
|---|---|---|
| **Respond** | Answer every inbound call or text immediately | Fewer missed opportunities |
| **Evaluate** | Qualify service type, geography, urgency, budget, intent | Better lead quality |
| **Capture** | Normalize customer, job, transcript, attribution data | Reliable CRM and reporting |
| **Offer** | Present estimate, financing, self-scheduling, callback path | Faster conversion |
| **Verify** | Confirm appointment, consent, payment intent, routing | Lower no-shows, fewer errors |
| **Escalate** | Hand off edge cases, high-value jobs, compliance-sensitive calls | Better customer trust |
| **Report** | Prove recovered leads, booked jobs, revenue by tenant and source | Outcome-based pricing |

> Marketing/positioning version (also used in client-facing copy): Revenue Leak Detection · Engagement Automation · Call Capture System · Outcome-Based Booking · Verification + Qualification · Economic ROI Tracking · Reporting + Retention. These are the same framework expressed in buyer language. Internally, always use the operational mapping above to drive product decisions.

## Buy vs Build

The product is **not** the AI answering. The product is **recovered demand**. We buy commodity infrastructure and build the orchestration + accountability layer.

| Layer | Decision | Notes |
|---|---|---|
| Telephony / SMS | **Buy** — Twilio | Carrier, numbers, webhooks, SIP, Media Streams |
| Real-time voice runtime | **Buy** — Retell AI (Vapi/Bland as alternates) | Turn-taking, post-call analysis, BAA path |
| STT / TTS primitives | **Buy** | Quality + scale moves too fast to rebuild |
| Payments | **Buy** — Stripe | Hosted pages, webhooks, signed events |
| HIPAA primitives | **Buy** — AWS | BAA-eligible services for the regulated lane |
| Workflow glue | **Hybrid** — n8n + internal runners | Client-specific automations vs core orchestration |
| **Canonical data model** | **Build** | Shared truth across Twilio, Retell, QuoteIQ, GHL, HubSpot, calendars, payments |
| **RECOVER orchestration** | **Build** | The defensible IP — Respond/Evaluate/Capture/Offer/Verify/Escalate/Report |
| **Quote + schedule state machine** | **Build** | Vertical pricing logic + booking rules |
| **QA rubric + scoring** | **Build** | Drives outcome pricing |
| **ROI measurement** | **Build** | Verified recovered revenue, baselines, attribution |
| **White-label portal** | **Build** | What clients actually buy |
| **Tenant billing logic** | **Build** | Outcome-fee + usage-meter math |

**QuoteIQ posture:** treat as reference + connector, not system-of-record. Public surface is outbound webhook events and Zapier-mediated calendar sync. Architect so QuoteIQ, GHL, HubSpot, or CSV import can all operate as downstream systems.

## MVP scope (v0.1 — Internal AJ Digital Operator Console)

In:
- Client/workspace management.
- Manual lead entry.
- Call event logging.
- Lead qualification status.
- Missed-call recovery dashboard.
- Revenue metrics model.
- Basic report generation.
- Webhook-ready architecture.
- Mock provider adapters.
- `.env.example` with no secrets.

Deferred:
- Full AI voice system (v0.3).
- Native quote engine v2 (v0.3 — v0.1 ships `quote_requests` only).
- Native invoicing (later).
- Complex outbound campaigns (v0.3).
- Multi-provider billing (v0.3).
- Mobile app (later).

## 30-day MVP plan (per deep research report)

| Window | Milestone | Deliverables |
|---|---|---|
| Days 1–5 | Foundation | Tenant model, account config, Twilio webhooks, Retell call flow, event ledger, lead model |
| Days 6–10 | Recovery loop | Missed-call SMS, qualification state machine, transcript extraction, call transfer rules |
| Days 11–15 | Conversion loop | Quote engine v1, self-schedule API, Google free/busy, confirmation flows |
| Days 16–20 | Money loop | Stripe payment/deposit flows, billing meters, usage logging, first ROI marts |
| Days 21–25 | White-label v1 | Branded portal, custom theme variables, tenant RBAC, report pages |
| Days 26–30 | Hardening + pilot | QA rubric, monitoring, rollback controls, staging-to-prod, pilot with one contractor |

## Roadmap

- **v0.1 — Internal Operator Console (current).** Mocks only. 11 core models. Webhook-ready. No live integrations.
- **v0.2 — Client Portal + expanded model.** Read-only dashboards for clients backed by Postgres. Data model expands to event-ledger-first per the deep research report (see `data-schema.md` v0.2 section).
- **v0.3 — Live integrations.** Twilio, Retell, Vapi, Resend, Stripe, n8n, GHL with signature verification + persistence. HIPAA-ready lane optional per tenant.

## Success metrics

- Per workspace, per month: estimated and verified recovered revenue, ROI multiple, response time, admin hours saved, jobs won.
- Internal: time from lead-event ingest to first qualified outbound contact; webhook signature validation success rate.
