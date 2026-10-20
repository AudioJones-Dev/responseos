# Watchdog readiness P2 correction

EXPERIMENTAL local successor of frozen app cdf184f7e4f36eb369956d2fef87235d0eada38c
and control 330e4bde70c1718372e15341600705384c8ff1d8. No deployment or activation.

## Contract

Inactive liveness is not watchdog readiness. The inactive service remains
credential-free, returns monitoring/calls/disconnectionEvidence=false, and
offers no ready endpoint. Default one-shot inactive watchdog behavior is preserved.

Every production qualification read now requires exact active mode, enabled=true,
and a successful watchdog sweep completed less than 3000 ms ago. The proof binds
the exact application SHA, control SHA and operator-selected deployment instance.
Missing, unreadable, malformed, future, stale or mismatched proof fails closed.
Admission, provider start/audio authorization and existing session heartbeat
qualification all reuse this gate. Retained exact one-shot termination bypasses
readiness, as it already bypasses admission expiry; loss of monitoring must not
prevent a hangup.

Only the active `--loop` watchdog publishes proof after a sweep with zero failed
sessions. A failed/throwing sweep clears it. Starting a new loop clears prior
proof before its first sweep. A stalled or killed process loses readiness within
3000 ms of its last successful sweep. One-shot sweeps never publish readiness.
The timestamp uses the shared host clock; future timestamps are rejected.
This is bounded recent operational evidence, not instantaneous process-death
detection, independent provider cessation or authenticated disconnection.

When qualification activation is ENABLED, `/api/health` returns 503 without
valid watchdog readiness, and exposes `watchdogReady`. It is dynamic and
no-store. A 200 still does not prove every qualification/consent/provider gate.
With activation disabled, ordinary application liveness remains 200.
`node --import tsx scripts/grok-watchdog-readiness.ts` is a non-mutating local
readiness probe (exit 0 ready; exit 1 otherwise), never a watchdog starter.

## Trusted local transport and hosted limits

The proof is an atomic file on a trusted shared local filesystem:

- RESPONSEOS_GROK_WATCHDOG_READINESS_FILE: absolute path outside source/package.
- RESPONSEOS_GROK_WATCHDOG_INSTANCE: new 16–128 character alphanumeric/underscore/
  hyphen deployment identifier, changed on each commissioned deployment.
- Existing exact RESPONSEOS_APPLICATION_SHA / RESPONSEOS_CONTROL_SHA.
- Exact RESPONSEOS_GROK_WATCHDOG_MODE=active and RESPONSEOS_GROK_WATCHDOG_ENABLED=true.

These values are included in qualificationConfigHash. No old authority is
silently reusable. The watchdog needs directory write permission; consumers
must have read-only access. Files are written mode 0600 and atomically renamed.
No HTTP caller can publish proof. A trusted operator with filesystem write
access can forge it, so consumer write access must not be granted.

This mechanism requires same-host filesystem/clock visibility between watchdog
and consumers. It does not establish a shared mount across independent Render
services or Vercel. Unsupported topology stays blocked; no provider-hosting
compatibility or shared-volume isolation is claimed. Hosted safety checks must
verify permissions, exact instance/release binding, failed/blocked sweeps,
process death and qualification denial. Do not use inactive /healthz as a live
watchdog health check. Independent operator fallback remains mandatory.

No schema/migration, withdrawal guard, consent, one-shot retry, CRM, email,
recording or automatic-transfer policy changes. Application/control remain
disabled. No authority or live credential is issued.

## Doctrine section 21

1. Communications safety and operational evidence.
2. Build a bounded repository-specific readiness gate.
3. Closes inactive-watchdog admission ambiguity before a supervised pilot.
4. Preserve frozen commits, prior evidence and exact new test bindings.
5. Distinguish liveness, recent sweep success and disconnection evidence.
6. No proprietary learning or customer data.
7. Reuse native filesystem and existing sweep machinery.
8. No CRM/FSM/carrier/workflow platform duplication.
9. No provider-specific dependency; hosting topology remains constrained.
10. Existing tenant and exact-call authorization are unchanged.
11. No readiness claim from flags or HTTP 200 alone.
12. Local experimental proof only, no hosted/live readiness claim.
13. Existing release and hosting/activation approvals remain required.
14. No credentials, compliance claims or new retained customer content.
15. Required now to address Claude's P2 before any live call.
