# FRL Phase 2 — consent before persistence

Phase 3 successor: [synthetic orchestration and unresolved capture/topology gates](FRL_PHASE3_ORCHESTRATION.md). It preserves this ingestion boundary and does not grant durable authority from simulated events.

**Status: EXPERIMENTAL, synthetic validation only. Not safe for real FRL calls.** Builds on PR #241 at `1d6c7aa0dba99d4d467c0f7728de0e0529449843`; architecture PR #240 remains proposed. No provider command, hosted migration, CRM write or deployment is authorized by this document.

## Addressed path

Previously the calls route verified a signature, resolved a destination and stored the entire webhook before normalization. The normalizer accepted transcript/insight fields without consent, created contacts/leads, and finalized-call processing could invoke CRM. Signature provenance did not establish consent.

The existing path now has these boundaries:

1. The route retains its signature/freshness check and server-owned destination mapping. Invalid signatures mutate nothing. Missing credentials leave ingestion disabled.
2. `recordWebhookEvent` replaces **all Telnyx raw bodies** with a canonical payload SHA-256 receipt and drops signature headers. Event identifiers are stored as dedupe hashes and unsupported event types become a fixed label, preventing those fields from retaining disguised content. Unknown fields, nested transcripts, summaries, recordings and consent claims are not retained. Expired payloads remain purged tombstones. This also protects other callers of the shared ledger writer, including assistant initialization.
3. The normalizer requires an unexpired, signature-verified ledger receipt bound to the same account, event ID and exact payload digest. Legacy raw receipts, rejected deliveries and changed-body replays cannot authorize content. It never creates consent from a webhook.
4. Routing events use an explicit typed projection; extra fields are discarded. Routing metadata can be processed without capture consent. There are no live route/bridge commands in this increment.
5. The only supported content shape is a bounded string transcript on `call.conversation.ended` with explicit start/end timestamps, call-control ID, leg ID and the complete participant-leg roster. The interval must fit the durable authorization; event time is not used as a substitute for capture time. Unknown shapes, recordings, free-form insights and unproven speech-to-text events fail closed. Extra fields are never forwarded to persistence.
6. Transcript authorization and canonical writes share one transaction and a per-account/provider-call PostgreSQL advisory lock with consent changes. Only a matching canonical call, acknowledged transcription start, all-participant acceptance, unexpired interval and exact roster permit insertion. Revoked calls reject **all later deliveries**, even segments claiming an earlier interval. A topology change, transfer failure or provider failure closes capture. All bridge notifications conservatively invalidate capture until a future reviewed controller can prove the new topology.
7. Reuses `CallSegment` and `CallTranscript`; segments preserve capture times and assemble in capture-time order. Receipt metadata links the segment to consent ID/revision, call, legs and interval. `speaker_verified=false`; the mixed transcript is not represented as a verified individual speaker. Event dedupe prevents duplicate segments.
8. No automatic CRM call remains in the route. `runCrmSyncForCall` also refuses Telnyx-originated exports, including direct retries, with `review_required / telnyx_consent_export_blocked`. This restriction applies to legacy demo calls as well as FRL. Restoring export needs a separately reviewed consent-aware proposal executor.

No migration retroactively scrubs old content. Existing legacy content is not accepted as consent evidence, cannot initialize a new capture session, and cannot be exported through the guarded Telnyx CRM path. Historical cleanup requires its own approved retention operation.

## Durable authority and migration

Migration `0014_call_capture_consent` adds one `CallCaptureConsent` table using existing tenant IDs, canonical call IDs and Prisma conventions. JSON state is validated against a strict schema: disclosure version; participant roles and legs; decisions and times; transcription-only scope; expiry; acknowledged start; revocation; actual acknowledged stop; stop-ack status; event history and revision. Reaching 256 events closes capture without preventing subsequent revocation/stop evidence. Recording permission is always false in this increment. Unique account/call and account/provider-call keys prevent authorization reuse across calls.

An in-memory state machine cannot authorize a later worker, retry or process, which is why durable state is necessary. Creation requires a matching, content-free canonical Telnyx call. Operator-only internal service functions append decision metadata and audit actor/revision in the same transaction. Conflicting reuse of an event ID is rejected. There is **no public consent-writing endpoint**, no webhook grant path and no production controller invoking these writers. An operator assertion in a synthetic test is not proof that a real founder consented or a provider stopped.

