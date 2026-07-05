# ResponseOS v0.3 Live Call Demo Slice

**Status:** Planning and authorization artifact. This document defines the next v0.3 slice but does not implement provider wiring, schema changes, env vars, webhook mutation, billing, or live cutover.
**Date:** 2026-07-05
**Related:** [`../ROADMAP.md`](../ROADMAP.md), [`../SECURITY.md`](../SECURITY.md), [`../DECISIONS.md`](../DECISIONS.md), [`responseos-v0.3-demo-deploy-checkpoint.md`](./responseos-v0.3-demo-deploy-checkpoint.md), [`responseos-v0.3-provider-readiness.md`](./responseos-v0.3-provider-readiness.md).

## 1. Problem

The current public ResponseOS surface proves deployment, branding, and mock walkthrough mechanics, but it does not let a lead experience the core product promise: a real phone call being answered, qualified, captured, and reflected back into the operating system.

The operator now wants a live demo where a lead can:

- Call a dedicated ResponseOS demo number.
- Request an outbound demo call from the site.
- Experience both customer journeys without using the operator's personal number.

## 2. Desired Outcome

A scoped, demo-only live-call slice that proves the ResponseOS call journey with real telephony and AI voice while preserving tenant isolation, webhook security, consent, budget control, and rollback.

The first implementation target is **inbound call demo first**. Outbound "call me now" follows only after inbound is stable and protected.

## 3. Non-Negotiable Decisions

- Use a **dedicated demo phone number**. Do not use Audio's personal number.
- Use a **demo-only tenant/account** and demo-only provider resources.
- No live webhook may mutate business data before signature validation passes.
- Every write path must derive `accountId` from trusted server-side demo configuration or session context, never from client input.
- Every call event must land in the event-ledger path before downstream business state changes.
- Outbound calls require explicit consent copy, rate limiting, abuse prevention, and a kill switch.
- The public site must disclose that the experience is a live demo, not a deployed client system.
- ResponseOS must not be represented as HIPAA-certified or HIPAA-compliant.

## 4. Scope

In scope for the live-call demo slice:

- Dedicated demo number selection and provider-account checklist.
- Inbound call journey spec.
- Outbound request-call journey spec.
- Webhook contract and signature-validation requirements.
- Demo tenant isolation rules.
- Consent, rate-limit, and abuse controls.
- Event-ledger and dashboard persistence expectations.
- Smoke test and rollback plan.

Out of scope for this planning artifact:

- Provider SDK installation.
- Schema migration.
- Env var changes or real secret insertion.
- Live provider account configuration.
- Production traffic cutover.
- Stripe billing.
- CRM sync beyond mock or demo-only future wiring.
- HIPAA-ready lane implementation.

## 5. Provider Baseline

Preferred v0.3 baseline remains:

| Layer | Preferred | Fallback / Secondary | Notes |
|---|---|---|---|
| Carrier / number | Telnyx | Twilio | Telnyx is ADR-0031 primary; Twilio remains failover. |
| AI voice orchestration | Vapi | Retell | Vapi is ADR-0032 primary; Retell remains secondary. |
| LLM / transcription brain | OpenAI in Vapi where configurable | Vapi-owned model selection | ADR-0036 planning baseline. |
| Commercial CRM | Demo-only internal ledger first | HubSpot later | No live CRM sync required for first demo slice. |

If Telnyx setup blocks the demo number, Twilio is acceptable for this demo slice as a time-boxed fallback, provided the carrier remains behind the same provider abstraction and the ADR is not silently reversed.

## 6. Journey A — Inbound Lead Calls Demo Number

1. Lead sees the demo number on the ResponseOS public demo surface.
2. Lead calls the dedicated demo number.
3. Carrier receives call and routes it to the voice orchestration provider.
4. AI voice agent answers with required disclosure:
   - automated assistant disclosure
   - recording/transcription disclosure where applicable
   - demo-context statement
5. AI qualifies the lead using the RECOVER intake baseline:
   - service type
   - location/service area
   - urgency
   - decision-maker status
   - contact details
   - preferred next step
