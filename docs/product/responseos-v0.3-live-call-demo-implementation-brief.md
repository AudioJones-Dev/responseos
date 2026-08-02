# ResponseOS v0.3 Live Call Demo Implementation Brief

**Status:** Git Spec-ready task brief. Planning only until an implementation PR is explicitly approved.
**Date:** 2026-07-05
**Related:** [`responseos-v0.3-live-call-demo-slice.md`](./responseos-v0.3-live-call-demo-slice.md), [`../DECISIONS.md#adr-0045--v03-live-call-demo-slice-telnyx-first-sentdm-assisted-inbound-first`](../DECISIONS.md#adr-0045--v03-live-call-demo-slice-telnyx-first-sentdm-assisted-inbound-first), [`../SECURITY.md`](../SECURITY.md), [`../ROADMAP.md`](../ROADMAP.md).

## 1. Problem

The live-call demo slice is now scoped, but the next implementation move must avoid two failure modes:

- jumping directly into live Telnyx/Sent.dm wiring before the contracts, tests, and kill switch exist;
- building a throwaway demo path that bypasses the provider abstraction, event ledger, tenant isolation, or webhook-signature gate.

## 2. Desired Outcome

Create the first implementation sequence for a demo-only live-call path where:

- inbound calls are implemented before outbound calls;
- provider-specific behavior stays behind adapters;
- every webhook mutation is signature-first;
- public requests never choose `accountId`;
- the app still boots and tests without secrets;
- live activation becomes a final, reversible configuration step rather than a code surprise.

## 3. Scope Boundary

This brief authorizes no code by itself. It is the recommended sequence for future PRs.

In scope for the next implementation PR after approval:

- TypeScript interfaces for telephony, messaging, demo-call events, and consent state.
- Mock Telnyx and mock Sent.dm adapters only.
- Provider-neutral messaging fields that keep a later Linq adapter possible without changing business logic.
- Unit tests proving deterministic mock behavior and no-secret boot.
- Dashboard/progress doc updates for each completed slice.

Out of scope until a later approved PR:

- Real Telnyx API calls.
- Real Sent.dm API calls.
- Provider SDK installation.
- Env var insertion or secret access.
- Schema migration.
- Public outbound call initiation.
- CRM sync.
- Production live-call cutover.

## 4. Recommended PR Sequence

### PR A — Contracts and Mocks Only

Goal: establish the provider boundaries without touching live services.

Add:

- `TelephonyProvider` interface for inbound event normalization and outbound call request shape.
- `MessagingProvider` interface for verification, consent confirmation, and follow-up message shape.
- `MockTelephonyProvider` with deterministic inbound/outbound demo fixtures.
- `MockMessagingProvider` with deterministic Sent.dm-style idempotency behavior.
- Unit tests for mock provider behavior, idempotency keys, provider-neutral message metadata, and no-secret fallback.

Do not add:

- real Telnyx code,
- real Sent.dm code,
- env vars,
- webhooks that mutate business rows,
- schema changes.

### PR B — Signed Webhook Ingest Skeleton

Goal: create the verify-first route and tests before any live provider points at it.

Add:

- a Telnyx live-call webhook route in mock-safe mode;
- raw-body signature verification utility boundary;
- stale timestamp rejection;
- invalid-signature `401` path;
- accepted-event write to `webhook_events` only;
- tests proving invalid signatures do not create business mutations.

Business rows such as calls, contacts, leads, transcripts, or conversations should remain untouched in this PR unless the signature-valid ingest path and tenant-safe demo account resolver are already tested.

### PR C — Inbound Demo Normalization

Goal: turn a verified provider event into demo-account records.

Add:

- server-only demo account resolver;
- normalized inbound demo call event mapping;
- demo-account call/lead/transcript persistence;
- dashboard/demo display from the demo account;
- duplicate provider event handling.

Required tests:

- accepted signed event creates only demo-account rows;
- public/client input cannot override `accountId`;
- duplicate provider event does not duplicate business rows;
- invalid signature still creates no business rows.

### PR D — Outbound Request Gate, Mock First

Goal: build the public outbound request flow without initiating real calls.

Add:

- public request-call form or endpoint with consent copy;
- server-side validation;
- rate limit boundary;
- kill switch check;
- mock Sent.dm verification/consent message;
- pending outbound demo request state in the existing persistence pattern or a separately approved schema change.

Do not initiate live outbound calls in this PR.

### PR E — Live Activation

Goal: swap configured adapters from mock to live after all controls are green.

Requires operator confirmation of:

- dedicated Telnyx demo number;
- Telnyx webhook public key/signature mechanism;
- Telnyx AI Assistant feasibility or Vapi fallback decision;
- Sent.dm template IDs and approved channel;
- daily spend cap;
- live-call kill switch value;
- Vercel/Doppler secret placement;
- rollback owner and rollback trigger.

## 5. Provider Contracts

### Telephony Provider

Required capabilities:

- normalize inbound call event;
- normalize outbound call event;
- expose provider event id and provider call id;
- expose direction, timestamps, from/to numbers, transcript reference, summary, and qualification facts when available;
- initiate outbound demo call only after consent, verification, rate-limit, and kill-switch checks pass.

### Messaging Provider

Required capabilities:

- send verification or consent-confirmation message;
- send post-call recap/demo-link message;
- require idempotency key on every send;
- record consent purpose;
- surface provider message id and delivery status;
- preserve optional protocol/channel metadata so a later Linq adapter can support SMS, RCS, or iMessage without changing ResponseOS business state;
- preserve optional trace id, delivery receipt id, read receipt id, and provider-specific capability metadata when a provider exposes them;
- fall back to mock when secrets are absent.

The active implementation target remains Sent.dm. Linq is an option to revisit after the scheduled provider demo, so PR A should avoid Sent.dm-specific names above the adapter boundary.

## 6. Required Human Inputs Before Live Activation

- Dedicated Telnyx demo number.
- Telnyx AI Assistant decision: sufficient for first demo or Vapi fallback required.
- Sent.dm first channel: SMS only, or SMS plus WhatsApp/RCS.
- Sent.dm template IDs for verification, consent confirmation, and follow-up.
- Linq provider-demo outcome: keep as migration option, promote to fallback, or open a later replacement decision.
- Public consent copy.
- Daily outbound call/message cap.
- Demo account identifier strategy.
- Operator-approved rollback trigger.

## 7. Validation Gates

Each implementation PR must run the appropriate subset of:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:integration`

Live activation additionally requires:

- provider webhook signature tests;
- invalid-signature no-mutation test;
- tenant-isolation test for the demo write path;
- kill switch off/on test;
- outbound rate-limit test;
- no-secret fallback test.

## 8. Recommended Next Task

Proceed with **PR A — Contracts and Mocks Only**.

This is the strongest next move because it creates the internal seams required for Telnyx and Sent.dm without exposing the app to live provider behavior, billing, or public outbound abuse before the security gates exist. It also keeps the messaging boundary clean enough to migrate to Linq later if the provider demo proves it is a better fit.
