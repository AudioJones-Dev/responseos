# Operator End call authorization boundary

EXPERIMENTAL local-only successor to frozen application 7bef9f11a1d3bd0111121d532a2da65e63890bac and disabled control 67c2c65ae6405485f5929fcccc145793c26228c0. Owner approved the final-validation one-shot authority rule and isolated implementation/testing on October 19. No schema addition or migration change. Activation, automatic transfer, CRM, email and recording remain disabled.

## Contract

The operator route authenticates before inspecting the stored account/capture/call/generation. Initial reservation remains durable and uncertain, closes content admission and records call_end_requested. Only the invocation that created the reservation can proceed. Existing claims never authorize a replay, even after a crash, failure, lost acknowledgement or later generation.

Operator-origin requests perform a short final validation transaction. It locks the capture with NO KEY UPDATE (preserving independent receipt FK access), the exact command row and the historical assignment row; compares generation, assignment, session and leg to the reserved capture; revalidates existing exact retained evidence and lifecycle eligibility; and atomically changes the exact claim to operator_end_call_authorized while inserting call_end_authorized with the target tuple and command UUID. A mismatch or audit/transaction failure sends nothing. Command identity/request/status are checked by conditional update.

After commit and release of all transaction/advisory/row locks, the creating invocation sends once using a frozen in-memory target and reconstructed client_state. Later qualification, generation, lifecycle or evidence changes cannot cancel or retarget this authorization. This is a final validated decision, not continuous authorization or a carrier generation compare-and-swap. Existing row locks do not prevent new evidence arrivals or elapsed-time expiry. The durable audit witness is application-owned evidence; no new DB immutability trigger for command/audit rows is claimed.

Result persistence uses a separate short transaction and an exact claim/target/request/status conditional update. It changes only command result fields. Failure or uncertainty never permits a resend. An accepted command is not confirmed disconnection; signed exact-call evidence and permanent call_disconnected_at remain the authority. Consent and withdrawal are never reopened.

Qualification semantics are unchanged: matching stored assignment/account with status qualification; unassigned_at is not a new veto. The actorless endCaptureCall path remains on its prior locked dispatch behavior and creates no operator authorization. This change closes only the operator End call source of blocking. Actorless hangup, other command dispatch and AI-start paths may still hold capture locks across provider waits; withdrawal drain can still time out behind them. Withdrawal continuation, automatic hangup changes, F2, transfer and retention are outside scope. Option B receipt/drain semantics are unchanged.

## Validation and prior evidence

Accepted prior frozen-pair isolated runtime evidence is external in isolated-runtime-validation-20261019/CONTINUATION_RESULT.md and CONTINUATION_RESULTS.json: both trees passed quality checks; app/control unit counts 1111/1108; application integration 397 tests on each PostgreSQL 16/17/18, plus schema/migration/seed/upgrade/restore/DB-build checks. This supersedes older runtime-unavailable statements as a current blocker, not their historical logs. Claude acceptance was relayed by the owner; the original review text was not located.

This successor requires its own exact-commit checks. Evidence and preserved initial failures are external in operator-endcall-evidence-20261019. Guarded reset remains excluded and browser dependencies must not be downloaded. Local synthetic verifiedBytes fixtures test retained authentication-bound identity; they do not prove a real carrier signature or carrier client_state behavior. No real credentials, provider egress or real Vercel CLI/token experiment is authorized.

## Low follow-up, not fixed here

After withdrawal drain, DB guards still permit CALL_RECEIVED, DISCLOSURE_PLAYING and TRANSFER_PENDING while application receipt guards deny them. Claude's Low severity is relayed. Record a bounded follow-up defining permitted post-drain states; do not change migration0025 here or blanket-ban hypothetical future noncapturing transfer.

## Doctrine section 21

1. Call-control orchestration and evidence layer.
2. Build bounded application authorization; retain bought provider transport.
3. Removes operator-send blocking of withdrawal/disconnection, without live activation.
4. Durable reservation and authorization witness preserve evidence.
5. Verified disconnection remains distinct from command acceptance.
6. No new learning capability.
7. Telecom transport remains commodity provider responsibility.
8. No CRM/FSM/workflow-platform duplication.
9. No new vendor dependency.
10. Stored account and exact call/capture/generation remain authoritative.
11. Explicit one-shot uncertainty and pinned witness limit ambiguity.
12. Local EXPERIMENTAL claim only.
13. Owner explicitly approved post-commit pinned-send authority; operational activation remains separately gated.
14. No new recording, retention or real-data exposure.
15. Required for the demonstrated operator-lock contention, not a broader refactor.