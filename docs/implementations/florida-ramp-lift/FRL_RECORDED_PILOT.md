# FRL recorded pilot implementation

**Current increment:** [activation controls](FRL_ACTIVATION_CONTROLS.md) supersede the baseline below where they specify manual admission, keypad exercise, 24-hour retention, provider deletion and six-call/thirty-minute windows. The earlier no-hosted-deployment statements below describe the initial implementation validation; nonproduction infrastructure was subsequently deployed with calls disabled. No live recorded test has occurred.

Status: EXPERIMENTAL, implementation under review. The operator authorized implementation on 2026-11-06 after accepting FRL-PILOT-001. No hosted migration, deployment, provider configuration or live call has occurred. The first deliverable includes the full consent-gated recorded path; there is no separate capture-off-first release.

## Call behavior

1. Admit only the configured test number, application, active account, allowlisted caller and time window. One unresolved call at a time; at most ten calls in a window of at most one hour. The operator endpoint must differ from the inbound number and all test callers.
2. Answer, play the existing greeting and consent prompt, and collect one keypad choice. The provisional disclosure adds star-key withdrawal instructions. Refusal, invalid input or silence permanently closes capture permission for that call, while still offering a non-capturing connection.
3. Following caller consent, ask the existing name prompt. A beep begins an eight-second, inbound-only name recording. Require a signed recording-saved event with matching command/leg/session, recording ID and bounded start/end before dialing the operator. No operator leg or consent is invented for this interval.
4. Play the existing hold/decline prompt. Originate one operator leg with a twenty-second answer limit and an absolute remaining call lifetime. No automatic bridge, recording, streaming, assistant or answering-machine capture is requested. An uncertain dial is never automatically repeated.
5. Operator keypad acceptance is required. Press 1 accepts with consent; press 2 accepts without capture. No input or hangup does not bridge voicemail. Explicit bridge follows acceptance, and both independently bound legs must report the bridge before the conversation recording can be queued.
6. Record both tracks in dual channels only if both parties granted both artifact scopes. This is a new capture window, separate from the name window. Use Telnyx post-recording transcription, tied to the saved recording ID and exact authorized interval. There is no real-time transcription stream to infer a stop acknowledgment for. Name text stays caller-provided/unverified.
7. Either hangup terminates the counterpart. Star immediately withdraws local authorization, purges local transcript content, cancels pending capture starts, and queues recording stop plus both hangups. HTTP success is only command acceptance. Terminal signed callbacks, not accepted requests, establish termination. Unknown dial/termination remains an incident and blocks the next admission.

## Durable boundaries

Migration `0015_frl_recorded_pilot` adds `FrlPilotRun`, `FrlPilotCommand`, and `FrlPilotArtifact`. Canonical `Call` holds a content-free call stub; it does not receive a transcript, summary, contact enrichment or recording URL. Artifacts live in the separate consent-aware table to avoid exposing them through legacy call readers or CRM exports. The existing Telnyx CRM block and Phase 2 transcript checks remain in force.

The mounted `/api/webhooks/telnyx/calls` handler verifies the existing Ed25519 signature/freshness before entering the pilot. It accepts a maximum 256 KiB body. Under an account advisory transaction lock it commits the content-free existing `WebhookEvent` receipt, state transition, consent audit and command intent together. It never acknowledges uncommitted transitions. A transcript arriving before its recording evidence rolls back and returns 503 for provider retry, without staging text in the raw ledger. First authorized transcript wins; later duplicate content cannot overwrite it.

The worker claims once durably, rechecks configuration, account activation, expiry, kill latch and consent, then dispatches. A crash between claim and result is marked uncertain after ten seconds and causes cleanup, never another dial. Dispatch and consent changes serialize under the same account lock. A provider request can already be in flight when withdrawal arrives; bounded recording and immediate cleanup limit exposure, and late content is rejected. No claim of zero network latency is made.

