# FRL-PILOT-009 — Spoken consent

Status: EXPERIMENTAL local implementation, November 7, 2026. Owner requested fully spoken consent and withdrawal. Runtime code and synthetic tests are implemented; hosted deployment, legal-review evidence and live qualification remain pending. No provider setting or live window changed.

## Intended experience

The caller hears a disclosure and says “yes” or “no.” The receiving operator separately answers the same choice. Keypad entry is optional, not the primary interaction. Silence, contradictory answers, recognition errors and model uncertainty never grant consent. One clarification is allowed within the existing deadline; a second unclear response follows the existing no-consent/no-answer behavior. No repeated persuasion.

Conversation capture still requires both participants' affirmative grants and both bridge confirmations. Caller name capture still requires the caller's affirmative grant and remains bounded to eight seconds. Caller refusal permits forwarding without name or conversation capture. Operator refusal forbids conversation capture. Declining the operator connection must remain distinct from accepting it without recording.

## Superseded first disclosure draft — not deployed

Caller: “Thank you for calling Florida Ramp and Lift. This automated system uses speech recognition to understand your answer. May we record and transcribe your name and this call to document your request and coordinate follow-up? Say yes to agree, or no to continue without recording the conversation. If you agree, you can later say stop recording to withdraw permission and end the call.”

Operator: “Florida Ramp and Lift pilot call. This automated system uses speech recognition to understand your answer. To accept the call and agree to recording and transcription, say yes. To accept without recording the conversation, say no. To decline the call, hang up. If you agree, you can later say stop recording to withdraw permission and end the call.”

Clarification: “I could not confirm your choice. Please say yes to agree to recording and transcription, or no to continue without recording the conversation.”

These drafts explicitly disclose speech recognition before collecting an answer. They do not promise zero speech processing before recording consent. The prior approved keypad wording does not approve these drafts. Legal review must address preliminary recognition and provider conversation storage; owner approval is recorded separately.

The spoken withdrawal sentence must not ship until its real-time detector and failure behavior are implemented and tested. Retain star as an optional immediate withdrawal fallback; do not require it to complete ordinary consent.

## Telnyx integration

Keep Call Control and the existing dedicated application. Telnyx `gather_using_ai` supports structured spoken results and signed `call.ai_gather.ended` events; no TeXML migration is required. This is a proposed integration, not a configured capability.

Map a final result to explicit agree / decline_capture / unclear. Do not accept a model boolean alone: require a final valid event, an unambiguous affirmative utterance, matching tenant, application, role, call leg, active consent-stage command and disclosure version. Reject mixed answers such as “yes, but do not record,” quoted instructions, partial results, unrelated yeses and replayed grants. Keep any raw utterance ephemeral; store decision, method, event ID, timestamp and disclosure version as evidence without raw speech text.

Do not reinterpret a spoken result as a keypad event. Extend the consent event contract with an explicit input method, retaining existing DTMF behavior for old runs. Strict config must explicitly select the new disclosure/method; do not change the meaning of existing deployed config or stopped windows.

Add durable correlation for `call.conversation.created` before accepting AI gather completion. Conversation IDs must be linked to a verified pilot leg and account, including when callbacks arrive out of order. Never trust a caller-supplied conversation ID, model result or phone number as authorization.

## Withdrawal and consent boundaries

During the initial gather, a clear request to stop ends the call and denies capture. After consent, implement a separately verified real-time speech path for the explicit phrase “stop recording,” on each authorized participant's audio. Do not use delayed post-call transcription for withdrawal. End both legs and invoke existing revocation/local purge/provider deletion on a recognized withdrawal. If the required speech monitor fails, stop capture and end the run; do not silently leave only keypad withdrawal available.

The November 7 accepted transient-control amendment below supersedes the initial refusal rule: transient recognition may continue solely for call controls after capture refusal, with no saved conversation recording or transcript. Ordinary hangup and withdrawal remain distinct audit outcomes.

## Additional retention work

