# FRL persistence foundation — PR A

October 7, 2026. Local implementation for review. PR A provides durable event
and blocked-intent persistence only. It has no worker, provider factory,
network call, route, scheduled job, environment activation flag or live wiring.

## Contract and compatibility

`lib/frl/events.ts` defines the `frl.inquiry` namespace, schema version 2,
with two supported event types:

- `inbound_received`: creates an inquiry with one of six pathway values and an
  opaque private context reference.
- `context_recorded`: appends a context/evidence reference to an existing inquiry.

Both require stable UUID event/inquiry IDs, source channel/event identity,
correlation ID, occurred-at time and expected revision. Recorded-at is generated
by Postgres. Unknown fields, versions and types are rejected. Actor and tenant
cannot be supplied in the envelope. This is a deliberately bounded v2 persistence
contract, not implementation of every proposed v2 event. It does not accept or
silently transform the FRL website's strict v1 event contract. A future authenticated
intake adapter must explicitly map source authority, tenant IDs and event versions.

Private context/evidence references are not proof that the referenced payload
exists or that qualification/consent was accepted. PR A stores no raw transcript,
contact payload, valuation or payment information. It does not implement private
context storage, qualification decisions or notification eligibility.

The existing HubSpot projections are unchanged in the separate commissioning
checkout. They are local uncommitted work, absent from this PR's master baseline.
Their 52 tests are validated separately; they are not claimed as CI tests of this
branch. PR A neither copies nor imports the full-schema test executor or the
non-executable existing-plan proposal. A later increment connects a reviewed
projection through an isolated delivery interface.

## Transaction and idempotency

`appendFrlInquiryEvent` requires an authorized role and an account-bound server
session. Global admin/operator sessions without a selected authenticated account
fail closed; there is no caller-supplied account override. No ingress is added.
The existing auth-required deployment controls remain prerequisites.

In one PostgreSQL transaction, the adapter locks the authenticated Account row,
checks duplicate identity/content, validates the inquiry revision/transition,
updates or creates the inquiry, appends an event, and inserts an outbox intent.
The coarse account lock also serializes first-inquiry and source-ID races. It is
a deliberate correctness-first tradeoff for this bounded increment; it does not
implement worker leasing and may limit high-volume concurrent ingestion.

Constraints enforce:

- `(account_id, event_id)` identity;
- `(account_id, inquiry_id, revision)` ordering;
- `(account_id, source_channel, source_event_id, event_type)` source deduplication;
- one operation type per tenant/event;
- composite tenant-scoped foreign keys from intent → event → inquiry → Account.

Exact replay returns the original event/revision/operation receipt without another
write, even after later revisions. Different content, expected revision, actor
or event ID under a previously used source identity is a conflict. A genuinely
new inquiry needs new source/event identities. Supported timestamps normalize to
UTC ISO form and schema parsing fixes JSON key order before hashing. Failed
transactions return redacted codes; caller retry must retain the stable identity.

Event UPDATE and DELETE are rejected by a PostgreSQL trigger. Corrections are
new context events. DB owner/superuser administration and privileged TRUNCATE are
outside ordinary DML protection; production least-privilege roles, retention and
RBAC remain G05 work. No retention purge bypass is introduced.

## Outbox is blocked at both layers

Every intent has operation schema version 1 and type `crm_projection_requested`.
Normal paths use `commissioning_not_accepted`; acquisition uses
`acquisition_not_authorized`. The database CHECK constraint allows only blocked
rows and those reasons. No environment setting can switch them to pending.
There is no claim, lease, retry, delivery, replay-to-provider or unblock function.

PR B will require an explicit migration and reviewed state machine; a worker
cannot simply scan these rows and deliver them. It must preserve acquisition
and commissioning policy checks on claim, retry, manual replay and reconciliation.
Leases, retry budgets, attempt history, uncertainty and destination effects are
intentionally absent from PR A. Exactly-once external delivery is not claimed.