6. Provider sends signed webhook events back to ResponseOS.
7. ResponseOS verifies signature before body parsing or mutation.
8. Valid event is written to the event ledger and normalized into demo call/contact/lead records.
9. Dashboard/demo surface shows the captured call, qualification, transcript/summary, and next action.

## 7. Journey B — Lead Requests Outbound Demo Call

Outbound is phase two of this slice.

1. Lead enters name, phone number, and consent on the public demo surface.
2. Server validates input, rate limit, and abuse controls.
3. Request is written as a pending outbound demo request.
4. Server initiates a provider call only if consent and rate-limit checks pass.
5. AI voice agent calls the lead and uses the same demo intake flow.
6. Provider webhooks follow the same verify-first ingest path as inbound.

Outbound must not ship until inbound proves:

- provider credentials are stable,
- signature verification works,
- event persistence works,
- dashboard display works,
- kill switch is tested.

## 8. Webhook and Data Contract

Minimum event fields:

- provider
- provider event id
- provider call id
- event type
- direction: inbound or outbound
- started/ended timestamps
- from/to numbers, stored according to retention policy
- transcript or transcript reference
- summary
- qualification facts
- consent status for outbound
- demo account id derived server-side
- signature validation result
- raw payload retention policy

Required controls:

- Deduplicate by provider event id / call id.
- Reject invalid signatures with `401`.
- Reject stale timestamps where provider supports timestamps.
- Do not mutate lead/contact/call rows before signature validation.
- Log invalid attempts to the security/audit stream.

## 9. Demo Tenant Isolation

The live-call demo must use a dedicated demo account, for example:

- account slug: `responseos-demo`
- workspace label: `ResponseOS Demo`
- provider connection scope: demo only

No public request may submit or override `accountId`. Server code owns the demo account lookup.

## 10. Consent, Abuse, and Budget Controls

Required before outbound:

- Clear consent checkbox near the phone-number field.
- Copy stating that the user agrees to receive a demo call from ResponseOS.
- Rate limit by IP, phone number, and time window.
- Maximum daily outbound demo-call count.
- Block repeated failed attempts.
- Internal kill switch, for example `RESPONSEOS_LIVE_CALL_DEMO_ENABLED=false`.
- Provider spend limit or prepaid cap where supported.

## 11. Success Criteria

Inbound success:

- A lead can call the dedicated demo number.
- The AI agent answers with demo and recording disclosure.
- A signed provider webhook is accepted.
- An invalid webhook is rejected before mutation.
- The call appears in the ResponseOS demo dashboard with summary and qualification.
- No real CRM sync, billing, or non-demo tenant mutation occurs.

Outbound success:

- A lead can explicitly request a demo call.
- Rate limits and consent gates are enforced.
- The outbound call is initiated only after validation.
- The resulting call follows the same ledger-first path.

## 12. Validation Gates

Before implementation PR:

- Confirm provider choice for the dedicated demo number.
- Confirm demo phone number ownership and billing cap.
- Confirm webhook signature mechanism for chosen provider(s).
- Confirm Vapi/Retell assistant disclosure script.
- Confirm demo account id lookup strategy.

Before live-call preview:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:integration`
- Provider webhook signature tests pass.
- Tenant-isolation tests extended for live-call write path.
- Kill switch tested off and on.
- Invalid signature test proves no mutation.
- Outbound rate-limit test passes before any public call-me form ships.

## 13. Rollback Plan

- Disable `RESPONSEOS_LIVE_CALL_DEMO_ENABLED`.
- Disable provider webhook endpoint or reject all non-Clerk live-call events.
- Unpublish or hide the demo phone number from the public page.
- Disable outbound call initiation.
- Keep existing mock walkthrough available.
- Preserve event logs for incident review.

## 14. Open Questions

- Should the demo number be Telnyx-first or Twilio fallback for speed?
- Should the first assistant use Vapi with OpenAI as the in-Vapi brain, or Vapi-owned model selection?
- Which page should display the live demo number first: `/demo`, `/demo/walkthrough`, or a new `/demo/live-call` route?
- Should outbound call requests require email verification before dialing?
- What is the daily spend cap for public demo calls?
