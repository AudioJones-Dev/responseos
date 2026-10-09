# FRL durable delivery state validation

Status: local mock-only state machine with signed synthetic HTTP ingress and a
local website sender under [ADR-0067](frl-signed-test-ingress.md). No live provider
adapter, scheduler, notification sender or hosted website connection.

The [local mock runner](frl-mock-runner.md) now connects claim and settlement for
one explicit synthetic operation per call. No real provider side effect occurs.

Receipt persistence now inserts two unique outbox intents (CRM and team notice)
in its transaction. Marketing gets an intent only with explicit opt-in. All
intents begin blocked, and replay cannot create another intent. Rows reference
the intake through a composite tenant foreign key; no contact payload is copied
into the queue. The intended notice recipient policy remains uncommissioned.
Earlier receipts are not backfilled into delivery jobs by migration or replay;
missing intents fail closed. Any future backfill needs operator review of prior
delivery evidence, not a blind replay of intake history.

Migration 0018 adds `FrlMockDelivery`. SQL accepts only `mode=mock`; production
delivery cannot be enabled by flipping an environment flag. Intake delivery
itself remains blocked under 0017. A fresh mock dispatch claim requires an
authorized selected-account session, a non-production runtime, a test-environment
receipt, an unexpired/unpurged payload, and
`RESPONSEOS_FRL_MOCK_DISPATCH_ENABLED=true`. The flag defaults off.

Existing operation state and expired-lease transitions are processed before the
intake expiry gate. An expired intake can therefore record uncertainty without
starting a new attempt. Active leases retain their token, and repeated uncertainty
readback neither increments attempts nor duplicates the expiry audit event.

Claims serialize under the Account lock and commit a fresh token/60-second lease
before any simulated effect. Only the matching token can settle a dispatching
row. Confirmation requires a bounded `mock_` reference; it is not delivery evidence.
Confirmed replay returns its reference without increasing attempt count. Notices
and marketing cannot claim until the mock CRM operation is confirmed.

Expired dispatch leases become uncertain, never reclaimed. A late settlement is
uncertain even if its caller claims confirmation. Uncertain rows cannot retry.
Explicit rejected operations can requeue only through the separate audited mock
nonacceptance-proof operation, with a maximum of three claims. These are synthetic
proof references, not provider reconciliation. There is no automatic retry loop.
Audit claims, settlement, expiry and retry authorization commit with each state.

Future real delivery requires a separate reviewed migration and adapter: durable
provider outcome lookup, reconciliation of uncertainty, attempt evidence, approved
destinations, notice delivery receipts, bounded backoff and manual dead-letter
handling. Mock confirmation cannot close CRM/notification acceptance or go-live.
Existing uncertainty must not be silently mapped to a fresh real delivery job.

The receipt schema, private retention/access and authenticated tenant-bound ingress
still need hosted acceptance. The local purge now excludes receipts with any
dispatching or uncertain mock operation. Purge, claim and settlement share the
Account lock, preventing payload deletion during those transitions. Expired
receipts with blocked or terminal mock operations can still purge their payload;
receipt identities, delivery state and audit evidence remain. There is no automatic
release of uncertainty holds. Before real dispatch, approve a bounded retention
and reconciliation policy for held payloads; this local guard does not certify
the live privacy or retention policy.

Architecture review: this is the operational memory/delivery layer; a locally built
test of the necessary pilot recovery path preserving receipt/audit evidence. It
uses existing commodity Postgres, duplicates no CRM/FSM/telecom features, adds no
provider lock-in or proprietary-learning feature, maintains tenant isolation and
stable attribution, and makes no live/public outcome claim. Existing human
commissioning and retention controls stay in force. No new external data exposure
occurs, and the work addresses the observed retry gap rather than optional scope.
