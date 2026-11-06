# FRL activation controls — 2026-11-06

Status: EXPERIMENTAL, implementation and validation in progress. No live test window is open. Existing nonproduction infrastructure was deployed with calling disabled; its earlier deployment does not contain this increment until exact-head redeployment is verified.

## Accepted scope: FRL-PILOT-002

The operator requested implementation of the complete activation plan on 2026-11-06: Grok-only calls, manual approval of each exact incoming call, 24-hour content retention, keypad commissioning before recording, and at most six calls per approved thirty-minute window. This supplements FRL-PILOT-001 and narrowly permits automatic provider/local cleanup for these pilot artifacts under ADR-0064; it does not schedule deletion for other tenants or general demo data. Owner approval is not legal review or approval of the final disclosure wording.

Manual approval replaces caller-ID allowlisting as the admission authority for this pilot. Historical Grok caller IDs were confirmed by the owner, but neither a number nor a signed carrier webhook proves Grok identity. An authenticated operator attests the exact call they just initiated. The server retains the signed application/number/leg/session bindings. Pending candidates expire twenty seconds after provider initiation; queued answer expires by twenty-five seconds, before the configured thirty-second first-command timeout. Competing calls are not admitted and are left to the provider's channel/first-command limits. No automatic answer is permitted.

The pending caller number is visible only to authenticated staff while approval is available and is scrubbed on approval/termination. An approval is single-use, same-origin, account/window-scoped and invalid after hangup, expiry, kill or configuration change. Client-supplied destinations and account IDs are not accepted.

## Interfaces and deployment

- `/admin/frl-pilot` is the authenticated control page. It polls the protected API once per second, shows candidates and keypad evidence, and provides approve/reject and emergency-stop controls.
- `POST /api/admin/frl-pilot` with `{action: "approve" | "reject", runId}` returns 202 when queued or 409 when stale/invalid. An empty body retains the existing irreversible window-stop action. No response proves physical call completion.
- Config now requires `admission: "manual"` and `exercise: "keypad" | "recorded"`, retentionHours 24, maxCalls at most 6 and a window at most 30 minutes. The historical callers array is not an admission grant. Old configs fail closed.
- Keypad exercise permits only answer, spoken keypad instructions and cleanup. It collects signed 1, 2 and star events, never consent grants, dialing, bridging, recording or transcription. Star ends the exercise. Spoken assent cannot substitute for keypad evidence.
- Migration `0016_frl_pilot_deletion` adds `ringing` call status and tenant-scoped durable deletion jobs. Runtime roles require table DML privileges after migration; no migration-owner credentials belong in Vercel or Render.
- `RESPONSEOS_FRL_PILOT_CLEANUP_ENABLED=true` separately enables provider deletion. Keep it, the dedicated credential, DB and immutable pilot config available after admission closes. Do not rotate the window/config until unresolved legs and artifacts are reconciled.

Provider cleanup runs independently of call dispatch so slow deletion cannot delay hangups. Signed, bound recording IDs create deletion jobs even when capture provenance is rejected or permission has been withdrawn. Transcription IDs are tied to the owned recording. Deadline is conservatively no later than 24 hours from run initiation/capture authorization; delayed delivery never extends it. Withdrawal queues earlier deletion and purges local content. Recording cleanup enumerates related provider transcripts, verifies recording application ownership and transcript recording ownership, deletes each resource and verifies metadata absence. HTTP acceptance alone is not verification. Transient failures retry with bounded backoff; overdue jobs remain visible and block approval of another call. Delete responses and media URLs are never logged or downloaded.

Live DB purging does not erase Neon backups. Before activation record the isolated branch's actual restore window and provider backup/deletion terms. Any restored backup must remain isolated with calling and review access disabled until expired content has been purged. Do not claim a verified 24-hour physical-erasure guarantee for provider/internal backups without evidence.

## Accepted duration policy

The owner subsequently approved the accepted revision of [FRL-PILOT-003](FRL_INBOUND_DURATION_AMENDMENT.md): application deadline, separate watchdog and manual stop, with explicit residual risk of calls exceeding five minutes. This supersedes the historical carrier-enforcement gate below. Hosted watchdog qualification remains pending; calling stays disabled. Current schema uses `providerRoutingLimitsVerified` and `durationPolicy`, not the old `providerCallLimitsVerified`. Qualification flags must remain unset until supported by evidence.

### Historical provider-duration investigation

Follow-up: the owner supplied a negative Telnyx support response and requested [FRL-PILOT-003](FRL_INBOUND_DURATION_AMENDMENT.md). That proposed amendment compares provider controls and defines qualification gates; it does not authorize a provider switch or weaken the inbound limit. The inquiry below was subsequently sent with owner authorization; its original draft is retained for context.

