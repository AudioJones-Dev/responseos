# Cross-host watchdog readiness

EXPERIMENTAL local P2 successor to frozen application fd4562f / control 7d433a6.
Codex builds; Claude reviews frozen pairs independently. Grok is the voice
runtime. The owner supplies the FRL knowledge packet. No release acceptance,
hosting, credential injection, deployment, or live activation is implied.

## Contract

`RESPONSEOS_GROK_WATCHDOG_READINESS_TRANSPORT=signed-https` selects the cross-host
protocol. Omitted transport retains the reviewed `local-file` behavior; unknown
transport fails closed. Active mode and enabled=true are still mandatory.

Consumers need a trusted HTTPS URL ending exactly in `/readiness`, the exact
application/control SHAs and deployment instance, and a dedicated 32-byte
random authentication key encoded as 64 lowercase hex characters. The key is
supplied through `RESPONSEOS_GROK_WATCHDOG_READINESS_KEY`; it is never returned
or logged. Consumers also pin `RESPONSEOS_GROK_WATCHDOG_READINESS_PUBLIC_KEY`
(base64 Ed25519 SPKI). The watchdog alone receives the corresponding PEM
private key through an absolute `RESPONSEOS_GROK_WATCHDOG_READINESS_SIGNING_KEY_FILE`,
mounted owner-readable and inaccessible to consumer services. URL, public key
and request-key hash join the qualification configuration hash. No
previous qualification authority is silently reusable.

Every request uses a fresh 256-bit nonce and a domain-separated HMAC of the
nonce and release/instance binding. The watchdog authenticates it and returns
a domain-separated Ed25519-signed response with the same nonce/binding and the age of its last healthy
sweep. Only its active continuous loop starts this listener. Inactive mode
returns before database, readiness listener, or provider imports. A one-shot
sweep cannot serve or publish readiness.

Consumers reject invalid signatures, mismatched nonces/bindings, redirects,
oversize/malformed bodies, errors, or requests taking 500 ms or more. They add
the entire locally measured round trip to the watchdog's reported proof age;
the total must remain strictly below the unchanged 3,000 ms expiry. Requests
always request fresh proof (concurrent readers share one in-flight challenge). On transport failure only, a previously verified proof may be reused until its original monotonic deadline; no failure renews it. Authenticated watchdog denial, invalid signatures/bindings/nonces/bodies, redirects, authorization rejection, or changed release/instance/URL/key/authority digest revoke retained proof. Unsigned 502/503/504 responses are transport uncertainty and can reuse only existing unexpired proof. Responses and redirects are never followed or HTTP-cached. Remote host clock offsets do not enter this calculation. The
watchdog still uses its local clock/file for sweep age; future local timestamps
fail closed. No grace interval, automatic replay, or freshness extension exists.
The proof's remaining lifetime is carried as a local monotonic deadline through
final database reads. Reservation rechecks withdrawal after the proof wait.
Provider authorization then rechecks stored session/capture identity, termination,
withdrawal receipts, qualification deadline/configuration and target assignment;
the proof must still be fresh after those reads. An asynchronous readiness
request cannot grandfather a withdrawal or disabled/expired authority.

The HTTP listener is intended to sit behind an approved TLS edge; direct
unencrypted cross-host consumers are rejected. `/readiness` requires the HMAC
request, so an ordinary hosting health probe must not be interpreted as
readiness. The proof carries no tenant, call, transcript, or provider key.
The request key cannot sign readiness responses. Only the watchdog has the
private signing key. Scope both keys to this one deployment and rotate them
with a newly approved qualification configuration.

The watchdog alone requires its local writable proof file. Other hosts need
no shared filesystem or matching UID. Its own qualification checks use the
writer-owned local proof within an async scope installed only around the active loop sweep. They do not call the public edge while holding session locks. Consumer requests outside that scope still require signed HTTPS; no environment switch grants this local role. Unknown transport, inactive mode, mismatched binding, startup, missing/failed/expired local proof still fail closed. Cross-host qualification hashes omit the host-local proof
path and listener `PORT`; those differ per service. The signed public media URL,
listener configuration contents, exact release/instance, HTTPS readiness URL,
request-key hash and public signing key remain bound. Local-file mode retains
its original port/path binding. A restart clears proof before the first sweep. Missing,
failed or expired proof still ends active calls on the existing
heartbeat/sweep path. Transport failure without an unexpired verified proof remains an additional cause of abrupt
termination. Recovery cannot revive consent, restart a stopped session, retry
a consumed command, or establish carrier disconnection. Retained exact-call
hangup authorization does not depend on readiness.

## Approval queue (not performed)

1. Accept the exact independently reviewed successor and explicitly accept
   abrupt termination on readiness/network loss. Formal supervised-demo
   release acceptance remains pending.
