# FRL commissioning pack — 2026-11-06

Capture-off incident: the 19:50–20:20 UTC window was stopped after the owner reported unanswered ringing. Telnyx showed two sequential inbound legs at 19:51:22–19:52:21 UTC and a signed `call.initiated` delivery acknowledged with HTTP 202 / `accepted:false`. Its initial `client_state:null` failed the adapter's optional-string parser before pending admission. Accept null as absent state while retaining identifier validation and command-token requirements. Regression coverage must include null initial state reaching pending admission without answering before exact-call approval. Zero pilot runs or artifacts were created; this attempt establishes no keypad capability. Do not reopen the stopped window.

Status: PREPARATION ONLY. Telnyx-only; admission and capture remain disabled. The owner supplied a negative engineering response and approved FRL-PILOT-003 application enforcement with explicit residual risk. Independent hosted qualification remains pending.

## Disclosure approval record

Owner approved the following exact existing prompts in this chat on November 6, 2026. Reference: `owner-wording-20261106-frl-recorded-v1`. This is wording approval, not legal review, activation permission or a test window. Do not use this reference as `legalApprovalRef`.

**Caller:** Thank you for calling Florida Ramp & Lift. With your permission, this call will be recorded and transcribed to document your request and coordinate follow-up. Press 1 to agree, or press 2 to continue without recording or transcription. To withdraw permission and end the call at any time, press star.

**Operator, capture permitted:** Florida Ramp and Lift pilot call. With your permission, the bridged conversation will be recorded and transcribed to document the request and coordinate follow-up. Press 1 to accept and consent, or press 2 to accept without recording or transcription. To withdraw permission and end the call at any time, press star.

Source: `lib/providers/telnyx/pilot.ts` and the greeting/consent constants in `lib/communications/consent/mock-intake.ts`. No prompt code changed during preparation.

Other existing spoken text, listed for rehearsal (not included in the two-prompt approval):
- Keypad-only: Supervised keypad test. No recording or transcription is active. Please press 1, then 2, then star to end this test.
- Name: Thank you. May I have your first and last name, please?
- Hold: Thank you. Please hold while I connect your call.
- Caller refusal: No problem. We will connect you without recording or transcription. Please hold.
- Operator when caller denied capture: Florida Ramp and Lift pilot call. This call will not be recorded or transcribed. Press 1 to accept the call, or press 2 to accept without recording. Otherwise hang up.
- Unavailable: We are unable to connect your call. Please try again later.

## Configuration worksheet — deliberately not deployable JSON

| Item | Prepared value or outstanding evidence |
|---|---|
| Provider | Telnyx only |
| Account | Existing isolated `acct_frl_recorded_pilot`; keep paused until activation gates pass |
| Application | Existing dedicated `3050271554165278354`; retain inactive |
| Deployment | Last verified runtime commit `ecfca4bea164677577cf70e84bc12cf56a365a47`; recheck before activation |
| Admission | manual; one unresolved run; historical caller IDs do not authorize admission |
| Exercise | separate keypad and recorded windows; never silently change a live window/config |
| Retention | 24 hours maximum from capture; earlier on withdrawal |
| Recorded limits | 30 minutes, at most six admitted calls per approved window |
| Number/operator | Existing dedicated number and private receiving mobile; inject only through approved secret configuration |
| Window UUID/start/end | Unassigned; choose only after technical gates pass; display Eastern time and store UTC |
| Disclosure version | frl-recorded-v1; owner wording approval above |
| legalApprovalRef | Missing; owner wording/policy approval must not be relabeled legal review |
| retentionApprovalRef | Owner's accepted implementation plan; link actual evidence at configuration time |
| databaseTargetDigest | Recompute against the actual restricted runtime target; do not copy a placeholder |
| independentEndpointVerified | Still requires receiving endpoint check; the private mobile is not the pilot DID |
| providerCaptureDefaultsOff | Recheck dedicated number/profile immediately before activation |
| providerRoutingLimitsVerified | Recheck US destination, concurrency and spend controls |
| durationPolicy | application_watchdog; actual risk approval reference; watchdog/manual-stop qualification pending |
| providerRetentionVerified | FALSE / uncommissioned; synthetic deletion tests are insufficient |
| Credential | Runtime authentication verified previously; expires November 13 at 22:00 UTC / 5 PM Eastern; recheck before testing |

The worksheet above describes recorded-mode qualification. [FRL-PILOT-004](FRL_CAPTURE_OFF_COMMISSIONING.md) separates capture-off prerequisites from those outcomes: keypad mode requires an approved window, operator presence, accessible provider stop controls and fresh apply-mode watchdog inventory, without legal/retention/endpoint qualification assertions. Recorded mode retains all its gates. Do not install dummy evidence to make status or preflight green. Authenticated UI access can be verified without a config; API 503 is expected until valid configuration exists.

## Operator check and stop procedure

The first capture-off window on 2026-11-06 was closed before any call was admitted: operator polling initially succeeded, then returned authentication 404s. The pilot page lacked Clerk's browser provider, so no frontend session refresh ran. The page-scoped ClerkProvider fix retains server role checks and the no-credential mock path. Before another window, observe protected polling across at least two session-token refresh periods without reloading; a successful initial page load is insufficient. No keypad or live-hangup qualification was obtained from the aborted window.

