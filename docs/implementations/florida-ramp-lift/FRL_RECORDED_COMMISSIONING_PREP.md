# FRL-PILOT-008 — First recorded-artifact qualification

Status: PROPOSED / DOCUMENTED_ONLY, November 6, 2026. No runtime gates changed, no deployment and no live window authorized by this document.

## Verified starting point

The scripted Telnyx capture-off call in the 19:20–19:25 Eastern window passed: signed receiving events contained 1, 2 and star, followed by termination. No operator leg or capture artifact was created. See [test report](FRL_SCRIPTED_TEST_CALLER.md). This does not prove Grok keypad capability, worker-outage handling, active manual stop, forwarding or recording.

Last verified deployed commit: `ecfca4bea164677577cf70e84bc12cf56a365a47`. Admission and dispatch were disabled after the call; cleanup remained enabled. Recheck current state before any activation.

## Problem and proposed bounded exception

The recorded schema requires `providerRetentionVerified: true` before a first recording can be produced. Live deletion qualification cannot be obtained from synthetic tests. Setting that flag now would misrepresent evidence.

Propose a separate, explicit first-artifact commissioning mode. Keep normal recorded mode unchanged. This proposal requires scoped acceptance before implementation/activation; a generic approval of disclosure wording does not establish acceptance of this new exception.

- Admit at most one manually approved exact incoming call in a fresh approved window. Keep account, application, number, signed callback, time, consent and concurrency protections.
- Require legal-review reference, receiving endpoint verification, proven manual stop and capture-off watchdog failure qualification before arming.
- Require deployed cleanup, healthy credentials, tested retry/late-artifact handling and documented provider deletion/backup semantics. Record live deletion as pending, never as verified.
- Produce only synthetic name/conversation content under both applicable consents. Retain the existing eight-second name limit and 24-hour maximum from capture.
- Close admission after that call. Request early deletion of all resulting audio/transcripts and reconcile late artifacts. Keep cleanup and signed ingest running.
- Block further capture until local content purge and authenticated provider metadata absence are evidenced, with no unresolved incident. Backup retention is reported separately, not called instantaneous erasure.
- A failed or uncertain deletion blocks further calls and raises an incident. No automatic retry of the commissioning call or new window.

The first qualification call can count toward the two consecutive successful flows only if every success criterion and deletion check passes; a failure resets the streak. Subsequent calls require a fresh agreed window and normal recorded qualification. Do not silently expand the original six-call case budget.

## Recorded caller implementation contract

The existing `pilot:test-caller` is capture-off only and sends star after a fixed delay. Do not repurpose it by changing a flag.

Prepare a separate deterministic Telnyx caller with durable single-use attempt claims and exact caller/receiving leg correlation. Signed stage evidence, not caller ID or fixed sleeps, must drive consent digits, synthetic name speech and hangup. Never expose control tokens in the browser or logs. Preserve tenant-scoped storage and reject foreign, stale, duplicate and out-of-order callbacks.

Recorded admission remains manual. Show a provider-neutral matching-test label instead of the current Grok-specific approval label. The operator remains a human at the private receiving destination and presses 1 or 2 on the actual consent prompt.

Send caller consent only after the receiving consent prompt is ready; speak the synthetic name only during authorized name capture. Do not speak the synthetic conversation before both bridge confirmations and authorized conversation capture. End a successful call normally; reserve star for the explicit withdrawal case. A worker restart or uncertain provider command must never redial or reopen admission.

Tests must establish exact-leg correlation, single-use/replay rejection, refusal without capture, no operator dial before required admission/consent stages, bounded name capture, two bridge confirmations, late transcript deletion, cleanup after admission closes and restart with uncertain commands. Hosted evidence remains distinct from unit/integration results.

## Remaining commissioning sequence

1. Verify active manual stop and controlled primary-worker interruption in a separately agreed capture-off window; retain the shared Render outage limitation.
2. Obtain legal reviewer/date or approval reference. The owner's additional “Approved” reply on November 6 supplies no reviewer/date/reference and is recorded only as owner approval.
3. Resolve provider retention questions below and ratify or reject the first-artifact exception above.
4. Implement and validate the stage-aware caller and explicit commissioning schema; pass repository checks and deploy matching guarded releases with calls disabled.
5. Verify receiving endpoint, defaults-off, destination/spend limits, healthy cleanup and no unresolved calls/incidents. Agree on a fresh window only after these checks.
6. Run the single qualification call and deletion reconciliation; then the remaining success/refusal/no-answer/withdrawal cases in the approved budget. Publish content-free outcomes and deployment IDs.

## Telnyx engineering follow-up — prepared, not sent

For Voice API `record_start` with post-recording transcription:

1. After DELETE `/v2/recordings/{id}` and DELETE `/v2/recording_transcriptions/{id}`, when is content inaccessible and when is it permanently deleted, including backups?
2. Can an in-progress transcription complete or recreate content after either deletion? What supported cancellation/reconciliation sequence prevents this?
3. Which authenticated metadata/list checks establish final absence without downloading media, and is there a consistency delay?
4. What backup retention or additional account storage remains after API deletion, and can it be bounded to our 24-hour test-content policy?

Please provide documented semantics. This is an information request only; no account changes or credentials are requested. Sending this follow-up needs scoped authorization.

Endpoint references checked November 6: [recording deletion](https://developers.telnyx.com/api-reference/call-recordings/delete-a-call-recording), [transcription deletion](https://developers.telnyx.com/api-reference/call-recordings/delete-a-recording-transcription), [transcription listing](https://developers.telnyx.com/api-reference/call-recordings/list-all-recording-transcriptions). The endpoint contracts alone do not establish backup erasure timing or late-transcription behavior.

## Doctrine section 21 review

1. Layer: communications commissioning and trust/evidence controls.
2. Build the bounded harness; integrate existing Telnyx primitives.
3. Resolves the first-artifact verification dependency on the authorized pilot path.
4. Preserves content-free admission, command, terminal and deletion evidence.
5. Reports observed test outcomes only; no business/revenue attribution.
6. Produces operational test knowledge, not proprietary model training.
7. Buy telecom/DTMF/TTS from Telnyx; do not build a voice platform.
8. No CRM, FSM or workflow platform duplication.
9. Existing Telnyx dependency only; no provider switch.
10. Account-derived scope and exact provider identifiers on every mutation.
11. Synthetic commissioning is explicitly separate from customer outcomes.
12. No production-ready, legal-reviewed or retention-verified claim before evidence.
13. New first-artifact exception needs explicit acceptance; exact-call approval remains.
14. Real recording adds exposure; synthetic content, consent and bounded deletion remain mandatory.
15. Required to commission the already-requested recorded flow; no unrelated features.
