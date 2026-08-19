# PRD — Telnyx AI Assistant Post-Call Ingestion

**Owner:** AJ Digital LLC / Audio Jones  
**Status:** Planning gate complete; implementation not authorized  
**Prepared:** 2026-08-18  
**Target:** ResponseOS v0.3 live-call demo, Standard-lane demo tenant  
**Candidate authorization stage:** Stage D — Live Telnyx on staging, only after Stages A–C and Gate Set B prerequisites clear  
**Capability status:** `DOCUMENTED_ONLY` for the live path; generic CAL interfaces and deterministic mocks are present in the current checkout

> This PRD changes no provider account, phone number, secret, schema, runtime,
> webhook, CRM, deployment, or public claim. It does not authorize a live
> Telnyx adapter, webhook mutation, HubSpot write, staging activation, or
> prospect call. Each consequential step still requires its matching staged
> authorization in
> [`responseos-v0.3-founding-pilot-scope.md`](./responseos-v0.3-founding-pilot-scope.md).

## 1. Decision summary

The safest first live-provider slice is **post-call ingestion**, not realtime
audio control:

```text
Telnyx AI Assistant
  -> signed Telnyx webhook
  -> verified WebhookEvent ledger record
  -> durable post-ack processor
  -> demo-tenant Call / LeadEvent / qualification / transcript records
  -> existing ResponseOS console
  -> sandbox CrmProvider only
```

Telnyx may operate the conversation. ResponseOS owns verification, canonical
normalization, tenant-safe persistence, evidence, and display. Live HubSpot is
not part of this slice; the founding-demo amendment keeps CRM actions sandboxed,
and live HubSpot remains Stage G.

## 2. Facts, inferences, and unresolved assumptions

### Verified repository facts

- `getCarrierProvider()` supplies only `MockCarrierProvider`; setting
  `TELNYX_API_KEY` cannot create a live provider because the factory has no
  `createLive` implementation.
- `getCrmProvider()` supplies only `MockCrmProvider`; setting
  `HUBSPOT_ACCESS_TOKEN` cannot create a live provider.
- The current checkout contains generic carrier, voice-agent, SMS, CRM, and
  scheduling interfaces with deterministic mocks.
- `WebhookEvent` supports raw payloads, signature state, provider event IDs, a
  unique dedupe hash, and processing status.
- `Call`, `Contact`, `LeadEvent`, `LeadQualification`, `CallSegment`, and
  `CallTranscript` provide most of the local persistence substrate.
- `CallProvider`, `SmsProvider`, and `ProviderConnectionProvider` do not yet
  represent the ratified Telnyx baseline consistently.
- Existing Telnyx/Vapi/Retell/Twilio webhook routes do not implement a signed
  Telnyx AI Assistant ingestion path.

### Provider facts verified against current Telnyx documentation

- Telnyx Voice API lifecycle events include `call.initiated`, `call.answered`,
  and `call.hangup`.
- A Telnyx AI Assistant emits `call.conversation.ended` and
  `call.conversation_insights.generated` after the assistant is started.
- Telnyx signs API v2 webhooks with `telnyx-signature-ed25519` and
  `telnyx-timestamp` over `timestamp|raw_body`.
- Telnyx webhooks can be duplicated or delivered out of order; `data.id` is the
  provider event identifier.
- The conversation-end event identifies the conversation but does not, by
  itself, guarantee that the full transcript is embedded. Conversation messages
  are available through the conversation messages API.

### Inferences

- The fastest acceptable demonstration can persist post-call results without
  making ResponseOS responsible for the realtime media loop.
- The signed ledger write should be the synchronous webhook responsibility;
  provider reads, normalization, CRM sandbox actions, and UI projections should
  occur through a durable post-ack processor.
- A live HubSpot write increases risk without proving the Demo MVP's core claim,
  which is call -> durable canonical intelligence -> explainable local action.

### Assumptions that remain unverified

- The operator-supplied E.164 number is a dedicated Telnyx demo resource rather
  than a personal, production, or client number. The number is intentionally not
  stored in this repository until that is confirmed.
- Telnyx AI Assistant can execute the qualification script with acceptable
  disclosure, latency, transcription, insight quality, and failure behavior.
- The transcript source for this assistant configuration will be either an
  event payload or an authorized post-call conversation-messages read.
