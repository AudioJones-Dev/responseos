# FRL boundary successor — local review candidate

> Historical checkpoint: the H1 application-gap assessment below describes the pre-runtime candidate. The local runtime successor and signed initialization-route regression are documented in [FRL fingerprint runtime](FRL_FINGERPRINT_RUNTIME_2026-10-18.md). This annotation does not promote hosted readiness.

Owner update: additive fingerprint migration/scaffold and isolated official CLI41.7 verification are now locally approved and implemented. See [scope and evidence](FRL_FINGERPRINT_LOCAL_2026-10-18.md). Runtime fingerprint binding, real keys, hosted migrations and activation remain gated.

Base: frozen `565fcdbc91a0744ea417a8703e029ccf3f629a7b` (tree `46d050ce03770946d33ec4e805df4e5d3fe73e33`). Frozen `457e568` and all other developer branches remain preserved. Work is isolated on `feat/frl-boundary-matrix-20261018`. Exact final SHA/tree, commands, counts, patch and logs belong in the external `boundary-evidence-20261018` bundle, after validation. This document does not certify hosted readiness.

## Bounded changes

- Completed-interaction dispatch now checks retained qualification origin before provider acquisition, reconciliation or send. A legacy/inconsistent call with `review_required=false` and a failed notification previously bypassed this check; the pre-fix reproduction is retained externally. Normal supervised review still had its own gate.
- General content purge, prospect content purge and prospect cleanup take the existing account normalization lock before canonical reads/writes. Normalization rejects a cleaned prospect whose account is cancelled, preventing recreation after cleanup deletes call tombstones. Tests cover normalization-first purge, purge-first queued normalization, cleanup-first queued normalization and post-purge replay. They prove these cooperating writers, not every possible writer or administrative lifecycle change.
- Duplicate ledger registration refuses a conflicting non-null tenant. Backfill updates only unscoped or same-tenant rows atomically. Concurrent first claims cannot replace the winning tenant. This is tenant binding, **not immutable body identity**; the same-tenant changed-body problem remains open.
- Concurrent same-tenant backfills still read correlation aliases before updating; one may lose another's added aliases. That preexisting alias-union race is outside this tenant-ownership repair and is not claimed fixed.
- Deployment identity requires the exact two reported aliases, each independently bound to the returned deployment ID/project/host, with health SHA checks at the immutable host and both aliases. Automatic/user alias classifications accept only unique members of that exact set; current hosted classification and access protection remain unverified. No hosted alias setting changed.
- Offline qualification and full-live validators share the existing forbidden-provider names. Qualification retains its additional effects/credential prohibitions and explicitly labels supplied policy evidence **attested, unverified**. The runbook now names the inactive workflow and exact inputs.

## Existing-path evidence matrix

| Boundary | Executable evidence | Limit |
|---|---|---|
| Qualification start/end | `supervised-tenant.integration`: anonymous/client denial, operator/admin start/end, ended historical interval and later activation | Operators are intentionally cross-tenant; no client-selected tenant authority |
| Consent POST | `call-control-qualification.integration`: anonymous/client known/missing-ID denial; operator/admin grant/refusal/withdrawal; strict extra fields | An external-source grant is rejected as unsupported input, not accepted as a new authority channel |
| Review POST | `call-review.integration`: every action denied to anonymous/client; operator/admin approve/reject and synthetic final-sink dispatch/replay; tenant override rejected | Hosted Clerk sessions not tested |
| CRM list/retry and email retry | `operator-retry-routes.integration`: all roles, server-selected CRM tenant, foreign ID denial, executed deferred callbacks and synthetic write/send positives | Notification operator access is intentionally global; request tenant input cannot change the stored row's account |
| Signature boundaries | `telnyx-signature-route-matrix`: actual Ed25519 verifier on all three routes; missing/bad/stale/modified-raw/missing-time negatives; valid malformed envelope reaches 422 without DB | Valid signature is not business consent; separate integration positives cover processing |
| Qualification sinks/recovery | Historical call with mutable review flag cleared; direct dispatch, repeated retry, actual deferred CRM callback, fresh Node process with real DB readback; all four CRM write methods and email send zero | Requires retained assignment/capture/correlation history; arbitrary privileged history deletion is not solved |
| Recording | Every Call Control test checks carrier action/body for recording enable/start; existing initialization policy tests enforce false | No live carrier configuration/readback proof |
| Consent faults | Actual backend termination before writes and while capture UPDATE waits after consent insert; rollback readback; real COMMIT followed by synthetic lost client acknowledgement; same-key retry produces one start | Lost-ack injection is at transaction wrapper, not packet-level COMMIT loss |
| Concurrent replay/tenant collision | Real signed stale-received retries, concurrent normalizers, one CRM operation; tenant-conflicting duplicate and atomic unscoped backfill races | Immutable changed-body binding still absent |
| Retention | Shared-lock ordering and cleaned/cancelled lifecycle guard regressions | Account lock serializes throughput and does not supply uniqueness for non-cooperating writers |

Five targeted contradictions are interpreted against existing trusted state: (a) cleared mutable review flag does not erase qualification history; (b) `unverified_external` input is rejected; (c) a committed gather timeout rejects late affirmative input and grant; (d) withdrawal rejects a subsequent grant; (e) stale generation DTMF and terminal-state DTMF cannot reopen capture. The existing capture/generation design has no separate prompt-ID envelope. A stronger independent prompt-authority requirement remains **OPEN**, not a claimed G3 implementation. G3 envelopes, SMS and calendar remain outside this package.

