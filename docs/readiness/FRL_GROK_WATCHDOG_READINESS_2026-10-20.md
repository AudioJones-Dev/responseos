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

## Caller impact and release acceptance

Readiness loss is a whole-call stop condition for an already admitted call,
not only a barrier to new calls. The media heartbeat and watchdog sweep reuse
the qualification gate. When either observes invalid readiness, the session
becomes terminal; the media bridge clears queued audio, closes both sockets and
requests exact carrier hangup through the existing consumed-once command path.
The caller can experience an abrupt interruption. No spoken warning, graceful
drain, transparent restart or automatic reconnection is implemented.

This can happen when:

- The watchdog restarts/redeploys: it deletes prior proof before its first
  sweep, so that sweep stops an otherwise healthy active session before it
  publishes new proof. A rolling restart is not call-preserving.
- Any sweep reports a failed session, including an unrelated session: the
  global readiness proof is removed even though per-session work is isolated.
- The gap between successful sweep completions reaches 3000 ms. The normal
  one-second pause leaves less than two seconds for the next sweep, scheduling
  and I/O. A carrier termination wait can take five seconds; do not infer a
  safe sweep budget from the nominal polling interval.
- The watchdog dies, stalls, loses access to its proof file, or the proof's
  release/instance binding no longer matches.

Proof expiry is not an exact three-second carrier-disconnection guarantee.
Observation, database availability, dispatch and provider completion add delay;
provider requests can fail or have uncertain results. A stopped session or an
accepted hangup is not authenticated disconnection. The global reservation
remains occupied until the existing exact authenticated terminal evidence
arrives. Operator fallback and monitoring remain necessary.

Restoring proof permits subsequent qualification checks; it never revives a
stopped call, restores consumed commands or reopens consent. Recovery requires
the existing operator and exact-call lifecycle, not replay of the old call.

The owner requested this documentation and regression successor. That request
is not release acceptance of abrupt caller termination or live activation.
Before release acceptance, the owner must explicitly accept this caller impact.
Before any authorized live call, measure successful-completion gaps under the
chosen hosted topology, restart/failure/load and slow-provider scenarios, with
margin below 3000 ms. If that cannot be demonstrated, keep calls disabled and
return for a separately reviewed timing/design change. This successor does not
raise the threshold or introduce a startup grace period.

Local regression coverage exercises active media with missing/expired proof
and failed-sweep publication, expiry during a blocked sweep, and a real loop
process restart's first sweep. It checks terminal state, both socket closures,
no later audio/revival, consumed-once hangup, and the distinction between stop
intent and confirmed disconnection. These synthetic tests do not measure hosted
sweep times or qualify a hosting layout.

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

Mode 0600 requires the same effective owner identity for the watchdog writer
and readers (absent a separately reviewed permission design), plus a shared
host clock and filesystem. Use a read-only consumer mount to enforce the stated
boundary; same-user mode bits alone do not prevent consumers writing the file.
Co-location provides process-level separation, not independent-host resilience.

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

Cross-host successor: [ADR-0080 protocol](FRL_GROK_CROSS_HOST_READINESS_2026-10-20.md) adds an explicit signed-https transport. The local-file mode above retains its same-host constraints; neither mode authorizes hosting or activation.
