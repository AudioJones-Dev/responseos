# FRL signed local test intake

Local implementation only. `POST /api/frl-test-intakes` accepts synthetic test
payloads, saves the existing FRL receipt and blocked mock intents transactionally,
then returns a receipt. It sends no CRM, notification or marketing request.

## Authority and protocol

ADR-0067 adds a bounded test-only system ingress to the session-based receipt
service. The server selects one account using `RESPONSEOS_FRL_TEST_ACCOUNT_ID`.
No request field can select an account or environment. The private persistence
helper is not exported. The public signed entry verifies HMAC before mutation,
fixes environment to `test`, and records a system audit actor. Existing operator
and purge functions continue requiring a selected-account session.

The route is disabled unless `RESPONSEOS_FRL_TEST_INTAKE_ENABLED=true` and a
server-only signing secret of at least 32 characters is configured. It always
rejects `NODE_ENV=production`, including hosted Preview builds. Run local servers
bound to 127.0.0.1; use synthetic accounts/data and a synthetic local key. Do not
configure these variables in hosted environments.

This local path uses mock development with Clerk absent and
`RESPONSEOS_REQUIRE_AUTH` unset. It does not bypass the existing proxy: enabling
Clerk or auth-required mode may block the caller before the signed route. No
protected-route exception is added in this increment.

Headers are UUID-v4 `Idempotency-Key`, epoch-seconds `X-FRL-Timestamp` (within five
minutes), and `X-FRL-Signature: v1=<hex HMAC-SHA256>`. The signed UTF-8 string is
`v1\nPOST\n/api/frl-test-intakes\n<timestamp>\n<id>\n<SHA256(raw body)>`.
Actual body bytes are capped at 8192. Strict schema parsing rejects extra fields.
The same key and canonical payload replay one receipt; changed payload conflicts.
The timestamp allows fresh signatures for retries without a new submission ID.

201 means persisted; 200 means replay; 409 means conflicting payload; 400/401/413
mean invalid request; 503 means unavailable. Responses are no-store and redacted.
Success explicitly says `mode=mock`, `status=received`, `deliveryStatus=blocked`.
This is a saved test intake acknowledgement, not a delivery acknowledgement.

## Website boundary and remaining work

The companion website sender permits only the literal loopback hostname and route,
refuses redirects, and requires a blocked mock acknowledgement. Its test flag fails
closed without falling back to HubSpot. Stable IDs survive unchanged in-memory
form retries; edits create a fresh identity. Reloading loses that identity. Mock
success shows the reference without a conversion event or thank-you redirect.

No migration is added in this increment. Hosted authentication/account binding,
secret rotation, abuse controls, private receipt recovery across browser reloads,
live adapters, notification retry scheduling, provider reconciliation and live
delivery acceptance remain open. Domain cutover and indexing remain gated.

Doctrine review: 1-3 existing tenant communications and lead preservation;
4-5 durable receipt evidence, no delivery claim; 6 no learning expansion;
7-9 existing Postgres and provider-independent schema; 10 signed server-owned
tenant with strict test environment; 11 stable retry identity; 12 mock-only copy;
13 existing activation gates; 14 synthetic local data, existing retention policy;
15 closes the observed local intake transport gap.
