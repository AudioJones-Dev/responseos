# ResponseOS v0.3 Live Call Demo Slice

**Status:** Planning and authorization artifact. This document defines the next v0.3 slice but does not implement provider wiring, schema changes, env vars, webhook mutation, billing, or live cutover.
**Date:** 2026-07-05
**Related:** [`../ROADMAP.md`](../ROADMAP.md), [`../SECURITY.md`](../SECURITY.md), [`../DECISIONS.md`](../DECISIONS.md), [`responseos-v0.3-demo-deploy-checkpoint.md`](./responseos-v0.3-demo-deploy-checkpoint.md), [`responseos-v0.3-provider-readiness.md`](./responseos-v0.3-provider-readiness.md), [`responseos-v0.3-live-call-demo-implementation-brief.md`](./responseos-v0.3-live-call-demo-implementation-brief.md).

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

## 5. Stack Decision

The strongest first live-call demo stack is **Telnyx-first, Sent.dm-assisted, Vapi optional**.

This means:

- **Telnyx owns the phone path**: dedicated demo number, inbound/outbound voice, call webhooks, call-control events, recording/transcript path where enabled.
- **Sent.dm owns verification and follow-up messaging**: OTP or phone verification before outbound, consent confirmation, post-call recap, demo links, and fallback messaging across SMS/WhatsApp/RCS.
- **ResponseOS owns the product truth**: demo tenant, event ledger, qualification facts, consent state, dashboard display, audit trail, and kill switch.
- **Vapi stays optional behind `VoiceAgentProvider`**: use it only if Telnyx AI Assistant is not flexible enough for the first demo conversation.

This is a demo-slice decision, not a reversal of the broader v0.3 provider baseline. Telnyx remains the primary carrier per ADR-0031. Vapi remains the broader primary orchestration baseline per ADR-0032/0036, but the demo slice should first test whether Telnyx can provide enough AI-assistant capability with fewer moving parts.

## 6. Provider Baseline

Preferred live-call demo baseline:

| Layer | Preferred | Fallback / Secondary | Notes |
|---|---|---|---|
| Carrier / number | Telnyx | Twilio | Telnyx is ADR-0031 primary; Twilio remains failover. |
| First AI voice path | Telnyx AI Assistant | Vapi | Start with the fewest vendors; introduce Vapi only if Telnyx assistant capability blocks the demo. |
| Messaging / verification | Sent.dm | Telnyx Messaging / Linq | Sent.dm handles OTP, consent confirmation, post-call follow-up, and demo links. Linq remains an evaluated migration option, not the active baseline. |
| Commercial CRM | Demo-only internal ledger first | HubSpot later | No live CRM sync required for first demo slice. |

If Telnyx setup blocks the demo number, Twilio is acceptable for this demo slice as a time-boxed fallback, provided the carrier remains behind the same provider abstraction and the ADR is not silently reversed.

If Sent.dm setup blocks verification/follow-up, Telnyx Messaging may be used as a temporary fallback. The ResponseOS app should still model messaging through a provider abstraction so Sent.dm can remain the preferred messaging layer once ready.

Linq should be tracked as a migration-ready messaging option after the scheduled provider demo. It must not change the current Telnyx + Sent.dm implementation sequence until provider access, assigned numbers, webhook signature behavior, pricing, and delivery/read-receipt semantics are confirmed. Any future Linq move should happen behind the same `MessagingProvider` boundary, not through Linq-specific business logic.

## 7. Journey A — Inbound Lead Calls Demo Number

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

## 8. Journey B — Lead Requests Outbound Demo Call

Outbound is phase two of this slice.

1. Lead enters name, phone number, and consent on the public demo surface.
2. Server validates input, rate limit, and abuse controls.
3. Sent.dm sends a verification or consent-confirmation message.
4. Lead confirms the verification/consent step.
5. Request is written as a pending outbound demo request.
6. Server initiates a Telnyx outbound call only if verification, consent, and rate-limit checks pass.
7. AI voice agent calls the lead and uses the same demo intake flow.
8. Provider webhooks follow the same verify-first ingest path as inbound.

Outbound must not ship until inbound proves:

- provider credentials are stable,
- signature verification works,
- event persistence works,
- dashboard display works,
- kill switch is tested.

