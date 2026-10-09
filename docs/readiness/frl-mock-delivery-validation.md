# FRL mock delivery state validation

October 8, 2026. Stacked on local receipt commit `b7b1735`.

Scope: durable outbox intent creation and mock-only claim/settlement. No live
provider adapter, hosted migration, signed website ingress or delivery activation.

Lint, TypeScript, all 676 unit tests, optimized build, repository environment
contract and migration/schema parity pass. Migration 0018 deployed only to the
synthetic loopback Postgres cluster on port 55434. Production dependency audit
was clean in the preceding receipt increment; dependencies are unchanged.

The initial database validation ran while the isolated cluster was recovering
from shutdown and failed on database readiness, not state-machine assertions.
Readiness was checked before retrying. The first focused run passed 17 tests
(10 delivery cases and 7 intake cases). The subsequent full run includes an
additional settlement-transaction fault injection test.

Final full integration run: **181 tests passed in 15 files**, including all
11 delivery-state cases and 7 receipt cases. No suite failure remains. These
are local PostgreSQL/mock-state results, separate from website and provider
delivery acceptance.

Covered behavior: unique receipt/outbox replay; consent-gated marketing intent;
concurrent atomic claims; confirmation replay with stable attempt count; expired
claim becomes uncertain without reclamation; stale token rejection; explicit
uncertain settlement; notice/marketing dependent on CRM mock confirmation;
non-test environments, disabled flags and production runtime fail closed; explicit
mock nonacceptance permits at most three claims; SQL refuses live mode; purged
payload cannot claim; failed settlement audit rolls back confirmation and leaves
the existing durable claim unable to authorize resend.

Limits: tests simulate lease expiry and transaction failure; they do not prove
separate-process kill/restart or hosted provider acceptance. Proof references
and confirmations are mock-only. No timer, scheduler, actual provider lookup,
email sender, automatic notice retry or uncertainty reconciliation is implemented.
Live mode is prohibited by SQL; an environment flag cannot activate it. The
website's API route remains unchanged. Production launch stays held.