- The current founding-pilot scope says Telnyx -> Vapi is Demo-MVP required,
  while accepted ADR-0045 permits Telnyx AI Assistant first with Vapi optional.
  This PRD follows ADR-0045 for the bounded demo slice, but the prose scope must
  be reconciled before live activation.

## 3. Problem

ResponseOS can model calls and resolve provider abstractions, but it cannot
currently receive a real Telnyx AI Assistant conversation and turn it into
tenant-safe, replayable ResponseOS records. API keys do not close that gap.

A direct jump to provider configuration would expose four unbuilt controls:

1. signature-first webhook verification;
2. durable idempotent ingestion and post-ack processing;
3. safe identity and tenant resolution;
4. tested failure and rollback behavior.

Without those controls, a successful phone conversation could still disappear,
duplicate records, contaminate another tenant, leak transcript data, or create a
false claim that HubSpot synchronization is operational.

## 4. Desired outcome

On a private staging number and demo-only account, an outside caller completes a
Telnyx AI Assistant conversation. ResponseOS then:

1. verifies every Telnyx signature before parsing or mutation;
2. records each accepted provider event once in `WebhookEvent`;
3. correlates lifecycle, conversation-end, insights, and transcript data;
4. persists canonical demo-tenant call and qualification records;
5. displays those persisted records in the existing operator/demo console;
6. invokes only the sandbox CRM adapter; and
7. exposes enough processing state to diagnose retries, partial completion, and
   provider failures.

The slice is complete only after an outside-number rehearsal proves the chain
and its failure modes. Completion does not authorize prospect traffic.

## 5. Users and jobs

### Primary operator

AJ Digital staff running a controlled ResponseOS demonstration.

### Operator job

Prove that one real phone conversation becomes durable, tenant-safe,
inspectable operational memory without requiring ResponseOS to control realtime
audio or write to a live commercial CRM.

### Caller job

Complete a clearly disclosed demo qualification call and receive an honest next
step without believing a production client workflow or guaranteed booking has
occurred.

## 6. Success criteria

### Ingestion and security

- Valid Telnyx signatures are verified against the exact raw request body.
- Missing, malformed, invalid, or stale signatures return `401` and create no
  ledger or business record.
- A valid new provider event creates exactly one `WebhookEvent` row.
- A retry with the same `data.id` is a no-op and returns an acceptable `2xx`.
- Out-of-order events converge on the same canonical call without regressing a
  terminal status.
- Public payloads cannot supply or override `accountId`; the demo account is
  resolved from trusted server configuration.

### Persistence

- One outside test call results in one canonical `Call` record in the demo
  account.
- The call can be correlated by Telnyx call/session/conversation identifiers.
- Qualification facts preserve source and distinguish provider-generated facts
  from ResponseOS-derived scores.
- Transcript content or references follow the approved retention lane.
- Summary and next action are stored without being represented as verified
  revenue, a booked appointment, or a completed CRM sync.
- Processing errors remain visible and retryable without duplicating records.

### Product display

- The existing console reads persisted records rather than a provider payload.
- The operator can inspect call status, timestamps, caller identity state,
  summary, qualification, transcript availability, and processing/CRM-sandbox
  status.
- The UI labels the path as a controlled live demo and does not claim production
  readiness, live HubSpot sync, or recovered revenue.

### Operational rehearsal

- Tests cover invalid signature, stale timestamp, duplicate event, out-of-order
  event, missing transcript, provider-read failure, database outage, and sandbox
  CRM failure.
- One outside-number rehearsal completes with a written evidence packet.
- The kill switch and webhook rollback path are exercised.
- Failure behavior for the assistant, webhook, persistence layer, CRM sandbox,
  and scheduling fallback is recorded before any prospect receives the number.

## 7. Scope

### In scope

- Telnyx AI Assistant post-call and relevant Voice API lifecycle event contract.
- Ed25519 signature verification and timestamp freshness enforcement.
- Verify-first, ledger-first webhook route.
- Provider-event idempotency and call correlation.
- Demo-only server-side tenant resolution.
- Canonical normalization for call lifecycle, summary, qualification facts,
  transcript availability, and next action.
- Local persistence into existing ResponseOS models where their contracts are
  sufficient.
- Minimal Stage B schema alignment required for Telnyx representation and safe
  concurrency.
- Existing console projection of persisted records.
- Sandbox `CrmProvider` invocation after local persistence.
- Private staging tests, failure drills, kill switch, and rollback evidence.

### Out of scope

