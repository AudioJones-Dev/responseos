# FRL-PILOT-003 — Telnyx-only inbound lifetime amendment

## Accepted revision — 2026-11-06

The owner supplied Telnyx's negative engineering answer and explicitly approved a replacement failure model: the existing five-minute application deadline, an independent watchdog and supervised manual stop. This revision supersedes the proposed carrier-enforcement gate below for this isolated nonproduction pilot only. Simultaneous controller, network or provider failure can leave calls active beyond five minutes. No hard carrier cutoff is claimed. Calling remains disabled pending hosted qualification and the other commissioning gates.

Runtime status: EXPERIMENTAL, local implementation. `npm run pilot:watchdog` runs separately from the primary worker without database or webhook dependencies. It lists only the configured dedicated application's active calls and sends hangup commands. It cannot answer, dial, record or transcribe. It polls after each scan with a one-second delay and five-second HTTP timeout. Pagination stays on the fixed Telnyx origin; invalid/incomplete inventory is an error, never evidence of no calls.

The backup cutoff is deliberately early: 240 seconds of observed session age or provider-reported duration. It stops all observed related legs. Provider duration is not assumed to start at arrival. Polling and command delays mean this is best-effort application enforcement, not a guaranteed 300-second bound. Session deadlines and stopped-session tombstones persist through temporary absence to catch late child legs. On startup, clock reversal, monitoring gaps over ten seconds or recovery from inventory failure, all observed pilot calls are stopped conservatively. Retries reuse a command UUID per leg; accepted commands are not terminal evidence. A subsequent empty inventory is absence evidence for that scan only; signed terminal events and late-leg reconciliation remain required.

The strict pilot config replaces `providerCallLimitsVerified` with `providerRoutingLimitsVerified` for destination/concurrency/spend controls and `durationPolicy` with mode `application_watchdog`, actual `riskApprovalRef`, `independentWatchdogVerified` and `manualStopVerified`. Do not set either verification flag before operational qualification. Old configs fail closed. Preflight reports recorded qualification, not live health.

Independent runtime configuration: `RESPONSEOS_REQUIRE_AUTH=true`, matching `RESPONSEOS_FRL_PILOT_DEPLOYMENT_ID`, dedicated `RESPONSEOS_FRL_PILOT_TELNYX_API_KEY`, and strict `RESPONSEOS_FRL_WATCHDOG_CONFIG` JSON containing applicationId, deploymentId, closesAt UTC, riskApprovalRef and dedicatedApplicationVerified true only after ownership readback. `RESPONSEOS_FRL_WATCHDOG_ENABLED` and `RESPONSEOS_FRL_WATCHDOG_APPLY` default false. Observe mode never issues commands. No database, Clerk or unrelated credentials belong in this process.

Separate hosting, any additional charges and expansion of the credential's approved recipients remain pending. Deploy one verified commit with automatic deploys off and exact-commit guards. A second loop inside the primary worker does not qualify. Closed admission must not stop the watchdog or retention cleanup. Restart/configure per window only after prior calls reconcile. The watchdog application must be dedicated: this controller intentionally terminates overdue calls throughout that application.

There is no automatic watchdog-health/admission interlock in this increment. The supervising operator must verify apply-mode scan freshness before admission and continuously monitor the count-only output. Loss of fresh scans for ten seconds requires closing admission and manual stop. Test primary-worker failure, watchdog restart, late legs and manual termination in a separately approved capture-off window; record actual timing rather than asserting a hard bound. Simulate simultaneous controller failure locally, without deliberately abandoning a live call. Existing consent, legal-review evidence, retention and fresh-window gates remain in force.

Updated doctrine review: communications/trust layer; small Telnyx adapter; required pilot blocker; content-free evidence; measured termination outcomes; no learning expansion; use supported provider APIs; no PBX build; owner-selected provider; dedicated application scope and unchanged primary tenant isolation; Grok identity remains attested; no carrier guarantee; explicit owner risk acceptance with separate deployment/window boundaries; unchanged consent/retention; limited to this pilot.

## Historical proposal (superseded by accepted revision above)

**Status: PROPOSED / DOCUMENTED_ONLY — 2026-11-06.** Owner correction: the pilot stays on Telnyx. This revision replaces the earlier cross-provider proposal. No provider switch, port, new carrier account, deployment or live-call activation is authorized. FRL-PILOT-001/002 and ADR-0055 remain in force.

## Fixed boundary

Use the existing dedicated Telnyx pilot number and isolated nonproduction infrastructure. Preserve manual approval of the exact signed incoming call before answer, separate caller/operator keypad consent, eight-second name capture, confirmed two-leg bridge, dual-channel conversation capture, correlated transcription and verified 24-hour cleanup with early deletion on withdrawal. Keep existing demo routing, production, CRM, email and Docker untouched.

The original inbound leg must terminate within 300 seconds of provider-observed arrival, including approval, consent, operator ringing and bridging, despite loss of the application/worker. This correction does not waive that requirement. Calling remains disabled.