Migration is for disposable synthetic databases and CI only. Applying it to a hosted environment requires separate explicit approval, target identity verification and the repository migration/recovery gates. No hosted environment was accessed.

## Adapter and downstream contract

The participant roster and capture start/end interval are **required internal adapter evidence**, not claims that every native Telnyx payload supplies them. Current Telnyx documentation exposes call-control/session/leg identifiers and transcription results; the deployed event mapping and complete participant coverage remain unverified. Until a reviewed controller can supply that evidence, native payloads lacking it are rejected. Reference: [Telnyx maintained voice streaming contract](https://github.com/team-telnyx/ai/blob/main/skills/telnyx-voice-streaming-curl/SKILL.md).

Future Call Control must answer/play/gather DTMF/transfer without opening media capture; resolve a separate founder endpoint; establish independent founder consent; observe new participants; start transcription only after authorization; and correlate actual start/stop acknowledgments. Failed stop/outage means permission stays closed, **not** that audio is proven stopped. No live command executor, recording adapter or fallback dialer is implemented here. The Phase 1 greeting, provisional disclosure, optional unverified name, refusal transfer and early-revocation transfer tests remain intact.

`ConsentedCallProposal` defines the future source-call/segment/consent references, caller-provided identity status, contact resolution, commitments, confidence and mandatory review. It is a type contract only. No extraction or proposal emitter is implemented, and CRM outcome remains `not_authorized`. No authoritative names, pricing, deals, schedules or job records are modified. Business-memory retrieval remains v0.4+ gated.

## Validation and limits

Unit coverage includes both-party authorization, no-consent, decline/timeout/revocation, failed stop, provider/transfer failure, additional participants, interval boundaries, out-of-order acknowledgment, duplicate/conflicting decisions, routing projection, content-free receipts, invalid signatures, missing credentials and the preserved mock flow.

Database regressions exercise missing/declined/revoked consent, authorized source-linked transcripts, unsigned receipts, account mismatch, unexpected topology, concurrent duplicate delivery, out-of-order transcript segments, changed-body/rejected replay, internal-writer role checks and CRM export rejection. These tests are synthetic; they do not prove telephony, speech quality, physical capture-stop or forwarding behavior.

Local lint/typecheck/unit/build results and exact-head CI results are recorded in the draft PR. Local integration invocation fails without `DATABASE_URL`; the unresolved AgentOps Docker hold prevents local database provisioning. CI uses disposable PostgreSQL 16/17/18 databases. No claim of local integration success is made.

## Before live testing

Required: human review/merge and green exact-head CI; approved migration to an independently verified nonproduction target; counsel-approved disclosure/retention/revocation policy; private account/number mapping; independent founder consent and a non-looping founder endpoint; reviewed Telnyx payload/command mapping; capture disabled at connection level; tested acknowledgments, topology changes, decline, timeout, STT failure, transfer failure, voicemail, kill switch and operator fallback; explicit dedicated-test-number approval with spend limits and monitoring. Raw content must not enter logging/APM at the platform layer. Existing policy still requires explicit v0.3 authorization. No real FRL calls are safe to route based on these tests.

## Doctrine §21 assessment

1. Layer: communications evidence and security boundary.
2. Build authorization policy; buy telephony/STT later; defer live execution.
3. Removes an ingestion blocker but does not validate a live pilot.
4. Preserve authorized segments and metadata-only consent provenance.
5. Supports evidence integrity; proves no commercial outcomes.
6. No proprietary-learning or memory capability claimed.
7. Telecom and transcription remain provider capabilities, not rebuilt here.
8. Reuse existing ledger/transcript/CRM seams; no competing CRM/FSM/pipeline.
9. Consent policy remains provider-neutral; payload projection is Telnyx-specific.
10. Trusted mapping plus account/call/leg checks and transactional isolation.
11. Explicit source/interval and unknown speaker attribution reduce ambiguity.
12. Experimental/synthetic status only; no production-ready claim.
13. Existing human review/live authorization gates remain; no new public approval UI.
14. Content minimization reduces exposure; legal approval remains unresolved.
15. Required now: the existing signed-ingest path had no consent barrier.