- Realtime audio control, custom Node voice gateway, or Redis.
- Live Vapi unless a separately recorded decision makes it necessary.
- Live HubSpot, Calendly, Twilio failover, Sent.dm, Stripe, or n8n wiring.
- Public outbound calling, public SMS, OTP, or a call-me-now form.
- Automatic deal creation, task creation, scheduling, or money movement.
- Knowledge ingestion, RAG, embeddings, or autonomous memory retrieval.
- Production deployment, prospect access, client data, or non-demo tenants.
- HIPAA or regulated workflows.
- Any claim that ResponseOS is production-ready or has recovered revenue.

## 8. Event contract

The adapter must key on the provider event envelope, not undocumented payload
coincidences.

| Telnyx event | Canonical purpose | Minimum local effect |
|---|---|---|
| `call.initiated` | Call leg created | Record in ledger; establish correlation only after trusted demo-account resolution |
| `call.answered` | Call connected | Advance canonical call state without duplicating the call |
| `call.hangup` | Phone leg ended | Apply terminal call status and provider timing/reason facts |
| `call.conversation.ended` | AI conversation ended | Correlate assistant and conversation IDs; persist duration/end metadata |
| `call.conversation_insights.generated` | Summary/insights ready | Persist approved summary and qualification facts with provider provenance |
| `conversation.insights.completed` | Optional insight-group result | Support only when an Insight Group webhook is explicitly configured and fixture-tested |

The implementation must not assume that a single event carries every required
fact. It must correlate using Telnyx identifiers and tolerate missing or late
insights. If transcript text is not present in a signed event, the processor may
retrieve conversation messages only after the live Telnyx adapter and credential
posture are separately authorized.

## 9. Persistence contract and schema blockers

### Existing assets to reuse

- `WebhookEvent` for signed provider callback evidence and dedupe.
- `Call` for the canonical phone interaction.
- `LeadEvent` and `LeadQualification` for the demand signal and qualification
  snapshot.
- `CallTranscript` and `CallSegment` for approved transcript storage.
- `lib/data/session-helpers.ts` tenant policy.
- Existing call/lead/contact/console read paths.
- `CrmProvider` sandbox adapter for a no-side-effect CRM demonstration.

### Stage B decisions required before implementation

1. Add `telnyx` to the relevant Prisma provider enums without activating live
   traffic.
2. Define a concurrency-safe unique identity for a provider call, preferably
   tenant + provider + provider call identifier.
3. Decide how Telnyx call-control, call-leg, call-session, and conversation IDs
   map to canonical storage without hiding them in free-form notes.
4. Define the transcript/raw-event retention treatment for the demo tenant.
5. Define durable processing ownership after the verified ledger insert.

### Caller identity rule

Phone number equality alone must not silently merge contacts. Until a durable
identity contract exists:

- normalize the caller number to E.164 at the provider boundary;
- search only inside the trusted demo account;
- link an existing contact only when the match is unambiguous;
- otherwise leave `contact_id` unset or create a reviewable demo contact under
  an approved idempotency rule; and
- never perform cross-tenant or destructive CRM/contact merges.

## 10. Processing sequence

### Synchronous webhook boundary

1. Read the raw request body exactly once.
2. Read the Telnyx signature and timestamp headers.
3. Reject missing, invalid, or stale signatures before JSON parsing.
4. Parse the verified envelope and validate the supported event schema.
5. Resolve the demo tenant from trusted server configuration.
6. insert or resolve the idempotent `WebhookEvent` record.
7. hand the accepted ledger ID to an approved durable processor.
8. return `2xx` within the provider delivery deadline.

No Telnyx API read, CRM action, scheduling action, or multi-record business
mutation belongs before the verified ledger insert.

### Durable post-ack processor

1. Claim an unprocessed ledger event idempotently.
2. Correlate it with existing events for the same call/session/conversation.
3. Apply monotonic call-state changes.
4. Obtain transcript messages only if required and authorized.
5. normalize summary, qualification facts, transcript, and next action.
6. commit local business mutations transactionally where possible.
7. invoke the sandbox CRM adapter only after the local commit.
8. mark the ledger event processed, duplicate, rejected, or error.
9. retry transient failures without replaying completed mutations.

The durable processor mechanism is a blocking design choice. A serverless
fire-and-forget promise after returning the webhook response is not sufficient.

## 11. Failure and rollback contract