Current official Call Control OpenAPI inspection found `time_limit_secs` only on `CallRequest` (dial) and `TransferCallRequest`. `AnswerRequest` has no duration field; `CallControlApplicationInbound` exposes channel limit, SHAKEN/STIR and SIP subdomain settings, not an inbound duration cap. This establishes a documentation gap, not proof that Telnyx has no account-side capability. First-command timeout, record_max_length and the outbound leg's time limit do not satisfy the required independent inbound five-minute cap.

**Activation remains blocked.** Never set providerCallLimitsVerified to true based on the controls above. Proposed amendment FRL-PILOT-003 remains DOCUMENTED_ONLY and unapproved: if Telnyx confirms the current architecture cannot enforce the inbound cap, evaluate a provider-enforced inbound execution boundary before any new architecture is implemented. Preserve the five-minute limit, consent intervals, operator approval and terminal evidence requirements; do not adopt a worker-only watchdog or silently switch to TeXML.

Original support inquiry (subsequently sent with owner authorization):

> For a Telnyx Voice API / Call Control application receiving PSTN inbound calls, can Telnyx enforce a maximum 300-second lifetime on the original inbound leg, including the interval before bridging, independently of our webhook and worker availability? AnswerRequest and the inbound application schema do not expose time_limit_secs. Please identify the supported account/application setting or API field, when its timer starts, and whether it remains effective across bridge and worker outages. We need a configuration/readback method and terminal event semantics. We are not requesting activation or changes to existing connections.

Sources: [Answer](https://developers.telnyx.com/api-reference/call-commands/answer-call), [Dial](https://developers.telnyx.com/api-reference/call-commands/dial), [Application update](https://developers.telnyx.com/api-reference/call-control-applications/update-a-call-control-application), [Delete recording](https://developers.telnyx.com/api-reference/call-recordings/delete-a-call-recording), [Delete transcript](https://developers.telnyx.com/api-reference/call-recordings/delete-a-recording-transcription).

## Commissioning sequence and acceptance

1. Pass exact-head local/CI checks, migrate only the dedicated pilot DB, deploy the same SHA to Vercel/Render with auto-deploy off, verify runtime privileges and protected controls. Keep all admission/provider activation off.
2. Close the independent inbound cap and backup/retention gates; install the dedicated credential without displaying it. Verify defaults off, US destinations, one inbound/outbound channel and $2/day outbound spend cap. Verify invalid/missing/stale signatures cannot mutate.
3. Agree on a keypad-only window. Owner initiates Grok and attests the pending call. Prove signed 1, 2 and star events. Stop if Grok cannot produce real keypad events; no consent redesign is implicit.
4. Present exact caller/operator recording and withdrawal wording for approval and choose a fresh 30-minute Eastern-time recorded window, max six admitted calls. Open admission last, only after healthy ingest/worker/cleanup, independent endpoint and zero unresolved incidents are verified.
5. Run two consecutive successful full recorded calls, caller refusal, operator refusal/no-answer, withdrawal and controlled outage. Synthetic content only. Verify name interval, both bridge callbacks, dual tracks, transcript correlation and terminal cleanup. No unknown outcome may be labelled successful.
6. Close admission first. Preserve ingest/worker/cleanup until reconciled; then disable dedicated calling resources. Verify provider/local content deletion by deadline and publish content-free evidence. This qualifies only a supervised nonproduction pilot, never production or unattended operation.

## Doctrine §21 review

1. Communications and trust layers. 2. Build exact-call authority and durable cleanup; integrate provider deletion. 3. Required for the accepted Grok pilot. 4. Preserve signed receipts and content-free consent/deletion audits. 5. Verify call behavior, not revenue. 6. No learning/memory. 7. Buy telecom/storage/speech. 8. No duplicate CRM/FSM. 9. Telnyx wire details stay at the boundary. 10. Server-bound tenant plus privileged session and scoped operations. 11. Caller identity explicitly operator-attested. 12. No live-readiness claim before rehearsal. 13. Adds single-use human approval; existing disclosure/window gates remain. 14. Minimize retention with verified deletion; backup uncertainty remains explicit. 15. Necessary for this requested pilot.

## Validation for this increment

Local lint, typecheck, production build, 891 unit tests in 68 files and 208 PostgreSQL 16.15 integration tests in 16 files passed on 2026-11-06. The focused pilot suite contains 20 integration cases. Provider transport remains synthetic in tests. Local Node/npm differ from repository pins as noted in the baseline runbook; CI must pass on the final commit before readiness for review. No live call or deletion of live media was used as test evidence.