## Migration and rollback/recovery

`0016_frl_inquiry_persistence` adds only three new tables and constraints/triggers.
It wraps its DDL in a transaction. It changes no existing rows or default behavior.
0014/0015 are reserved by the inspected unmerged qualified-handoff/notification
branches. Remote readback confirms PRs #193 and #194 are open drafts and unmerged; #194 is stacked on #193. Those branches are not dependencies and their public interfaces are
untouched. The shared integration reset list gains the three tables and a local
disposable-database safety check; reconcile that list when those branches merge.

Preferred rollback after events exist: roll back application code and retain the
additive schema/history. Older code ignores these new tables; removing them would
destroy evidence. Fix forward for schema issues. Take a verified backup before
any authorized migration on an actual environment. No production migration was run.

For an empty installation only, `scripts/rollback-frl-persistence-empty.sql` locks
all three tables, refuses any populated table, and reverses the schema atomically.
Run it with `psql -X -v ON_ERROR_STOP=1` only against a verified target. This is a
manual recovery aid, not a Prisma down migration: never leave Prisma's migration
history claiming applied DDL that has been removed. The tested cycle restores the
forward DDL immediately, retaining its already-applied migration receipt. A real
rollback must retain schema or use a reviewed compensating migration/history plan.

Tests exercise empty down/up, refusal of populated rollback, and full PostgreSQL
backup/restore into a new disposable DB. Restore verifies event/outbox IDs and
immutability. This proves PR A's local persistence recovery, not G07 production
event-tail replay or reconciliation of external effects; those need PR B/C.

## Acceptance split

| Requirement | PR A evidence / boundary |
| --- | --- |
| Atomic event + domain projection + intent | DB tests inject event and outbox insert failures; no partial rows survive |
| Duplicate logical-event protection | Concurrent replay and altered-source/payload tests against Postgres |
| Tenant isolation | Session-derived account, spoof rejection, composite FK and same-ID tenant tests |
| Immutable history | UPDATE/DELETE rejection tests, including after restore |
| Recovery strategy | Empty rollback/up, populated rollback refusal and backup/restore tests |
| Concurrent worker leases | Deferred to PR B; no claim path exists |
| Crash after destination write / ambiguous response | Deferred to PR B; no external call exists |
| Existing projection tests | Separate unchanged commissioning checkout, 52 tests |
| Production/commissioning acceptance | None conferred by this PR |

## Commissioning gates retained

The source gate table in FRL's `PRODUCTION_INTEGRATION_COMMISSIONING.md` remains
authoritative. G02 requires provider schema/form/pipeline/report readback; G03
requires owner identity and six-path assignment readbacks; G04 requires all six
Contact/Company/Deal/Ticket/Task/link and duplicate/partial-write tests. G05 needs
actual DB/migration/tenant/RBAC identity and atomic durable receipt; G06 needs
concurrency/replay/uncertain-delivery/event-version receipts; G07 needs restored
DB/object linkage, event-tail replay and no repeated external effects. None is
closed by local tests, a merge, or an existing-owner mapping.

## Doctrine section 21 review

1. Layer: operational event persistence, below provider orchestration.
2. Build the atomic ledger boundary; defer provider execution.
3. Prepares the FRL path without changing live call behavior.
4. Preserves stable events, revisions, actors and intent linkage.
5. Records persistence receipts, not recovered revenue.
6. No model training or cross-tenant learning.
7. Uses the existing commodity Postgres/Prisma stack.
8. No replacement CRM, workflow engine, inventory or financial system.
9. Provider execution remains separate from persistence.
10. Tenant identity comes from the session with composite tenant keys.
11. Source identity and explicit version/revision reduce attribution ambiguity.
12. Local evidence is not production capability or gate acceptance.
13. Preserves existing independent commissioning approvals.
14. Stores opaque context references and redacts database errors.
15. Required now by the explicitly authorized PR A scope.
