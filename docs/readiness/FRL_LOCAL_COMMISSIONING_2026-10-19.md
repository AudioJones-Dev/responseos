# Local commissioning package — 2026-10-19

EXPERIMENTAL local successor of frozen application `952280b904cbe3988121d26727097fdf80899030`. No deployment, provider qualification or activation claim. Original checkout and migrations remain unchanged.

## Operator End call and disconnection

POST `/api/admin/call-capture/:id/end-call` accepts only `expectedAccountId`, `expectedProviderCallId`, and positive integer `generation`. The operator must be authenticated by the existing console authorization boundary; client roles are denied. Account authority comes from the stored capture, with expected fields used only to reject stale/wrong targets. Existing privileged operators retain their cross-tenant role.

The shared hangup path commits a unique capture/type/generation intent and audit under the capture lock before dispatch. Intent starts uncertain. A second locked stage rechecks the exact target and sends only for the creator. Duplicate/concurrent requests and failed/uncertain outcomes never resend automatically. A crash before sending can therefore leave an unsent uncertain command requiring operator reconciliation. No force retry is implemented. Existing automated refusal hangup uses the same ledger path. Closing a call closes content admission and does not grant consent; withdrawn STOPPED/STOP_PENDING state and receipt are preserved. Database write loss after provider acceptance leaves the committed uncertain intent intact.

HTTP 202 means the command ledger was inspected/updated, not that the carrier disconnected. `succeeded` is command acceptance only. HTTP 200 requires retained authenticated exact-call hangup evidence. Provider failures remain visible in `commandStatus`; 503 means result uncertain/unavailable. A refresh reads evidence without sending a command.

The operator console includes withdrawn calls. Disconnection requires a signature-valid retained ledger original whose HMAC identity still verifies, exact stored account/control/session/leg IDs, provider event ID/type, and matching capture/generation client_state. Missing generation, expired/erased proof, mutated bodies, conversation-ended events and command success do not prove disconnection. This conservative requirement may leave a real call unconfirmed if the carrier does not echo the required generation; that behavior needs separate live qualification. No evidence is fabricated from projected metadata. Consent grant/refusal controls are disabled for closed/withdrawn captures; withdrawal remains available. Automatic transfer remains disabled by the prior restricted preflight.

## Validation and review

Run lint, typecheck, unit/UI rendering tests, credential-free build, and the existing disposable loopback PostgreSQL 16/17/18 migration/legacy-upgrade/seed/integration/restore/authority/build matrix. End-call tests cover role denial, exact targeting, concurrency, uncertain and failed provider responses, post-acceptance database failure, withdrawn states, and wrong/unsigned/mutated evidence. No migration is added or rewritten. Final evidence and exact-SHA Claude handoff are stored outside the repository in `../commissioning-evidence-20261019/`.

## Doctrine §21

1. Workflow and evidence boundary. 2. Build the app-owned guard; reuse carrier adapter. 3. Supports supervised commissioning. 4. Durable command intent and authenticated hangup evidence. 5. Distinguishes acceptance from outcome. 6. No learning capability. 7. Carrier service remains bought. 8. No CRM/FSM/carrier replacement. 9. Existing Telnyx adapter only. 10. Stored target and operator authorization. 11. Exact generation reduces ambiguity. 12. Local experimental claim only. 13. Owner approved local implementation; activation remains separately gated. 14. No additional captured content or recording. 15. Required owner commissioning work.