AI gather creates a provider conversation resource. Existing audio/transcription deletion is insufficient: add tenant- and leg-bound conversation cleanup, including refusal, timeout, withdrawal, late creation/completion and failed gathering. Prefer immediate conversation-history deletion after decision extraction; never extend the 24-hour maximum because a callback was late. Keep cleanup running after admission closes.

Telnyx documents DELETE `/ai/conversations/{conversation_id}` for conversation messages and associated data, and explicitly excludes recordings. Verify authenticated metadata absence separately for conversation, recording and recording-transcription resources. Provider backup semantics and any real-time recognition storage remain qualification questions. Do not set `providerRetentionVerified` based on a successful local test or a delete response alone.

## Implementation order and acceptance

1. Ratify detailed design and review the revised disclosures, including pre-consent speech processing and withdrawal semantics.
2. Add explicit consent-method configuration, pure decision validation and signed final-event correlation. Cover mixed/unclear/refused speech, stale events, role/tenant mismatches and DTMF compatibility.
3. Extend durable cleanup for AI conversation resources and test reordered events, retries, refusal and withdrawal without retaining raw content.
4. Implement bounded real-time spoken withdrawal and its fail-closed behavior. Test each leg, monitoring failure, normal hangup and late transcript arrival.
5. Update scripted caller to send synthetic spoken responses at verified stages. Add provider-neutral console wording; never bypass exact-call approval for a recorded window.
6. Pass lint, typecheck, unit, build and non-Docker database integration checks. Deploy matching releases with calls disabled only after these checks.
7. Commission speech recognition with synthetic participants under a separately approved window. This is speech-processing commissioning, not a zero-processing keypad test. Then finish the recorded-flow/deletion cases and independent-stop qualification.

Existing legal evidence, retention, endpoint, duration/watchdog and supervised-window gates remain. FRL-PILOT-008's first-artifact qualification dependency is not resolved by switching to speech.

## Architecture review — doctrine section 21

1. Communications/consent and trust infrastructure.
2. Integrate Telnyx recognition; build only bounded authorization and evidence controls.
3. Removes the caller keypad dependency on the requested pilot path.
4. Preserves signed-event decision evidence; minimizes raw speech storage.
5. Claims only observed consent/test outcomes.
6. Operational learning only, no model-training feature.
7. Buy speech/telephony capability from Telnyx.
8. No CRM, FSM or workflow-platform duplication.
9. Existing Telnyx dependency; no provider switch.
10. Server-owned account scope and exact leg/conversation binding.
11. Synthetic test evidence remains separate from client/business outcomes.
12. No shipped, legal-reviewed or retention-verified claims before evidence.
13. Preserve manual recorded-call approval and explicit window; review new prompts separately.
14. Speech processing before recording consent introduces a new data boundary requiring explicit review and cleanup.
15. Required for the owner's requested lower-friction spoken interaction; no general-purpose assistant.

## Provider sources checked November 7, 2026

