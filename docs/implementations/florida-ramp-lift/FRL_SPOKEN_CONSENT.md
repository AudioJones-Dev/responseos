# FRL-PILOT-009 — Spoken consent

Status: DOCUMENTED_ONLY. Owner authorized moving toward spoken consent on November 7, 2026. Detailed disclosure review and implementation remain pending. No runtime, provider setting or live window changed.

## Intended experience

The caller hears a disclosure and says “yes” or “no.” The receiving operator separately answers the same choice. Keypad entry is optional, not the primary interaction. Silence, contradictory answers, recognition errors and model uncertainty never grant consent. One clarification is allowed within the existing deadline; a second unclear response follows the existing no-consent/no-answer behavior. No repeated persuasion.

Conversation capture still requires both participants' affirmative grants and both bridge confirmations. Caller name capture still requires the caller's affirmative grant and remains bounded to eight seconds. Caller refusal permits forwarding without name or conversation capture. Operator refusal forbids conversation capture. Declining the operator connection must remain distinct from accepting it without recording.

## Draft disclosure text — not approved wording

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

When capture is refused, stop speech processing beyond what the separately reviewed consent interaction permits. No continuous conversation transcription may run merely to detect a later refusal on an already unrecorded call. A party can hang up normally; ordinary hangup and withdrawal remain distinct audit outcomes.

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