## Current evidence

The owner supplied a Telnyx response stating that current Call Control has no documented mechanism satisfying the complete inbound requirement. Independent inspection found no duration field on Answer or inbound application settings. Dial/transfer limits do not establish a lifetime limit on the original inbound leg. The support response's other assertions are not automatically treated as verified engineering guarantees.

The inspected [TeXML Update Call contract](https://developers.telnyx.com/api-reference/texml-rest-commands/update-call) also has no TimeLimit field. Changing from Call Control to TeXML alone is therefore not a demonstrated solution. Do not assume that a sequence of XML verbs bounds every callback, redirect, bridge and failure interval.

## Proposed Telnyx qualification path

1. Escalate the precise requirement to Telnyx Voice engineering, asking whether a supported account-side control, managed SIP ingress control or finite TeXML execution design can enforce the original inbound deadline. These are questions to investigate, not capabilities we claim exist.
2. Require the exact configuration/API, timer origin, original-leg scope, pre-answer behavior, bridge persistence, initial-fetch/fallback failure bounds, enforcement jitter, child-leg teardown and observable termination evidence. A sales suggestion or generic watchdog recommendation does not close the gate.
3. If Telnyx identifies a supported design, document its complete call graph and timing proof before implementing it. Let t0 be verified provider arrival and D=t0+300 seconds. No retry or phase transition may extend D. Any answer-relative timer must account for pre-answer time; every interval before timer installation needs its own provider-enforced bound.
4. Preserve approval before answer and capture denial before consent. Any proposed Telnyx routing/architecture change must explicitly preserve callback authentication, tenant isolation, command uncertainty handling, real keypad withdrawal, both-leg terminal evidence, provider artifact ownership and deletion.
5. Qualify the design in a separately approved capture-off window after documentation and synthetic checks pass. Exercise outages before approval, between answer and timer installation, after installation, while dialing and while bridged. Verify the original and child legs end within the stated bounds. No recording during duration qualification.
6. Only after this gate passes, resume Grok keypad commissioning, final disclosure approval, a fresh 30-minute Eastern recorded window (at most six calls), full recorded cases and verified cleanup.

If Telnyx confirms no supported architecture meets the requirement, record that outcome and keep activation blocked. An independently hosted application watchdog would be a different, weaker failure model and requires an explicit owner risk decision and separate amendment. It must never be described as provider-enforced or quietly substituted here. No self-managed PBX is proposed.

## Engineering inquiry — owner reports sent

We are staying with Telnyx and need Voice engineering to assess a supported Telnyx-only design. Our dedicated inbound PSTN pilot must end its original inbound leg within 300 seconds of provider-observed arrival, including unanswered manual approval, consent, operator ringing and bridging, even if all of our application services stop responding. We understand current Call Control Answer/application settings do not expose such a limit. Is there a supported Telnyx account-side setting, managed SIP ingress control or finite TeXML execution design that provides this guarantee? Please specify the exact mechanism, timer origin, pre-answer and pre-installation failure behavior, persistence across redirects/bridging, maximum enforcement delay, child-leg teardown and readback/terminal evidence. If none exists, please confirm explicitly. A worker watchdog, outbound-leg limit or recording-length limit does not satisfy this requirement. Information only: do not change or activate our connections.

The owner reports sending the engineering question on November 6, 2026. This document does not assert that engineering has responded. Independent preparation is tracked in the [commissioning pack](FRL_COMMISSIONING_PACK.md).

## Acceptance evidence

- Documented Telnyx mechanism protecting the original inbound leg and every interval from arrival.
- Configuration identity and immutable deadline evidence, with no fabricated readiness flags.
- Tenant, replay, approval expiry/concurrency and failure tests; no capture/dial before authorization.
- Capture-off outage qualification with original and child legs terminal; unknown outcomes fail closed.
- Independent recording/transcription deletion verification, late-artifact reconciliation and backup terms.
- Final disclosures, Grok keypad proof and explicit recorded test window; two consecutive successful full flows plus refusal, no-answer, withdrawal and outage cases.

The existing Telnyx code remains the deployed baseline. This is a documentation revision only, not a runtime or schema change.

## Doctrine §21 review

1. Communications/trust layers. 2. Integrate supported Telnyx enforcement; defer implementation pending proof. 3. Addresses the specific live-pilot blocker. 4. Preserve signed and content-free command/termination/deletion evidence. 5. Verify call outcomes, not revenue. 6. No learning expansion. 7. Buy carrier enforcement. 8. Do not build a telecom platform. 9. Telnyx remains the owner-selected provider; isolate wire semantics. 10. Keep session-derived tenant and verified callback bindings. 11. Grok identity remains operator-attested. 12. Claim no unsupported guarantee or live readiness. 13. Engineering inquiry, architecture acceptance and supervised windows retain explicit approval boundaries. 14. Preserve disclosures and retention controls. 15. Required now by the unresolved duration gate.