1. Sign in at `/admin/frl-pilot`. Verify intended operator identity, not merely a successful public health check. With no valid config, unavailable status is expected; never seed synthetic pending calls into the hosted DB to imitate readiness.
2. Before a future window: verify exact deployment/DB bindings, signed ingest, worker and cleanup health; no unresolved runs or deletion incidents; receiving mobile available; recording defaults off; US-only destinations, concurrency and spend controls unchanged.
3. Approve only the exact pending call corresponding to the supervised test attempt you initiated. Refuse other candidates. No operator destination or provider control token should appear in browser responses.
4. On unexpected behavior, close admission first and press emergency stop. A 202 is a queued stop request, not proof of termination. Check both legs in provider metadata and the controller. If either remains active, use authenticated Telnyx controls to hang up the exact pilot leg; do not modify unrelated calls.
5. Keep signed ingest, credentials, worker and cleanup running until terminal events and late artifacts reconcile. Do not clear the permanent per-window stop latch, reuse its UUID or rotate config to reopen it.

## Staged case sheet

Recorded cases below remain NOT RUN. The separate scripted Telnyx keypad test passed in the 19:20–19:25 Eastern window; see [test report](FRL_SCRIPTED_TEST_CALLER.md). Grok DTMF remains unverified. Use synthetic names such as “Pilot Alpha.” No media downloads or repository copies. Each attempt, including retries, consumes the applicable approved window budget.

| Order | Exercise | Expected evidence |
|---|---|---|
| A1 | Keypad-only approved Grok attempt | Genuine 1, 2 and star events; no dial, recording or transcription; terminal inbound leg |
| A2/A3 | Rejected and expired candidates | No answer/capture; provider termination; expired approval cannot replay |
| B1 | Full success | Caller consent, name capture <=8 seconds, operator consent, two bridge confirmations, dual-channel recording, correlated transcript, both legs terminal |
| B2 | Repeat full success | Second consecutive complete success; failures reset the streak |
| B3 | Caller presses 2 | No name/conversation recording or transcript; forwarding only after operator acceptance |
| B4 | Operator presses 2 | No conversation capture; any previously authorized name artifact remains governed by retention |
| B5 | Operator does not answer/respond | No voicemail bridge or conversation capture; terminal legs |
| B6 | Star withdrawal | Both legs end; local content/access denied; verified provider audio/transcript deletion, including late artifacts |
| C1 | Controlled worker failure | Separate capture-off window after manual stop is proven; measure watchdog timing and both-leg recovery; no carrier guarantee |

B1–B6 already use six calls. C1 therefore needs a separate approved window; no hidden seventh call. A refusal, retry or no-answer variant cannot be bundled into one “case” to evade the call budget. Reconcile the prior window and its cleanup before rotating config.

For each case record: window/run identifier, exact commit/deployments, start/end provider timestamps, consent/bridge/terminal event IDs, recording/transcription IDs, deletion due/verified timestamps, actual result, incident and reviewer. Do not put names, transcript text, media URLs or control tokens in the commissioning report.

## Retention findings and remaining verification

[Telnyx Call Recording help](https://support.telnyx.com/en/articles/5377454-call-recording), checked November 6, states recordings remain available for one year unless deleted. That default does not satisfy this pilot's 24-hour policy. The implemented explicit deletion worker therefore remains required; a passing synthetic test does not establish live provider absence.

Verify both recording and transcription deletion against bound pilot artifact IDs, retry behavior, withdrawal and late completion. Confirm that a 404 means absence under a valid credential rather than an account/authorization mismatch. Keep content-free failure evidence. Verify provider backup treatment separately; do not claim API deletion erases backups immediately. The previously observed Neon six-hour restore window is likewise not proof of physical backup erasure.

Prepared retention follow-up (not sent): For Voice API record_start with post-recording transcription, what are the deletion completion and backup-retention semantics of DELETE /v2/recordings/{id} and DELETE /v2/recording_transcriptions/{id}? Can a pending transcription recreate content after recording deletion, and how should we verify final absence without downloading media? Is there any additional account storage or backup retention we must account for? Please provide documented guarantees; no settings changes requested.

## Readiness ledger

- Implemented and previously validated: manual admission, keypad-only command restrictions, consent controller, durable dispatch/cleanup and unit/integration checks.
- Prepared now: exact wording approval, configuration worksheet, separate-window case allocation, stop checklist, retention follow-up and corrected runbook values.
- Pending: controlled watchdog failure/manual-stop qualification, receiving endpoint check, legal review evidence, provider deletion/backup verification, fresh recorded test windows and live cases. The watchdog is hosted; scripted Telnyx keypad proof passed, while Grok remains unverified. Authenticated operator page access was observed; unavailable API state is expected without final configuration.

The subsequent FRL-PILOT-003 local implementation is tracked in its amendment. No live-test-ready claim is made.

## First recorded-artifact dependency

[FRL-PILOT-008 proposal](FRL_RECORDED_COMMISSIONING_PREP.md) documents the live-deletion bootstrap gate and a bounded qualification path. It is not accepted or implemented. No readiness flag may be fabricated. The additional owner reply “Approved” supplies no legal reviewer/date/reference; legal evidence remains pending.

## Spoken v2 owner approval — November 7

[FRL-PILOT-009](FRL_SPOKEN_CONSENT.md) records owner approval of transient call-control recognition after recording refusal and the exact revised disclosure. Use the separately versioned `frl-spoken-v2` contract for future spoken commissioning; do not reuse keypad wording or a stopped window. Policy/wording approval does not supply legal-review evidence or prove provider-side retention. No live spoken window is assigned.

## November 7 approval update

The owner subsequently stated "Legal is approved." Reference `owner-attested-legal-20261107-chat-01a1b18a` supersedes earlier pending-legal statements in this pack. No independent reviewer identity or legal opinion is asserted. See [disabled release verification](FRL_SPOKEN_RELEASE_VERIFICATION.md). No new call window is open.
