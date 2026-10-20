# Cross-host watchdog readiness

EXPERIMENTAL local successor to frozen application fc504ef / control 570f22b.
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
are uncached. Remote host clock offsets do not enter this calculation. The
watchdog still uses its local clock/file for sweep age; future local timestamps
fail closed. No grace interval, automatic replay, or freshness extension exists.

The HTTP listener is intended to sit behind an approved TLS edge; direct
unencrypted cross-host consumers are rejected. `/readiness` requires the HMAC
request, so an ordinary hosting health probe must not be interpreted as
readiness. The proof carries no tenant, call, transcript, or provider key.
The request key cannot sign readiness responses. Only the watchdog has the
private signing key. Scope both keys to this one deployment and rotate them
with a newly approved qualification configuration.

The watchdog alone requires its local writable proof file. Other hosts need
no shared filesystem or matching UID. Its own qualification checks use the
same HTTPS endpoint. Cross-host qualification hashes omit the host-local proof
path and listener `PORT`; those differ per service. The signed public media URL,
listener configuration contents, exact release/instance, HTTPS readiness URL,
request-key hash and public signing key remain bound. Local-file mode retains
its original port/path binding. A restart clears proof before the first sweep. Missing,
failed, expired, or unreachable proof still ends active calls on the existing
heartbeat/sweep path. Network interruption is an additional cause of abrupt
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
