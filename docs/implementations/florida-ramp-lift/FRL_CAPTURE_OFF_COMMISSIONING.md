# FRL-PILOT-004 — capture-off commissioning

Status: EXPERIMENTAL implementation. Owner authorized resolving the commissioning configuration gap on 2026-11-06. No live window is established by this document.

## Configuration boundary

The strict configuration is discriminated by exercise. Common tenant, dedicated application/number, release/database binding, exact-call manual approval, retention policy, provider defaults/routing limits, concurrency, six-call maximum and thirty-minute maximum remain unchanged.

Recorded mode retains legalApprovalRef, independentEndpointVerified, providerRetentionVerified and both independentWatchdogVerified/manualStopVerified duration qualifications. These are never inferred from owner wording approval or a successful deployment.

Keypad mode excludes those qualification fields. Its durationPolicy contains only mode application_watchdog and the actual riskApprovalRef. It instead requires this strict commissioning object:

```json
{"approvalRef":"<actual approved capture-off window reference>","operatorPresent":true,"manualProviderStopAvailable":true,"watchdogInventoryVerified":true,"capture":"off","operatorDial":"off"}
```

These are prerequisites for supervised qualification, not claims that hangup, keypad or recorded flow has passed. Before setting watchdogInventoryVerified, verify dedicated application ownership and a fresh successful empty inventory from the independently running watchdog in apply mode with matching release/application/window bindings. Observe-only probes and an old HTTP 200 are insufficient. Monitor scans continuously and close admission on a ten-second gap. ManualProviderStopAvailable means authenticated provider stop controls are accessible to the present operator, not that an actual hangup test passed.

No placeholder is deployable approval evidence. No automatic watchdog-health/admission interlock is added. Existing owner acceptance of application/common-platform failure risk remains required.

## Runtime boundaries

Keypad mode allows answer, the fixed no-capture keypad prompt and stop/hangup cleanup only. The machine and provider request builder both deny dialing, bridging, consent-gathering and capture commands. Digits are test evidence, never consent grants. Signed unexpected artifacts remain subject to content denial and durable cleanup; keep cleanup credentials and ingest available through reconciliation. No DB migration is needed.

Switching exercise alone produces an invalid config. Each mode must validate its own fields, and every configuration has a distinct digest. Do not rotate a window/config until prior runs and artifacts reconcile. Recorded qualification remains a separate approved window.

## First capture-off window

1. Verify one tested commit across web, primary worker and watchdog; preserve authentication and signed/fresh callback enforcement.
2. Agree on exact Eastern start/end and call budget. Plan exact-call approval, genuine 1/2/star evidence and terminal inbound evidence. Rejection/expiry and worker-failure cases have their own call budget; retries count.
3. Owner is present with Telnyx manual stop controls. No operator dialing occurs. Keep recording defaults off and the dedicated outbound profile disabled; verify the inbound binding and first-command timeout before admission.
4. Install matched keypad and watchdog configs. Establish an empty, fresh apply-mode watchdog inventory before admission; do not restart it during a call except the expressly planned failure case.
5. Verify protected controls, invalid/stale signature rejection, restricted DB binding and no unresolved calls/artifacts. Enable only required dedicated resources; open admission last. Cleanup grants no capture permission.
6. Owner initiates Grok and approves its matching pending entry. Stop if genuine keypad events are absent; spoken assent is not consent. Star/manual stop must produce terminal evidence. Queued or accepted commands are not termination.
7. Close admission first; retain ingest, watchdog and cleanup through terminal and late-artifact reconciliation. Record actual latency/outcomes. Set qualification flags only after their actual cases pass.

The full recorded deliverable is unchanged. This stage gathers its prerequisite evidence without recording people or inventing readiness flags.

## Doctrine section 21 review

1. Communications/trust configuration. 2. Build a small mode distinction. 3. Removes the circular commissioning gate. 4. Preserves signed and content-free evidence. 5. Separates prerequisites from tested outcomes. 6. No learning expansion. 7. Uses existing provider controls. 8. No CRM/telecom duplication. 9. No new provider dependency. 10. Tenant/session bindings unchanged. 11. Grok remains operator-attested. 12. No recording-readiness or hard-cutoff claim. 13. Exact supervised window and manual approval remain required. 14. Capture/dial denied at two boundaries. 15. Required for the first supervised test.
