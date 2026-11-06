# FRL purchased-number pilot — implementation and activation contract

Status: DOCUMENTED_ONLY / proposed, 2026-11-06. No runtime, deployment, migration, provider configuration or live capture is authorized by this document. The operator purchased one new local Telnyx number in the current chat; purchase does not open the live-provider gates. Exact number/resource identities belong in the protected operator setup record, not in runtime source.

## Verified starting point

- Default branch: `6f579cc4bca303c195a2f9ba833a3b389f52d850`.
- #240 architecture: open draft, `bfe950c35b95c29822f923df51a23f1e670d2251`, unratified.
- #241 mock consent/intake: open draft, `1d6c7aa0dba99d4d467c0f7728de0e0529449843`.
- #242 consent-safe ingest: open draft, `8d349c593ac379644cd9f2993f3971e5eea9462b`, based on #241.
- #243 synthetic orchestration: open draft, `8cc2c45c739f8fb802f01fc865324bbdeb0614c0`, based on #242. Its CI run 42238753362 is successful; this proves neither live calls nor deployment.
- The purchased number was shown Active in inventory, with no calling application or messaging profile; forwarding and inbound recording disabled. Active inventory means owned/provisioned, not a commissioned pilot.
- An existing inactive FRL Voice API application has no assigned numbers or outbound profile. Its configured `/api/webhooks/telnyx/call-control` destination differs from #243's `/api/webhooks/telnyx/calls` route. An unauthenticated HEAD returned 302 to Vercel SSO, so public callback reachability was not established. No POST probe was sent.
- #243 plans commands only. Its simulator uses transfer, not independently originated operator dialing followed by explicit bridging. Native callback mapping is not mounted. Capture confirmation returns unknown. Durable command execution is absent.
- #242 stores content-free Telnyx receipts and blocks Telnyx CRM exports. Its capture contract is transcription-only; bridge/topology change closes authorization. The new pilot must preserve these protections until reviewed replacements exist.

## Proposed decision FRL-PILOT-001 — not ratified

Request a narrow amendment to ADR-0051 and FRL G-11: allow recording to be explicitly configured only for the separately authorized, operator-supervised FRL test-number pilot. Default remains false for every tenant and mode. Do not change the prospect-demo policy object or enable recording on existing demo numbers. Approval of this proposal would not itself approve legal wording, deploy a handler, enable provider flags, or authorize a test call.

Recording and transcript permissions remain independent per artifact, per call, with immutable grant/withdrawal events as required by ADR-0055. No general contact-level consent, prior-call consent, synthetic observation or API HTTP success can authorize capture. Both participants need evidence for the specific call and disclosure. The operator playing Mike is not automatically consenting merely by owning the account.

Use Telnyx-originated operator leg plus explicit bridge; no SIP REFER or uninstrumented forwarding. Only calls to the new number are in scope. Existing published numbers, carriers, SIMs and other Telnyx connections are unchanged. Grok is the controlled test caller, not an authority source or trusted consent bypass.

## Two implementation increments

### A. Controlled bridge with capture off

Build and test this increment first. It does not require changing the recording prohibition. Use a truthful provisional no-capture greeting, subject to operator approval: "Thank you for calling Florida Ramp & Lift. This test call will not be recorded or transcribed. Please hold while I connect your call." Do not use the recording-consent script or automatically collect the caller's name in this increment. It is an intermediate engineering test, not completion of the requested recorded pilot.

1. Reconcile #241–#243 with default and overlapping #235/#236 before changing shared ingest, CRM or schema. Preserve inactive-tenant restrictions and the Telnyx CRM block. Recheck all heads and migration names before implementation.
2. Extend the existing Call Control command boundary with dial request/response and trusted operator-leg binding. Reuse signed webhook ingest and content-free receipts. Bind tenant from protected server configuration; never use client-supplied account IDs or a phone number alone as authority.
3. Persist command intent and call transition atomically. Include tenant, call, leg, purpose, idempotency key, authorization revision, state, attempts and deadline. Reuse the existing ledger and audited data access; do not create a parallel raw-event store. A dedicated command outbox requires a reviewed migration, not an in-memory map called durable.
4. A separately gated worker claims commands with transactional concurrency control, rechecks tenant activation, pilot allowlists, expiry, kill switch and authorization before dispatch. No browser/client can supply a destination. Secrets are read only in the server-side provider transport.
5. Timeout after dial submission is an uncertain outcome, not proof that no leg exists. Reconcile provider IDs before retry; do not create a second operator call. Telnyx's documented short command dedupe window does not replace durable idempotency. Terminal errors do not retry. Cap attempts and total lifetime.
6. Correlate caller and operator `call_control_id`, `call_leg_id`, `call_session_id` and server-issued state. Bridge only the expected answered operator leg. An API acknowledgment is not an answered/bridged callback. Require signed, correlated observations and tolerate duplicate/out-of-order delivery.
7. Busy/no answer: play unavailable message to caller, terminate outstanding legs, no fallback to the published number, voicemail capture or automatic redial. Operator answer requires an explicit keypad acceptance to avoid bridging voicemail. Caller or operator hangup terminates the counterpart. Do not assume disabling an application ends existing calls.
8. Keep all automatic record, transcription-on-answer, streaming, AI assistant, answering-machine detection, HubSpot and business-memory options off.

### B. Consent-gated name and bridged conversation

Blocked pending FRL-PILOT-001, approved wording/retention and a reviewed evidence design. Preserve the exact requested greeting/consent/name/transfer/decline prompts from #241 as provisional copy only.