Only the configured account is queried. Account status must be `active`; a non-null `setup_draft_json` deny marker is also honored when #236's additive column is present. Protected config is fingerprinted per run. Do not rotate config/application/credentials while unresolved legs exist. Cleanup remains eligible when the admission flag, window or tenant closes; keep worker, credentials, DB and signed ingest available until terminal evidence is reconciled.

## Configuration and operator controls

Install values only through the separately approved nonproduction secret workflow. `RESPONSEOS_FRL_PILOT_CONFIG` is strict JSON validated by `pilotConfigSchema` in `lib/communications/pilot/config.ts`:

| Fields | Meaning |
| --- | --- |
| `version`, `mode` | Exactly `FRL-PILOT-001`, `SUPERVISED_PILOT` |
| `admission`, `exercise` | Exactly `manual`; separate `keypad` or `recorded` exercise (FRL-PILOT-002) |
| `accountId`, `applicationId`, `number`, `operator`, `callers` | Verified server bindings, E.164 US/NANP numbers; no client-selected destinations |
| `deploymentId`, `databaseTargetDigest` | Must match the protected `RESPONSEOS_FRL_PILOT_DEPLOYMENT_ID` and SHA-256 of JSON `[database hostname, port (default 5432), pathname]`; no credentials enter the digest. Vercel production and the existing evergreen demo number are denied |
| `windowId`, `opensAt`, `closesAt`, `maxCalls` | New approved UUID/window, ISO UTC timestamps, thirty minutes maximum, 1–6 calls (FRL-PILOT-002) |
| `disclosureVersion` | `frl-recorded-v1`; includes the provisional caller/operator and star-key prompts |
| `legalApprovalRef`, `retentionApprovalRef`, `retentionHours` | Actual approved evidence references; retention exactly 24 hours (FRL-PILOT-002). Owner wording approval is not legal review. |
| `independentEndpointVerified`, `providerCaptureDefaultsOff`, `providerRoutingLimitsVerified`, `providerRetentionVerified` | True only after verification; routing limits cover US destination, concurrency and spend |
| `durationPolicy` | FRL-PILOT-003 application_watchdog mode, actual riskApprovalRef, qualified independentWatchdogVerified and manualStopVerified; no carrier duration guarantee |

Separate flags default off: `RESPONSEOS_FRL_PILOT_ENABLED`, `RESPONSEOS_FRL_PILOT_WORKER_ENABLED`. The transport reads only `RESPONSEOS_FRL_PILOT_TELNYX_API_KEY`. Existing signed-ingest and public-key configuration remain required. `RESPONSEOS_FRL_PILOT_KILL=true` denies new work and schedules cleanup. Credential absence makes the worker a no-op; the app still boots without secrets.

After approval/configuration, run `npm run pilot:preflight`. It prints booleans only and never contacts Telnyx. Passing means configuration is present, not provider or legal readiness. Run `npm run pilot:worker` in a supervised worker process with one-second polling; `-- --once` is available for one iteration. This is not a serverless cron that can safely be invoked once per minute. No service or live worker has been installed by this change.

`GET /api/admin/frl-pilot` provides the configured window's status and unexpired artifacts to authenticated operators/admins only. It returns no mobile destination, call-control tokens or recording URLs. Hosted auth must be required. `POST` to the same route, with a same-origin header and an authenticated operator session, durably latches emergency stop for the entire window. It cancels admission and queues cleanup; a 202 response does not mean calls have ended. The latch cannot be cleared through this API.

Local transcript expiry is enforced on read and purged by the worker. Provider audio is referenced by ID only; no signed/public media URL is retained or fetched. Provider-side deletion/retention must be commissioned and verified separately. Post-recording transcription may already be queued at the provider when permission is withdrawn; the local runtime rejects/purges such content but does not claim to cancel provider processing. This remains a legal/retention activation gate.

## Reconciliation and architecture review

