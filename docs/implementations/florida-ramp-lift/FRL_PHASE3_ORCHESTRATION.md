# FRL Phase 3 — synthetic call orchestration

**Status: EXPERIMENTAL / PARTIAL / NOT LIVE.** Request planning, deterministic orchestration and signed offline callback mapping are implemented. No live dispatcher or real FRL calling is supported. Full Phase 3 remains blocked by recording policy, topology authorization and capture acknowledgment decisions below. No provider, hosted database, carrier, CRM or deployment changes.

## Reconciled baseline — 2026-11-06

| PR | Verified head | Disposition |
| --- | --- | --- |
| [240](https://github.com/AudioJones-Dev/responseos/pull/240) | `bfe950c35b95c29822f923df51a23f1e670d2251` | Open draft; architecture unratified |
| [241](https://github.com/AudioJones-Dev/responseos/pull/241) | `1d6c7aa0dba99d4d467c0f7728de0e0529449843` | Open draft; greeting/name/revocation-transfer fixes preserved |
| [242](https://github.com/AudioJones-Dev/responseos/pull/242) | `8d349c593ac379644cd9f2993f3971e5eea9462b` | Open draft; reported SHA verified; Phase 3 starts here and stacks on this branch |
| [235](https://github.com/AudioJones-Dev/responseos/pull/235) | `33fd9d5953b1da674ae143e7f6c37b45445f2083` | Open draft on `docs/release-baseline-r2`; follow-up guard/queue overlaps ingestion, normalization and schema |
| [236](https://github.com/AudioJones-Dev/responseos/pull/236) | `6aa78253c5fb4cefabdc2afed0e9f9040eeae69a` | Open draft on master; inactive-account guard overlaps ingestion, normalization, CRM and schema |

All five inspected heads had successful validate and PostgreSQL 16/17/18 checks; Vercel was pending and draft CodeRabbit review skipped. Those checks do not validate this successor. Default-branch baseline was `6f579cc4bca303c195a2f9ba833a3b389f52d850`. The occupied original checkout was preserved; isolated branch is `feat/frl-call-orchestration-20261106`.

#235's human routing and #236's inactive-account prohibition are conceptually compatible: future execution must satisfy both plus consent. Their normalizer/CRM hunks cannot be applied mechanically because #242 intentionally blocks Telnyx finalized CRM processing and unproven insights. Migrations `20261031_call_follow_up` and `20261028_inactive_client_setup` need integration-order/drift review with `0014_call_capture_consent`. Nothing was merged or treated as superseded. This increment leaves the production route, normalizer, CRM executor and schema unchanged.

## Verified provider capability matrix

Reviewed official references, [OpenAPI](https://raw.githubusercontent.com/team-telnyx/openapi/master/openapi/spec3.json), [webhook catalog](https://developers.telnyx.com/data/webhook-events.json), and installed `telnyx-voice-javascript` skill/API details on 2026-11-06. The reduced fixture `tests/fixtures/telnyx/call-command-contracts.json` records the source SHA-256 and tests required fields, property names, types and enums. This is a documentation snapshot, not provider conformance evidence.

Base URL: `https://api.telnyx.com/v2`. All commands below are POST; `:id` is the controlled leg's `call_control_id`. Except dial, documented success is `{data:{result:"ok"}}`: **command acceptance only**. Builders omit automatic recording, streaming, transcription-on-answer, AI assistants and answering-machine detection.

| Capability | Verified wire request / callback | Implemented boundary / remaining proof |
| --- | --- | --- |
| [Answer](https://developers.telnyx.com/api-reference/call-commands/answer-call) | `/calls/:id/actions/answer`; `call.answered` | Plan + routing simulation; no capture options |
| [Speak](https://developers.telnyx.com/api-reference/call-commands/speak-text) | `/calls/:id/actions/speak`; `payload`, `voice`; speak started/ended | Basic female/en-US text; completion requires known command and `status=completed` |
| [DTMF/disclosure](https://developers.telnyx.com/api-reference/call-commands/gather-using-speak) | `gather_using_speak`; `payload`, `voice`; `call.dtmf.received`, `call.gather.ended` | One digit/try, 10s; only final `status=valid`, exactly `digits="1"` accepts. Intermediate DTMF is not consent |
| [Transfer](https://developers.telnyx.com/api-reference/call-commands/transfer-call) | `transfer`; `to`, `timeout_secs`, `target_leg_client_state`; initiated/answered/bridged or target-leg hangup | Independent PSTN route, 20s provider timeout, 30s synthetic watchdog. Failure is target-leg hangup; no invented native transfer-failed acknowledgment |
| [Bridge](https://developers.telnyx.com/api-reference/call-commands/bridge-calls) | `bridge`; JSON **`call_control_id`** is target leg, `prevent_double_bridge=true`; `call.bridged` | Plan only; SDK alias `call_control_id_to_bridge_with` is not the JSON key. Orchestrator uses transfer; Phase 2 invalidates capture on bridge |
| [Outbound creation](https://developers.telnyx.com/api-reference/call-commands/dial) | `/calls`; `connection_id`, `to`, `from`; response control/leg/session IDs, initiated/answered/hangup | Documented only; no dialer, verified caller ID or transport |
| [Recording start](https://developers.telnyx.com/api-reference/call-commands/recording-start) | `record_start`; required `format`, `channels`; recording saved/transcription-saved/error | Wire plan only, never emitted by orchestrator; recording remains prohibited |
| [Recording stop](https://developers.telnyx.com/api-reference/call-commands/recording-stop) | `record_stop`; optional `recording_id`; `call.recording.saved` | Cleanup plan; saved artifact does not prove current capture state; identity/interval reconciliation unverified |
| [Transcription start](https://developers.telnyx.com/api-reference/call-commands/transcription-start) | `transcription_start`; `transcription_tracks` inbound/outbound/both; `call.transcription` | Inbound name-STT plan after simulated all-party consent. No dedicated start-confirmation webhook asserted |
| [Transcription stop](https://developers.telnyx.com/api-reference/call-commands/transcription-stop) | `transcription_stop`; callbacks cease when effective | No dedicated stop-confirmation event asserted; callback silence is not proof |
| [Streaming](https://developers.telnyx.com/api-reference/call-commands/streaming-start) / [stop](https://developers.telnyx.com/api-reference/call-commands/streaming-stop) | `streaming_start` uses `stream_url`; `streaming_stop` optionally `stream_id`; streaming started/stopped/failed | Stop-only cleanup plan. No start or media consumer. Stream correlation needs independent proof |
| [Hangup](https://developers.telnyx.com/api-reference/call-commands/hangup-call) | `hangup`; `call.hangup` | Request is not ended-call proof. Unknown stop raises incident and requests hangup |
| Correlation/retry | Catalog: `data.id`, `event_type`, `occurred_at`, control/leg/session IDs; command dedupe per controlled call; Base64 `client_state` | Trusted tenant binding; all provider IDs match; tenant/call/purpose command keys. In-memory dedupe only; durable dispatch recovery deferred |

The native transcription example has `transcription_data.{transcript,is_final,confidence}`, not a complete participant roster and independently proven capture interval. Event time is not substituted for these facts. Native transcripts and recordings are rejected by the offline mapper and remain subject to the unchanged Phase 2 barrier. No `transcription.started/stopped` events are invented.

`client_state` correlation fails closed; echo behavior during overlapping stop/speak/transfer commands needs sandbox proof. Target-leg identity must come from trusted server correlation, not guessed payload relationships. The mapper deliberately does not create that binding.

## Implemented behavior

`CallControlAdapter` produces descriptions only. `TelnyxCallControlPlanner` has no fetch, SDK transport, key lookup or credential-dependent activation. `confirmCaptureState()` returns `unknown`. No environment flag can enable live execution.

`MockCallOrchestrator` reuses Phase 2's pure consent policy without calling durable writers. It represents the routing stages and imports the exact Phase 1 strings. Founder acceptance is separate on the founder leg; caller acceptance requires the pending keypad flow. Decline, invalid input, no reply or missing founder consent skips speech capture and continues transfer. Name text remains an unverified in-memory label. Name failure/skip/timeout continues transfer.

Requested, API-accepted, explicitly synthetic-observed and unknown capture states are separate from authorization and routing. Synthetic observations cannot be produced by the native mapper and are never written to durable consent. A DB regression proves successful orchestration simulation cannot grant persistent ingestion authority.

Revocation closes permission immediately and requests transcription/recording/stream cleanup. Transfer after active capture waits for synthetic stop observation; HTTP acceptance is insufficient. Five seconds without observation reports `capture_unconfirmed` and requests hangup, without claiming physical stop. Calls that never captured remain transferable. Conflicting event IDs and contradictory command results fail closed. Late observations cannot reopen permission. Participant joins, expiry and provider failure close authorization. Commands and event history are bounded per call.

The synchronous simulator tests both revocation/start-observation orderings and delayed name delivery. This is not distributed concurrency proof. Phase 2 remains responsible for transactional consent/content serialization using its PostgreSQL advisory lock. A future dispatcher must persist intent and recheck durable authorization before execution; no second ledger or webhook route exists here.

Telemetry is an allowlist of hashed account/call correlation and fixed transition/error/state codes. No command bodies, phone numbers, caller names, transcripts, control IDs, provider errors or credentials are logged. Synthetic snapshots are not log payloads. Proposed alerts: unknown stop, mapping mismatch, content rejection, command failure and transfer timeout. Proposed controls: test-number allowlist, call-duration/concurrency/day-spend caps, bounded retry and kill switch. None is activated.

`RoutedCallProposal` extends the existing proposal with direction, call times, routing evidence IDs and transfer outcome, retaining consent/segment evidence, identity status, confidence and mandatory review. No emitter, extraction, CRM mutation or memory retrieval is implemented. Existing Telnyx CRM export remains blocked.

## Unresolved architecture conflicts

1. **Recording:** existing ADR-0051/FRL G-11 constraints and `recordingPermitted=false` remain. A request descriptor does not authorize a recording lifecycle. Recording-start failure acceptance is deferred, not reported as a tested recording workflow.
2. **Post-transfer capture:** Phase 2 closes per-call authorization irreversibly on bridge/topology change. This increment closes before transfer and represents CONNECTED with capture off. A reviewed new-window/roster design is required; revoked consent is not silently reopened. Captured founder conversation and completed evidence emission remain unimplemented.
3. **Physical observations:** documented command acceptance does not establish adequate start/stop evidence for durable permission. The native mapper cannot promote synthetic observation into authority.
4. **Durable execution:** dispatcher, crash recovery, event-to-consent producer and native transcript interval/roster proof remain absent. Signed fixture mapping is not mounted and mutates no business records.

These delimit the safely separable increment. Passing synthetic tests is not full Phase 3 completion.

## Founder endpoint topology — proposal

Recommend a separately reachable **unforwarded secondary PSTN endpoint** for the first future supervised test, subject to operator selection. It minimizes provisioning dependencies; it is not a claim that an endpoint exists. The planner accepts normalized E.164 only, requires a trusted independent-endpoint assertion, and rejects configured forwarded-number aliases. Missing/unsafe route yields unavailable-message/hangup, never fallback to the main line.

| Option | Required evidence / tradeoff |
| --- | --- |
| Secondary mobile/PSTN | Verify carrier/forwarding mode, no hidden endpoint forwarding, caller ID, busy/no-answer and voicemail timing |
| SIP endpoint | Better controlled leg lifecycle; provisioning, authentication, transport/media security, NAT and alias-loop proof required. Not accepted by this planner |
| WebRTC softphone | Potential authenticated availability/consent UI; permissions, signaling, reconnect and audio-device behavior untested. No implementation |

Blind transfer is represented for no-capture routing. Warm transfer needs founder-leg creation, independent disclosure/consent, explicit correlation then bridge; documented only. Consent from a previous call is insufficient. No voicemail capture or answering-machine detection is enabled; machine detection may analyze pre-consent audio. Target busy/no-answer/hangup uses unavailable fallback, no automatic retry to the main line. Failed bridge cleanup, unexpected disconnect, caller-ID preservation, audio quality and leg continuity require supervised evidence. Carrier identity and forwarding mode remain unknown; no carrier account was accessed.

## Schema, validation and activation dependencies

No migration or Prisma change. Existing migration 0014, ledger, signature validator, transcript guard, CRM block and retention remain authoritative. The new regression uses existing PostgreSQL 16/17/18 CI. Local DB invocation fails without a synthetic `DATABASE_URL`; AgentOps Docker hold respected. Exact local and exact-head CI results belong in the draft PR, separate from historical 803-unit/187-integration results.

Before dedicated test-number activation:

1. Human review, resolution of the four conflicts, green exact-head CI, dependency/#235/#236 reconciliation.
2. Explicit v0.3 and dedicated-call authorization; verified nonproduction tenant/database/provider identities, approved migration and recovery procedure.
3. Legal approval of disclosure, independent founder consent, multi-party/interstate handling, revocation/retention and any recording-policy amendment. Current provisional prompt describes recording this increment never starts.
4. Reviewed durable dispatcher/acknowledgment/native-evidence mapping through the existing route, durable idempotency and crash/retry/concurrency tests.
5. Protected mappings, independent founder endpoint, verified caller ID if dialing is added, connection-level capture off, loop prevention and voicemail/failure validation.
6. Kill switch, raw-payload/APM exclusion, incident ownership and spend/duration/concurrency limits; supervised refusal/timeout/revocation/stop-failure/new-participant/transfer/audio-quality evidence.

Production routing/deployment, main-line changes, CRM writes, email and memory retrieval require separate authorization. Future email scope remains the approved FRL mailbox only; no email access was added.

## Doctrine §21 review

1. Layer: communications orchestration above evidence/consent.
2. Build bounded policy/planning; buy telecom/STT; defer transport.
3. Removes command ambiguity without claiming pilot readiness.
4. Preserve ledger and consent/source references; synthetic events are not production evidence.
5. Behavior tests only, no revenue/outcome claims.
6. No proprietary learning or memory.
7. Provider supplies commodity TTS/STT/telephony.
8. No duplicate CRM/FSM/webhook/ledger.
9. Provider-neutral commands, isolated wire mapping.
10. Trusted tenant/call/leg checks.
11. Unverified names; missing transcript provenance blocks ingestion.
12. Experimental partial status, no end-to-end production claim.
13. Existing human/legal/live approval gates remain.
14. No customer data/live capture; future compliance gated.
15. Required to test orchestration without weakening Phase 2.