| Failure | Required behavior |
|---|---|
| AI Assistant unavailable | Play or route to an operator-approved safe fallback; do not claim qualification occurred |
| Invalid/stale webhook | `401`; no ledger or business mutation; security evidence without storing untrusted PII beyond approved policy |
| Database unavailable before ledger write | Return retryable failure; Telnyx retry/failover delivery remains authoritative |
| Duplicate/out-of-order delivery | Resolve by provider event ID and occurred timestamp; no duplicate call/lead/transcript |
| Transcript/insights delayed | Persist call state as partial; retry enrichment; UI says unavailable/pending |
| Telnyx post-call API unavailable | Preserve ledger event and retry; no data fabrication |
| Sandbox CRM fails | Local ledger remains authoritative; display failed/pending sandbox status |
| Scheduling unavailable | Record manual callback as next action; do not create an appointment |
| Kill switch off | Reject or safely acknowledge according to the runbook; no business mutation |

Rollback must disable the provider webhook target or ResponseOS live-call flag,
stop post-call processing, remove the number from any prospect surface, retain
approved evidence for incident review, and leave the mock walkthrough available.

## 12. Proposed delivery plan

### Gate 0 — Canon reconciliation and human inputs

- Confirm that the candidate E.164 number is dedicated to the demo.
- Resolve Telnyx-AI-only vs Vapi-required wording in the founding-pilot scope.
- Approve transcript/raw-event retention and disclosure copy.
- Record the Stage B, Stage C, and Stage D authorizations separately.

### Gate 1 — Stage B schema and contract alignment

- Add provider enum support and correlation/idempotency constraints.
- Add fixture-only event schemas and mapping tests.
- Keep every provider factory mock-only.

### Gate 2 — Stage C mock-safe staging

- Verify Clerk, Neon, Vercel staging, auth, demo account, rollback, and console
  reads with providers still mocked.

### Gate 3 — Stage D1 signed ledger ingest

- Add the Telnyx signature verifier and webhook route.
- Accept only fixture/test traffic until signature, freshness, and dedupe tests
  pass.
- Persist only the verified ledger record.

### Gate 4 — Stage D2 post-call normalization

- Add the durable processor, local persistence, and sandbox CRM action.
- Add missing/late/out-of-order event tests and tenant-isolation tests.

### Gate 5 — Stage D3 private activation and rehearsal

- Configure the Telnyx assistant and dedicated number outside the repo.
- Point only the private staging webhook at ResponseOS.
- Complete controlled calls, failure drills, rollback, and an outside-number
  rehearsal.
- Produce a go/no-go packet. Do not distribute the number to prospects.

Live HubSpot remains a separate Stage G plan after this slice is stable.

## 13. Validation requirements