- [Gather using AI](https://developers.telnyx.com/api-reference/call-commands/gather-using-ai)
- [Final gather callback](https://developers.telnyx.com/api-reference/callbacks/call-ai-gather-ended)
- [Conversation deletion](https://developers.telnyx.com/api-reference/conversations/delete-a-conversation)

Provider support for gathering speech is verified. End-to-end consent accuracy, live withdrawal and deletion in this pilot are not yet verified.

## Implemented increment — November 7

Local code includes explicit speech configuration tied to `frl-spoken-v2`, final-result/utterance agreement checks, account/application/leg/command/conversation binding, content-free consent evidence, durable AI conversation deletion tasks and separate real-time inbound transcription monitors per consenting leg. Capture starts only after monitor commands are accepted. Refusal prohibits saved capture; transient call-control recognition remains authorized under the owner-approved amendment below. Caller monitoring starts after the disclosure response and continues through hold and operator dialing. Operator monitoring starts after its disclosure response, before bridging. Both monitors remain available on an unrecorded bridge. Both participants can revoke through a recognized “stop recording” phrase, including an interim transcription event. Existing star withdrawal remains available.

The monitor is deliberately conservative: 15 seconds without a transcription event terminates the run and revokes capture. This detects missing observations, not the cause; ordinary silence can therefore end a test. Command acceptance is not proof that recognition is accurate. Provider callback latency, loss, silence behavior and withdrawal latency must be measured in supervised qualification before claiming the interaction is client-ready.

Migration `0017_frl_spoken_consent` adds exact call identity fields to conversation deletion tasks and makes recording parent ID nullable for that resource kind. Existing recording tasks are unchanged. Applied to the isolated hosted pilot database on November 7; see [release verification](FRL_SPOKEN_RELEASE_VERIFICATION.md). Conversations are queued for early deletion after the consent decision or termination; late conversation completion reopens cleanup. Unexpected additional conversations fail closed and are queued separately. Cleanup continues independently of admission.

The request planner sends no prior message history and disables partial-result/history-update callbacks. Final gather history is processed transiently and reduced to a decision; raw words do not enter state, audit or webhook receipts. Actual provider recognition/history/backup retention still requires verification. `retentionVerified` and `withdrawalVerified` must not be set from synthetic tests alone. The first-artifact commissioning exception remains a separate unresolved prerequisite.

No Grok handoff or client-readiness claim is made. The old keypad-only scripted caller remains restricted to its original exercise. The revised exact prompt is owner-approved below; legal-review evidence remains a separate gate.

### Accepted transient-control amendment — November 7

Owner explicitly approved transient speech recognition solely for call controls after recording refusal, and the following exact disclosure. Reference: `owner-transient-controls-20261107-c364b8dd`. This is policy and wording approval, not legal-review evidence, provider retention verification or live-call authorization.

“This automated system processes your speech for call controls, including requests to stop. May we also save a recording and transcript of your name and this call to document your request and coordinate follow-up? Say yes to agree, or no to continue without saving a recording or transcript. Say stop recording to withdraw permission and end the call.”

The same approved disclosure is used for caller and operator. A caller refusal remains binding even if the operator subsequently agrees; no saved conversation capture occurs. Operator yes/no both accept connection with their respective capture choice; hangup declines connection. Disclosure `frl-spoken-v2` requires a separate `transientControlsApprovalRef`. The superseded v1 configuration is rejected rather than silently reinterpreted.

After each response, a dedicated transient monitor must start successfully before the caller proceeds or the operator bridges. Recognition text is reduced to a control event and not stored as conversation content. Both legs retain spoken withdrawal after refusal; saved recording/transcription still require the original capture grants. Missing or uncertain monitor commands end the call without retrying or recording. The 15-second missing-observation cutoff remains experimental.

Provider-side retention of recognition input/output is not established by our decision not to persist text locally. That verification and legal review remain activation requirements.

## Local validation evidence

November 7: lint, typecheck, build and 975 unit tests passed. The full PostgreSQL integration run passed 225 tests; after extending hold-phase withdrawal, the affected pilot suite passed all 38 tests. Migration 0017 was applied only to the retained synthetic PostgreSQL 16 database. Provider requests were mocked in these tests; no hosted speech or deletion claim follows from them.

V2 follow-up validation: 976 unit tests and all 40 affected PostgreSQL pilot integration tests passed, including caller/operator refusal followed by spoken withdrawal without saved capture. Typecheck, lint and build passed. The broader database suite passed before this follow-up; CI reruns it on the new commit. No hosted migration or activation was performed for this increment.

## November 7 disabled release

Runtime f86ab4d is deployed to the nonproduction web app and both workers, with migration0017 applied. Calls remain disabled. The owner subsequently stated "Legal is approved"; this is recorded as owner-attested legal approval, superseding earlier pending-legal statements, not an independently reviewed legal opinion. See [release evidence and remaining retention questions](FRL_SPOKEN_RELEASE_VERIFICATION.md).