Verified bases: default `6f579cc`, #243 `8cc2c45` (includes #241/#242), #235 `33fd9d5`, #236 `6aa7825`. #235 and #236 remain open drafts and were not merged. The pilot avoids their normalization/follow-up/CRM surfaces and honors the inactive setup marker without introducing or changing that column. Their dated migrations do not collide with `0015`. This branch locally integrates the approved policy document; no GitHub PR was merged.

The fifteen doctrine §21 answers in the [activation contract](FRL_PURCHASED_NUMBER_ACTIVATION.md) remain the scope review, with these implementation clarifications: Telnyx supplies carrier, speech and media storage; the bounded controller owns consent/evidence and dispatch; artifacts are quarantined from CRM/memory; no revenue claim is made. The scoped pilot gate does not mutate the frozen prospect policy or enable general recording in `SUPERVISED_PILOT_POLICY`.

## Testing and activation checklist

Automated suites cover the recorded name and bridged path, no-capture refusal, operator keypad acceptance, either-party hangup/withdrawal, invalid/duplicate/foreign callbacks, recording interval/channel rejection, concurrency, durable uncertain outcomes, late operator binding, tenant status/allowlists, content-free receipts, retention isolation and signed route ingress. Synthetic transport replaces every outbound HTTP call during tests.

Before a live test: review this implementation and migration; approve provisional wording including the new operator/withdrawal prompts and both retention layers; select the nonproduction app/database/worker; verify public signed callback reachability without weakening operator auth; configure only the purchased number and dedicated application/profile; verify provider default capture off, US-only destination/spend/concurrency limits, and an inbound call-duration cap independent of worker health; install the private destination and controlled caller allowlist; authorize an exact supervised window.

The supervised rehearsal must prove native callback client-state semantics, recording IDs/timing, both channel coverage, the eight-second name capture, post-record transcript correlation, operator voicemail/no-answer, withdrawal races, provider/worker outage and terminal cleanup. Provider callbacks are not live-proven by fixtures. If either bridge callback or recording provenance differs, capture fails closed. There is no continuous-recording-through-bridge claim, no real customer traffic, and no production-readiness claim.

Emergency procedure: latch stop; keep worker and signed ingest running; verify both terminal callbacks; investigate any uncertain dial using the dedicated provider application; disable only that application/profile if needed after operator approval. Retain the purchased number. Rolling back code does not remove active calls or undo a database migration.

## Provider contract sources (checked 2026-11-06)

- [Dial](https://developers.telnyx.com/api-reference/call-commands/dial): linked, bounded operator leg with automatic bridge disabled.
- [Recording start](https://developers.telnyx.com/api-reference/call-commands/recording-start): bounded recording, selected tracks and post-recording transcription.
- [Recording saved](https://developers.telnyx.com/api-reference/callbacks/call-recording-saved) and [recording transcription saved](https://developers.telnyx.com/api-reference/callbacks/call-recording-transcription-saved): recording ID/interval and transcript provenance.
- [Gather ended](https://developers.telnyx.com/api-reference/callbacks/call-gather-ended) and [bridged](https://developers.telnyx.com/api-reference/callbacks/call-bridged): signed observations, not HTTP acceptance.

## Validation record

Local Windows validation uses Node 24.21.0/npm 11.19.0 (repository pins 24.18.0/11.16.0). A dedicated loopback-only PostgreSQL 16.15 process and disposable synthetic database were created for this work without Docker, hosted DB access or installing a service. Migration deploy, schema-to-migrations diff and seed passed. Local lint/typecheck, 886 unit tests across 67 files and builds with and without the synthetic database passed. The full integration suite passed 204 tests across 16 files; the 16 pilot integration cases were rerun after the final safety changes. Final-head CI evidence is recorded in PR #246. The repository postinstall minimatch compatibility patch is required after `npm ci`.

No private config was installed. `pilot:preflight` correctly reports configuration not ready and live readiness unverified in the default environment. No provider transport was invoked outside synthetic test doubles.