## 9. Sent.dm Messaging Contract

Sent.dm is not the voice layer. It is the messaging layer for:

- phone verification / OTP,
- consent confirmation,
- post-call recap,
- demo links,
- fallback follow-up if the call fails or is missed.

Required message properties:

- idempotency key,
- recipient phone number,
- channel selection,
- template id,
- template parameters,
- consent purpose,
- associated demo request id where applicable.

Required controls:

- Store Sent.dm API keys only in Doppler/Vercel, never in repo.
- Do not send outbound messages without a consent purpose.
- Deduplicate sends by idempotency key.
- Record delivery status webhooks only after signature validation, if Sent.dm webhooks are enabled.

The contract must stay provider-neutral enough to support a later Linq adapter. At minimum, the internal message shape should preserve channel/protocol, provider message id, delivery/read receipt identifiers where available, trace id where available, and provider-specific capabilities as optional metadata rather than required business fields.

## 10. Webhook and Data Contract

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

## 11. Demo Tenant Isolation

The live-call demo must use a dedicated demo account, for example:

- account slug: `responseos-demo`
- workspace label: `ResponseOS Demo`
- provider connection scope: demo only

No public request may submit or override `accountId`. Server code owns the demo account lookup.

## 12. Consent, Abuse, and Budget Controls

Required before outbound:

- Clear consent checkbox near the phone-number field.
- Copy stating that the user agrees to receive a demo call from ResponseOS.
- Sent.dm verification or consent-confirmation message before the outbound call.
- Rate limit by IP, phone number, and time window.
- Maximum daily outbound demo-call count.
- Block repeated failed attempts.
- Internal kill switch, for example `RESPONSEOS_LIVE_CALL_DEMO_ENABLED=false`.
- Provider spend limit or prepaid cap where supported.

## 13. Success Criteria

Inbound success:

- A lead can call the dedicated demo number.
- The AI agent answers with demo and recording disclosure.
- A signed provider webhook is accepted.
- An invalid webhook is rejected before mutation.
- The call appears in the ResponseOS demo dashboard with summary and qualification.
- No real CRM sync, billing, or non-demo tenant mutation occurs.

Outbound success:

- A lead can explicitly request a demo call.
- Sent.dm verifies or confirms consent before the call is initiated.
- Rate limits and consent gates are enforced.
- The outbound call is initiated only after validation.
- The resulting call follows the same ledger-first path.

## 14. Validation Gates

Before implementation PR:

- Confirm Telnyx dedicated demo number path.
- Confirm whether Telnyx AI Assistant can handle the first demo conversation without Vapi.
- Confirm Sent.dm template/channel setup for OTP, consent confirmation, and follow-up.
- Confirm demo phone number ownership and billing cap.
- Confirm webhook signature mechanism for chosen provider(s).
- Confirm Telnyx or Vapi assistant disclosure script.
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

## 15. Rollback Plan

- Disable `RESPONSEOS_LIVE_CALL_DEMO_ENABLED`.
- Disable provider webhook endpoint or reject all non-Clerk live-call events.
- Unpublish or hide the demo phone number from the public page.
- Disable outbound call initiation.
- Disable Sent.dm message sends.
- Keep existing mock walkthrough available.
- Preserve event logs for incident review.

## 16. Open Questions

- Can Telnyx AI Assistant handle the first demo conversation without Vapi?
- Which Sent.dm channels should be enabled first: SMS only, or SMS plus WhatsApp/RCS?
- After the scheduled Linq provider demo, should Linq remain a migration option, become a fallback, or replace Sent.dm as the preferred messaging layer?
- Which page should display the live demo number first: `/demo`, `/demo/walkthrough`, or a new `/demo/live-call` route?
- Should outbound call requests require email verification before dialing?
- What is the daily spend cap for public demo calls?

## 17. Next Implementation Brief

The recommended next step is [`responseos-v0.3-live-call-demo-implementation-brief.md`](./responseos-v0.3-live-call-demo-implementation-brief.md).

That brief breaks ADR-0039 into implementation PRs, starting with **contracts and mocks only** before any live Telnyx/Sent.dm wiring, schema migration, env var, or outbound call behavior is introduced.