The operator-witness consent route deliberately records `occurred_at` at operator recording time; source-time input is rejected. The regression characterizes this and preserves policy. Checklist 5.8's source-effective expectation therefore remains **FAIL / owner semantic decision required**, not PASS. No retrospective source-time authority was added.

CRM reconciliation is different from new business writes. Existing bound uncertain records can be inspected (provider readback) and abandoned by an operator/admin even when historical qualification is present. Adoption already checks `supervisedExecutionAuthorized(accountId, callId)` and remains denied; subsequent execution also remains blocked. Tests characterize this with synthetic readbacks and zero writes. Whether qualification should prohibit provider acquisition/readback as well requires a separate policy decision; this package does not silently change recovery semantics.

## Claude frozen-457 review reconciliation

The supplied historical review and main-clone runbook were read without modification. Its verdict applied only to `457e568`.

| Finding | Current disposition and evidence |
|---|---|
| H1 changed signed body | **Application gap remains.** Additive schema and synthetic identity tests now exist; production ingestion/recovery binding and real keys remain unimplemented. |
| H2 coverage | **Expanded in successor**, per matrix above and exact final logs. Stronger prompt-ID interpretation, source-time semantics and hosted auth remain open; no blanket checklist acceptance. |
| M1 self-attested preflight | **Resolved labeling defect locally.** CLI output explicitly says attested/unverified; authenticated durable readback remains a hosted gate. |
| M2 aliases | **Resolved local contract mismatch.** Exact two-alias set, per-alias readbacks, three-origin SHA checks and negative fixtures. Current hosted aliases/protection are NOT EVALUATED. |
| M3 forbidden provider names | **Resolved locally.** Shared list and negative cases for every name; no values read/disclosed. |
| M4 delayed withdrawal | **Needs decision.** Characterized recording-time behavior; no policy change. |
| M5 consent failure timing | **Expanded locally.** Mid-write termination and committed-then-lost-ack tests; transport-level ambiguity remains a stated test limitation. |
| M6 pipeline absent | **Resolved as implementation in frozen565/successor**, still disabled. Isolated official CLI41.7 version/help and artifact integrity are now verified; hosted activation remains gated. |
| L1 stale runbook | **Resolved locally.** Correct workflow/input names, separate qualification command, manual analysis and two internal rehearsals. Main-clone file unchanged. |
| L2 purge coordination | **Resolved for named cooperating paths**, including cleanup recreation guard. Broader writers/throughput remain limits. |
| L3 auth flag semantics | **Intentional variance.** Runtime treats ambiguous truthy values as requiring auth; preflight permits only exact `1`/`true`, thus stricter. |
| L4 public fixture number | **Resolved in new concurrency test.** Uses fictional `+15555550199`; historical authorized-number validator policy unchanged. |
| L5 checklist counts | **Accepted correction:** 44 offline + 6 intake + 5 hosted. |

## Remaining release gates and owners

1. **Codex / local reviewer:** freeze the successor, run final-tree lint/types/unit/build/config and PG16/17/18 (existing migrations, seed, restore, schema checks and DB build), resolve material findings, publish exact local evidence. No push is authorized. Recheck sessions/deployment triggers before any future publication decision.
2. **Owner/privacy:** local schema/tests and isolated CLI verification were approved and completed. Review the separate production ingestion/recovery scope and real key lifecycle before any runtime binding.
3. **Owner/engineering:** resolve source-effective withdrawal and stronger prompt binding if required; decide readback-only recovery for qualification. No invented authority envelope or automatic model analysis expansion. First demo remains manual operator summary/qualification; propose model-backed expansion separately.
4. **Founder/release operator:** approve the actual control ref and exact control/application pair at release authorization before publication/activation. Keep `enabled=false`, `trustedControlRef=null` and `approvedApplicationSha=null` until a separately reviewed change is approved.
5. **Hosted commissioner, separately authorized:** pinned SHA, exact database/role/schema, compatible migrations/rollback, authenticated tenant review, approved FRL facts/disclosure, number/routing, recording/retention, recipient/callback expectations. Catalogue migrations 0014–0017 do not prove deployed app binding; do not mix routing-lane migrations. Hosted checks 1.6/3.8/4.8/6.5/7.5 are **NOT EVALUATED**.
6. **Operator/founder, separately authorized:** no-business-effects carrier qualification, then a distinct authorized SUPERVISED_PILOT call with approved test records/recipient, frozen human-approved content, real HubSpot readback, provider message ID and inbox receipt. Require two consecutive complete internal rehearsals before Mike-demo readiness.

Proposed dispatch remains: approved refs/heads parameter matches dispatch ref; control SHA equals workflow_sha/control HEAD/remote approved-ref tip; application SHA equals application HEAD and separately approved SHA. Execute controls from the control checkout. Verify source clean before/after build, project/link/env and prebuilt target, build/runtime/deployment SHA metadata, returned host then deployment ID, exact team/project/custom environment, both exact aliases and all three health origins. Any mismatch stops with redacted output. Post-deploy failure may leave effects; no automatic retry/rollback. Shared hosted configuration conflicts require proposed isolation, not an unauthorized setting change. Bypass health is not auth acceptance.

D1–D5 remain binding. Literal variances still require acceptance: imported constants rather than YAML `EXPECTED_*` names, `github.workflow_sha` rather than `github.sha`, explicit false rather than absent-means-disabled. CLI version assertion and isolated installed41.7 version/help are verified; authenticated commands remain unexecuted. No production mutation, provider configuration, credential access, model call, live call, CRM/email/SMS send, migration against hosted data or client contact occurred.

Local successor for item 5.8: see [source-time withdrawal](FRL_WITHDRAWAL_SOURCE_2026-10-19.md). This records the approved development correction; hosted qualification and external acceptance remain gated.