Every implementation PR must pass:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration
```

Additional required evidence:

- official Telnyx fixture coverage for every supported event;
- cryptographic signature positive/negative/stale tests;
- raw-body mutation test proving verification uses exact bytes;
- duplicate and concurrent-delivery tests;
- out-of-order convergence tests;
- tenant override and cross-tenant negative tests;
- database failure and processor retry tests;
- no-secret boot and mock-fallback tests;
- console proof from persisted DB rows;
- kill-switch and rollback rehearsal;
- no Firebase and no secrets in the repository.

## 14. Risks and tradeoffs

| Risk | Consequence | Mitigation |
|---|---|---|
| Treating API keys as activation | False readiness and uncontrolled side effects | Require explicit live factory plus staged authorization |
| Bundling live HubSpot | Larger blast radius and no added Demo-MVP proof | Keep CRM sandboxed; defer live HubSpot to Stage G |
| Transcript assumed inside webhook | Missing or fabricated transcript state | Treat transcript as separate/late; use authorized conversation read when needed |
| Inline heavy webhook work | Telnyx timeout and duplicate retries | Verify + ledger synchronously; durable post-ack processing |
| Weak caller matching | Duplicate or wrongly merged contacts | Tenant-scoped, unambiguous identity rule; no silent merges |
| Raw payload PII | Retention and access exposure | Approve Standard-lane retention/redaction before activation |
| Serverless background work loss | Accepted webhook never normalized | Use an approved durable processor, not fire-and-forget |
| Scope conflict over Vapi | Hidden architecture change | Reconcile accepted ADR-0045 with the newer prose scope before activation |
| Demonstration overclaim | Prospect believes production or CRM is live | Controlled-demo labels and status vocabulary |

## 15. Architecture review checklist

1. **Layer:** Communications Capture (Layer 1) with Business Memory capture
   substrate (Layer 2).
2. **Build/integrate/defer:** Integrate Telnyx; build canonical normalization and
   evidence handling; defer realtime audio control and live CRM.
3. **Live-pilot path:** Yes; it proves one real call becomes inspectable local
   evidence.
4. **Evidence:** Signed raw events, dedupe IDs, processing states, and canonical
   records are preserved.
5. **Verified outcomes:** It establishes provenance but does not claim a booked,
   completed, collected, or recovered outcome.
6. **Proprietary learning:** It can later provide verified operational examples;
   this first demo alone creates no moat.
7. **Commodity capability:** Telephony and voice conversation remain bought from
   Telnyx.
8. **Duplication:** No CRM, FSM, carrier, or scheduling product is rebuilt.
9. **Lock-in:** Provider payloads stop at the adapter; canonical records remain
   ResponseOS-owned.
10. **Tenant isolation:** Demo account is resolved server-side; every business
    row is tenant-scoped.
11. **Attribution ambiguity:** No revenue attribution is introduced.
12. **Claims:** Only a controlled live-demo claim becomes possible after evidence;
    production-readiness claims remain prohibited.
13. **Human approval:** Provider configuration, number assignment, secrets,
    staging activation, rollback, and prospect access remain human-gated.
14. **Compliance exposure:** Phone numbers, transcript content, and raw events add
    PII/consent/retention risk; Standard lane only.
15. **Required now:** Yes for the bounded post-call proof; live HubSpot, outbound
    calling, Vapi expansion, and scheduling are not required now.

## 16. Open decisions

1. Is the candidate Telnyx number a dedicated demo resource that may be
   reassigned without affecting personal, client, or production calls?
2. Does the founding-demo scope formally permit Telnyx AI Assistant without Vapi,
   consistent with ADR-0045?
3. Which exact Telnyx event or API read is authoritative for transcript messages
   in the selected assistant configuration?
4. Which insight schema represents service need, location, urgency,
   decision-maker status, qualification, and next action?
5. What is the demo tenant's raw webhook and transcript retention policy?
6. What durable post-ack processor is approved for staging?
7. What schema stores all provider correlation IDs and prevents concurrent
   duplicate calls?
8. What safe caller-identity rule applies when the same phone number appears on
   multiple contacts?
9. What disclosure script and recording/transcription policy apply to the test
   caller's jurisdiction?
10. What are the kill-switch owner, rollback trigger, spend cap, and rehearsal
    evidence template?

## 17. Explicit approval boundary

Approval of this PRD means only that the problem, scope, sequence, and gates are
ready for operator review. It does not approve Gate 0 decisions or Stages B–D.

The next authorization, if the operator accepts this PRD, should be a separate
Stage B statement for schema and env-placeholder alignment. It must not include
live adapters, real secrets, Telnyx account configuration, number assignment,
webhook traffic, deployment, HubSpot, or prospect access.

## 18. References

### Repository canon

- [`responseos-platform-doctrine-v1.md`](../strategy/responseos-platform-doctrine-v1.md)
- [`PRD.md`](../PRD.md)
- [`ROADMAP.md`](../ROADMAP.md)
- [`DECISIONS.md`](../DECISIONS.md)
- [`RESPONSEOS_V0_3_READINESS_GATES.md`](../ops/RESPONSEOS_V0_3_READINESS_GATES.md)
- [`responseos-v0.3-founding-pilot-scope.md`](./responseos-v0.3-founding-pilot-scope.md)
- [`responseos-v0.3-live-call-demo-slice.md`](./responseos-v0.3-live-call-demo-slice.md)
- [`responseos-v0.3-live-call-demo-implementation-brief.md`](./responseos-v0.3-live-call-demo-implementation-brief.md)
- [`SECURITY.md`](../SECURITY.md)

### Current Telnyx primary sources

- [Webhook fundamentals and Ed25519 signing](https://developers.telnyx.com/docs/development/api-fundamentals/webhooks/receiving-webhooks)
- [Voice API webhook lifecycle events](https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-webhooks)
- [Attach an AI Assistant to a call](https://developers.telnyx.com/docs/voice/programmable-voice/ai-assistant-start/index)
- [`call.conversation.ended` callback](https://developers.telnyx.com/api-reference/callbacks/call-conversation-ended)
- [Conversation messages API](https://developers.telnyx.com/api-reference/conversations/get-conversation-messages)
- [AI Insight Groups and webhook delivery](https://developers.telnyx.com/docs/inference/ai-insights/insight-groups)