2. Approve creating dedicated ResponseOS web/media/watchdog services in
   Audio's workspace `tea-d8sjb1flk1mc73d5aq5g`, their region, plan and spending
   cap, exact frozen source/package, disabled automatic deploys, start commands,
   ports, TLS endpoint and access restrictions. No existing FRL service is a
   ResponseOS deployment target.
3. Approve an isolated hosted database and least-privilege runtime identities,
   its exact database/role readback, migrations and recovery validation.
4. Approve generation and narrowly scoped secret-manager delivery of the
   readiness request key and watchdog-only Ed25519 signing key, database connection, Clerk configuration, retained-webhook
   integrity keys, and later the exact Telnyx/xAI qualification credentials.
   Values must stay out of chat, source, logs and review packets. Installation,
   login, broad secret inheritance and provider key creation are not implicit.
5. Approve inactive deployment and hosted safety checks separately. Measure
   sweep completion gaps and HTTPS round trips under load/failure; prove
   exact release binding, inactive zero actions, 503 admission failure, restart,
   network loss, withdrawal, and one-shot uncertain termination. The unchanged
   three-second bound and 500 ms request cap must pass with measured margin.
6. Only after those checks and separate activation approval: one controlled
   call, authenticated terminal evidence, then two consecutive rehearsals.
   CRM, email, recording and automatic transfer remain disabled.

## Doctrine section 21

1. Communications safety/control layer.
2. Build the narrow existing readiness protocol; buy hosting/TLS/secrets.
3. Removes the verified shared-filesystem blocker for a supervised pilot.
4. Retains frozen releases, exact proof binding and test evidence.
5. Sweep readiness remains distinct from disconnection or business outcomes.
6. No learning or customer knowledge data.
7. Native HTTP/crypto; no new platform or secret store.
8. No CRM, FSM, carrier or workflow duplication.
9. HTTPS is hosting-neutral.
10. Existing tenant, consent and exact-call guards remain authoritative.
11. No command acceptance is promoted to disconnection evidence.
12. Local experimental capability; hosted validation remains open.
13. Explicit release, spending, hosting, credential and activation approvals.
14. Scoped request/signing keys; no customer payload or compliance claim.
15. Required now for the owner's cross-host readiness request.

## P2 transport resilience and local sweep correction

The first failed remote request no longer discards a still-valid proof. This is
not a retry or a grace period: the original signed age plus complete RTT fixes
one deadline, strictly below 3000 ms. A 500 ms timeout can consume the last of
that lifetime and still cause immediate denial. A stalled response body has the
same bound. Single-flight requests prevent an older concurrent success from
undoing a denial. Binding changes isolate pending work and retained proof.
HTTP keep-alive is 5000 ms, avoiding deliberately closing every connection.

A failed watchdog sweep clears its local proof immediately. A reachable consumer
receives denial and clears retained proof immediately. If the edge is unreachable,
a consumer can continue only until previously verified proof expires (at most
three seconds from its originating successful sweep, including network age).
The watchdog's own next sweep reads local proof and can still terminate affected
sessions independently of the edge. This bounded detection difference requires
explicit supervised-demo release acceptance; it is not customer-ready behavior.
Restart still clears proof and the first sweep still terminates existing calls.
No consent, withdrawal, stopped-state, authority, lease, identity or termination
check is cached. Final qualification checks retain the proof deadline across
DB waits. No consumed command is retried or concurrency slot released without
exact authenticated disconnection evidence.

Local regressions cover transport failure then expiry, explicit denial and invalid
signature revocation, concurrent readers, binding changes, isolated local sweep
scope, active withdrawal/stop/expiry/retargeting under retained proof, and local
sweep termination despite an unavailable public edge. Real TLS/connection reuse,
network latency, clock discipline and sweep timing still need separately approved
hosted verification. No deployment, credentials or live activation are authorized.

Doctrine section 21 above still applies: this narrows an existing safety protocol,
adds no provider/CRM/retention capability, preserves exact evidence and tenant
boundaries, buys hosting/TLS, and claims only local synthetic validation.
### Authenticated denial versus gateway errors

The watchdog signs its 503 not-ready envelope with the same nonce, exact release
and instance binding and watchdog-only Ed25519 key. A valid negative response
revokes retained proof immediately; a present but invalid signature also fails
closed. A positive proof qualifies only with status 200. Unsigned 502/503/504
responses can originate at a hosting gateway, so they are treated like transport
failure: reuse only an already verified deadline, never create or extend proof.
Other status codes and redirects remain denial. An unsigned error cannot turn
an unready consumer ready. Authenticated negative replay still fails nonce binding.
The source-reviewed 43ae9e6/8eec93c candidate is preserved; this correction closes
its remaining edge-error P2 locally without granting hosting or activation.