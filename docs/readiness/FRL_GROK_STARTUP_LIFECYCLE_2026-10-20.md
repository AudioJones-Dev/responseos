# Startup admission and inactive lifecycle

EXPERIMENTAL local successor of app
`8b848bdc25ef44a67fd1304c1ce7bb7e30823ded` and disabled control
`dcbaf2e89902431c61459440603fdea9df84fab9`. Those frozen refs and the published
accepted pair remain unchanged. Master, credentials, paid deployment and live
activation are outside this work.

## Startup readiness

The old synthetic socket fixture waited for a persisted realtime receipt.
`bindGrokRealtime` commits that receipt before the subsequent heartbeat completes
and `acceptingAudio` becomes true. A frame sent in that interval is correctly
discarded as startup audio. The fixture now observes actual bridge admission.
This changes test synchronization, not the production consent/admission guards.

The regression blocks the first post-binding heartbeat, proves the receipt
already exists, and requires readiness to remain pending. A carrier ping/pong
barrier confirms delivery of the discarded startup frame. Releasing the gate
then permits exactly the next frame. Both direct TLS and simulated managed-edge
paths are exercised. The previous receipt predicate must fail this regression
in an isolated scratch mutation, without altering frozen sources.

## Inactive hosting lifecycle

The existing one-shot inactive watchdog remains the default. An explicit
long-running inactive health service is now available for local hosting-lifecycle
simulation:

```sh
PORT=3000 node scripts/run-linux-package.mjs watchdog-inactive-service
```

The package launcher discards inherited credentials and activation flags.
Only PORT is forwarded to this mode. The native Node entrypoint requires exact
`RESPONSEOS_GROK_WATCHDOG_MODE=inactive` and a valid port from 1024 through 65535.
It imports no DB, provider, watchdog sweep, or application-service module.

This mode listens on 0.0.0.0 for hosting health probes. GET/HEAD `/healthz`
returns 200 with explicit inactive, monitoring=false, callsEnabled=false and
disconnectionEvidence=false. Other paths/methods return 404. It provides no
call-ready endpoint. Inbound health traffic is permitted; database/provider and
outbound network actions are absent. It cannot transition to active mode.

SIGTERM/SIGINT stop accepting connections and close lingering connections within
one second. Local tests cover repeated probes, partial requests, graceful exit,
same-port restarts and invalid configuration, with business-import/outbound
tripwires. This is local lifecycle evidence only; no Render service was created
or changed. A real hosted supervisor and its restart/health behavior remain to
be checked after release acceptance and appropriate authorization.

## Review and presentation gates

At the start of this work Render exposed only Michael's workspace; no workspace
was selected. Audio authorization must be completed and verified through a
read-only workspace readback before any hosting operation. Claude Code was
installed but logged out. The exact frozen successor must receive Claude review
after user sign-in; a prepared handoff is not a completed review.

Order: exact-release acceptance, authorized hosted safety checks, controlled
calls, then two consecutive rehearsals. None of those future gates is satisfied
by this local change. At 10:30 a.m. Miami on 2026-10-20, if hosted safety checks are
not passing, use a clearly labeled local walkthrough as the presentation
fallback. A live call by 2:41 p.m. is not promised.

## Doctrine section 21 review

1. Communications safety verification and operational lifecycle.
2. Build repository-specific tests and a small inactive health entrypoint.
3. Removes false readiness evidence without admitting a live pilot.
4. Preserve frozen refs, failed CI evidence and deterministic regression results.
5. Claims distinguish receipt, audio admission, inactive liveness and call readiness.
6. No proprietary learning or customer data.
7. Reuse Node HTTP and existing test/container tooling.
8. No CRM, telecom or workflow-platform duplication.
9. Provider-independent inactive process; no lock-in introduced.
10. Tenant logic is unchanged; inactive service reads no tenant data.
11. Receipt and health success cannot masquerade as verified call outcomes.
12. No hosted qualification or live-call claim.
13. Existing approval gates remain; no new authority is issued.
14. No credential/data collection or compliance claim.
15. Required now to resolve the observed CI assertion and verify inactive lifecycle.

Migrations, withdrawal guards, runtime media behavior, one-shot termination and
authenticated disconnection semantics are preserved. CRM, email, recording and
automatic transfer remain disabled.
