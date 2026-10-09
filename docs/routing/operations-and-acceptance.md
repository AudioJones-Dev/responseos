# Hosted routing operations and acceptance

Status: review-only implementation. Runnable worker is simulated-only; HubSpot HTTP adapter takes an injected request seam, with no credential factory or activation path. Mock confirmations are not live commissioning.

## Start / stop / health

Provisioning and deployment require authorization. After approved migration and synthetic tenant creation, inject DATABASE_URL, RESPONSEOS_ROUTING_WORKER_ENABLED=true, RESPONSEOS_ROUTING_ACCOUNT_ID, RESPONSEOS_ROUTING_ENVIRONMENT=test or preview, and RESPONSEOS_ROUTING_CONCURRENCY=2. Run `npm run routing:worker`. `/health` is process liveness; `/ready` requires tenant/database/schema and recent polling progress. Default bind is loopback. Render background workers do not receive incoming network traffic; their monitoring requires process supervision and log/heartbeat integration. A network readiness probe requires a separately reviewed private-service runtime. Never inject provider tokens into the simulated worker.

SIGTERM/SIGINT stop new claims and drain the current batch. Forced termination, timeout or DB interruption can leave a committed claim. The next claim sweep moves expired claims to uncertain. It does not dispatch them again. Distinct confirmed intake replay returns the existing receipt/state, including after process/client restart.

## Queues and operator visibility

The existing operator session can query `GET /api/admin/routing-deliveries/<receipt-reference>`. Scope is its selected tenant. Response contains reference, environment, simulated/live mode, delivery status, attempt count and redacted error code. No private payload is returned. PostgreSQL status/next_attempt index supports queued/rejected/uncertain queues. Worker emits structured attention codes/counts for failed, uncertain or queued-over-five-minute operations; the authenticated `/admin/routing-deliveries` page shows the latest 100 tenant-scoped receipts without customer payloads. External alert wiring remains a release blocker.

Contact-only pending inquiries require review. Outbound team notifications, Notes/Tasks and escalation delivery are not implemented by this initial worker. Existing HubSpot form recipients remain configured; they are not qualification-aware worker notifications. Do not label this increment the full six-path operational acceptance.

## Reconciliation

Do not delete checkpoints, clear a fence or flip uncertain to queued manually. Inspect tenant-bound receipts, operation step and provider evidence. The current operator POST accepts simulated decisions only and requires a bounded evidence reference, tenant-bound admin/operator session and uncertain state. Accepted simulation becomes confirmed; nonaccepted simulation becomes rejected. Neither path requeues. Live-mode rows cannot use this endpoint.

`inspectUncertainHubspotDelivery` prepares read-only candidate proof using tenant/environment/digest/manifest checks, unique inquiry marker, complete projected field readback and Contact association. It never settles a receipt or authorizes resend; missing records and read failures remain inconclusive. No credentials or operator activation path are wired.

Before live reconciliation activation: verify the HubSpot credential's portal, search immutable unique inquiry markers, independently read identity/owner/fields and associations, quarantine ambiguous results, and record the full reviewed proof reference. A zero-result eventually consistent search alone does not prove nonacceptance. No automatic resend after timeout or crash. Existing Contact data/lifecycle must remain untouched. New phone-only contacts require review.

## Migration and rollback review

0019 adds only a child delivery table and indexes to the existing ledger. It preserves 0017's blocked receipt constraint and 0018's mock-only constraint. Its composite account/intake foreign key prevents cross-tenant links. SQL checks constrain status, attempts, dispatch tokens, leases and confirmation timestamps. Application transactions persist receipt, intent and audit together. No hosted migration was applied.

Pause intake and worker before rollback. Retain the additive table and existing data; redeploy an earlier compatible application. The previous purge implementation does not understand hosted unresolved holds, so do not run its purge command against a database containing this extension. A restore drill on a populated synthetic database and a reviewed backup/restore plan must pass before hosted migration. No destructive down migration is supplied. Retention is explicitly configured per intake credential (one to ninety days); queued/in-flight/uncertain payloads are held for recovery and require approved release of holds.

## Controlled acceptance plan (requires separate approval)

Prepare exact noncustomer record identities and desired field table before provider writes. Use designated test records in portal 247150421 and approved owners. Keep email/marketing notifications suppressed unless exact recipients are separately authorized. Accept all six paths with Contact match/create, Sales versus Support versus Acquisition destinations, starting stage, all mapped fields, owner and association readback. Acquisitions must omit standard Deal amount and cannot offer/pay. Verify unchanged replay, a returning Contact/new inquiry, concurrent workers, lost acknowledgements, partial associations, 429/nonacceptance, ambiguous matches, auth failure and exhausted retries. Verify database receipt/audit against provider readback. A mock HTTP response or PostgreSQL success cannot close G04.

Then approve an isolated staging website interface integration. Keep canonical routes/templates, Preview noindex, demo-only deployment, conversion-event policy and no fallback to direct HubSpot when durable integration is enabled. Verify reload recovery with opaque identity only, changed-payload conflicts and truthful queued/uncertain presentation. Images remain excluded: private storage authorization/access/retention is a separate gate.

## Residual blockers

- Human security review of hosted credential protocol, least-privilege DB role and credential rotation/revocation.
- Approved host/service/region, secrets configuration, external paging and operational review of the rendered queue.
- Populated rollback/restore drill and hosted migration approval.
- HubSpot live transport/account binding and reviewed activation of read-only reconciliation proof; worker currently refuses HubSpot mode.
- Note/Task, company association and team notification scope; pending qualification and website acquisition/attribution contract.
- Controlled provider records and notifications approval, actual provider acceptance, staging website end-to-end acceptance.
- CI on required Linux/Node/Postgres runtimes and human review. No production lead capture, indexing, domain cutover, Sanity publication or live customer delivery authorized.