The requested sequence collects the name before dialing the operator, but the current capture schema requires both caller and founder legs. Do not invent a founder leg or pre-grant founder consent to satisfy that schema. Design a caller-only name interval with caller consent, then a distinct two-party conversation interval after operator consent and verified bridge. This needs a reviewed roster/window model and migration; it cannot be solved by changing one boolean.

Bridge closes the name interval. A new conversation interval must cite fresh topology evidence and all required grants; it must never revive a withdrawn/refused call's authorization. Refusal, silence, invalid DTMF or missing evidence means no capture; route on the non-capturing path. Names remain caller-provided and unverified.

Native transcript timestamps do not establish a capture interval or complete participant roster. Define and validate the trusted mapping before writing canonical transcripts. Recording references are accepted only for a proven authorized interval, with retrieval access and retention enforced. Unknown start/stop remains unknown. On withdrawal, immediately close local authorization, cancel queued capture starts, request capture stop and end both legs if physical stop cannot be verified. Do not claim that hangup request acceptance proves media stopped; reconcile terminal provider observations and retain only content-free incident evidence while unresolved.

Do not promise continuous recording through the bridge: the design deliberately separates authorization windows. Prove coverage of both conversation legs in supervised tests before claiming the intended result.

## Protected configuration and deployment requirements

The operator supplies the independently reachable mobile destination directly into an approved server-side secret store, not chat, source, `.env.example`, commits, telemetry or screenshots. Existing `TenantCallRoute.founderDestination` is a data contract, not an installed secret loader. Implement and verify the binding before claiming configuration complete.

Bind exact deployment, database/tenant, Telnyx account/application, purchased number, approved caller allowlist and destination. Validate loop avoidance, separate caller/operator endpoints and E.164 normalization. No hosted database is selected by this brief.

Prefer reusing the inactive FRL application after approval to repurpose it; proposed name `FRL-VOICE-INTELLIGENCE-PILOT`. Create a dedicated outbound profile rather than modifying shared Default: U.S.-only, one operator outbound call concurrently, proposed $2/day cap, no automatic recording. Proposed application limits: one inbound pilot session, five-minute maximum, ten calls per approved window. These are proposed limits, not configured guarantees; verify which provider charges each cap covers and enforce a separate application cutoff.

Deploy only after explicit nonproduction authorization, target verification and approved migration/restore procedure. Use a reachable HTTPS endpoint for `/api/webhooks/telnyx/calls` only after it includes the reviewed controller. Do not globally disable Vercel protection or application authentication. A narrowly scoped webhook access design must permit Telnyx while preserving the protected operator surfaces and fail-closed signature verification. No endpoint hostname is assigned by this proposal.

Verify Ed25519 raw-body signatures, freshness, event dedupe, body/log limits and assignment before any business mutation. Never put API credentials in webhook URLs. Do not repoint the existing application to an incomplete endpoint to make configuration appear finished.

## Acceptance and execution order

| Gate | Required evidence | Current state |
| --- | --- | --- |
| Ownership | Purchased number and no routing assignment | Verified in operator portal, 2026-11-06 |
| Bridge implementation | Correct two-leg lifecycle, durable queue and retry/crash recovery | Not implemented in #243 |
| Local/CI checks | Lint, typecheck, unit, build, tenant-isolated integration tests on exact successor head | Not run for a runtime successor; current change is docs only |
| Synthetic database | Explicitly assigned disposable DB; no shared Docker changes | Not assigned; host Docker hold remains |
| Hosted target | Verified deployment/tenant/DB, migration and rollback approval | Pending |
| Callback | Signed delivery to exact route without interactive SSO, no raw-content logs | Pending |
| Provider setup | Application/profile readback, capture off, allowlists and caps | Pending separate configuration approval |
| Operator endpoint | Secure value installed, independent reachability and loop checks | Not supplied |
| Capture policy | Ratified scoped amendment, approved disclosure and retention | Pending |
| Live evidence | Explicit window; refusal, timeout, duplicate events, busy, voicemail, either-party hangup, outage and stop-failure cases | No live tests authorized by this document |

After A's synthetic checks and separately approved deployment/configuration, authorize one supervised no-capture call. Record two-way audio/leg cleanup evidence without recording or transcripts. Then resolve B, revalidate and separately authorize its recorded test window. No real FRL customer traffic, Mike invitation or public-number cutover is implied.

Emergency procedure to implement and rehearse: close the server dispatch gate; cancel pending non-cleanup commands; issue hangup for every known active pilot leg; verify terminal observations; disable only the dedicated pilot application/outbound profile; preserve content-free metadata and report unresolved media state. Disabling ingest alone is not a kill switch and could prevent cleanup evidence. Retain the purchased number; do not delete/release it as rollback.

## Doctrine §21 review

1. Communications orchestration and evidence/consent layers.
2. Build bounded authorization and durable dispatch; buy carrier/TTS/STT; defer live execution until approved.
3. Addresses the exact purchased-number-to-operator pilot gap.
4. Preserves immutable consent, command intent, observations and safe receipts.
5. Proves routing/capture behavior only, not recovered revenue.
6. Creates no proprietary learning or autonomous memory updates.
7. Telecom, speech and media storage are provider capabilities.
8. Reuses ledger, tenant model, CRM block and provider boundary; no new CRM/FSM.
9. Isolates Telnyx wire commands behind the existing abstraction.
10. Uses trusted server assignment and tenant filters for every read/write/queue claim.
11. Keeps name unverified and requires independent leg/interval provenance.
12. All new behavior is DOCUMENTED_ONLY until code and evidence exist.
13. Requires scoped recording amendment plus existing deployment/configuration/test gates.
14. Recording adds exposure; refusal, withdrawal, retention and counsel review remain blockers.
15. Required to commission the purchased pilot number; excludes unrelated platform expansion.
