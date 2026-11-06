# FRL-PILOT-006 — scripted test caller

EXPERIMENTAL; setup authorized November 6, 2026. No live test completed by this change.

Local validation: lint, typecheck, build, 931 unit tests and 218 PostgreSQL 16 integration tests passed. Dedicated outbound profile: 3087533551797667158. Hosted release and live qualification remain separate checks.

Dedicated caller +1 754-310-2582 (number ID 3087525181090956846), application 3087529317790386093, calls only the existing pilot +1 754-318-0588. No new AI assistant or paid worker. Existing credentials remain in the approved primary Render worker. The receiving pilot application, duration watchdog, signed ingest, stop controls, consent and retention policies remain intact.

The script runs manually in that worker, never on startup. Default invocation is plan-only; `npm run pilot:test-caller -- --apply` requires an open, bound automatic_once keypad window with maxCalls 1, at least two minutes remaining, active non-draft account, arm evidence, no kill, no prior window run, no unresolved runs or deletion incidents, and empty inventories for both applications. `RESPONSEOS_FRL_TEST_CALLER_WINDOW_ID` must equal the fresh approved window ID. The caller claims that window durably under the pilot account lock before issuing one dial. A failure, crash or ambiguous response consumes the claim; never retry it or delete the claim to redial. A later attempt needs reconciliation and a new approved window.

The provider request uses `send_digits_on_answer`: wait 20 seconds, send 1, wait two seconds, send 2, wait two seconds, send star. Ring timeout is 30 seconds with routing retries disabled; the caller-created outbound leg has a 60-second answer-based limit. This is NOT the previously unavailable five-minute inbound-arrival guarantee. Actual tone timing and receipt require live qualification.

No record, stream, assistant or bridge request is present; transcription is false. Before arming, verify both application and number recording defaults off, test outbound profile US-only, one concurrent channel and $2/day ceiling. Keep the receiving pilot's outbound profile disabled. Test application/profile stay disabled between windows. Configure the test application callback to `/api/webhooks/telnyx/test-caller`, not the receiving call ingest route. This endpoint verifies Ed25519/freshness and exact application/from/to, acknowledges lifecycle events without storing/logging payloads or tokens, and performs no provider commands or business mutations. Duplicate callbacks have no side effects. Unexpected event types are rejected, not considered proof of clean capture state; inspect provider artifacts during reconciliation.

Preparation is not readiness: deploy one verified commit to web, primary and watchdog; verify the new route's bad-signature rejection and matching runtime bindings. Configure the disabled dedicated outbound profile. Only then agree a fresh five-minute supervised window and recheck watchdog health and manual stop access. Open receiving admission last. Run the script once. Success requires signed receiving-side answer, 1/2/star receipts and terminal event, both applications' empty inventory, and no recording/transcription artifacts. If any health check fails, stop admission and terminate/reconcile both applications; the existing inbound watchdog does not inventory the separate test caller. Use authenticated Telnyx controls to terminate that leg if necessary. Keep cleanup running.

This replaces dependence on Grok for system tests, not the full recorded deliverable. It proves neither Grok's keypad support nor cross-carrier behavior. No production, CRM/email, Docker or ARO changes.

## Doctrine section 21

1. Communications/test evidence. 2. Integrate native Telnyx digits, build only the bounded launcher. 3. Removes Grok's call-budget dependency. 4. Existing signed receiving receipts plus content-free dispatch audit. 5. Received digits and termination, never HTTP acceptance, prove outcomes. 6. No proprietary learning. 7. Buy carrier functionality. 8. No CRM/FSM/telecom duplication. 9. No additional vendor. 10. Server-owned account/config and account-scoped claims. 11. Explicit scripted caller, no Grok identity assertion. 12. No live/readiness claim before evidence. 13. Existing fresh-window approval and one-shot cap. 14. Capture/forwarding remain off. 15. Required for repeatable commissioning now.

References: [Telnyx Dial](https://developers.telnyx.com/api-reference/call-commands/dial), [received DTMF](https://developers.telnyx.com/api-reference/callbacks/call-dtmf-received).
