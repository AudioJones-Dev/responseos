# Controlled cutover and rollback runbook

Status: reviewable plan only. No hosted write, migration, restore, provisioning, rotation, connection change, deployment, merge, live routing, FRL publication, DNS or indexing authorization is implied. A provider migration is currently unnecessary for confirmed repository dependencies. Use this runbook for separately approved Neon standardization changes; if a production-critical Supabase dependency is discovered, stop before migrating it and revise the exact manifest for approval.

## Repository tooling

`npm run database:check -- infra/database/staging.proposed.json application` validates process-injected URLs against a proposed nonsecret target, including exact database/host, pooled runtime vs direct migration, distinct expected roles and TLS flags. It does not retrieve envs, connect, provision or modify anything. Worker mode rejects DIRECT_URL; migration mode requires only the migration URL. The manifest names **unprovisioned** roles; existing secrets are not expected to pass until separately approved role work is complete. Never place a URL on the command line or in a PR.

`npm run database:ready -- <approved-target.json>` performs a read-only connection/catalog query with a validated runtime principal. It rejects DIRECT_URL in its context, checks PG17/18, database/user identity and elevated privileges/table ownership. It reports neither credentials nor SQL errors. It does not prove tenant RLS, schema correctness, hostname certificate rejection, connection pooling, provider delivery or application acceptance. Do not use its result as a release gate on its own. No new public health endpoint exposes database state; existing `/api/health` remains application liveness.

`npm run database:evidence -- history <applied-history.json>` compares `{ "migrations": [...] }` to the checked-out migration files. Rows contain `name`, `checksum`, `finished`, `rolled_back`; no row payloads. Export rows in actual application order (`ORDER BY started_at, id`), never sorted by migration name; retain started_at/id in protected source evidence. The active sequence must be an ordered prefix of the repository chain. It rejects absent applied files, checksum drift, duplicate/unfinished records and gaps before an applied migration. Export this metadata privately and read-only from the exact approved database. The command never applies migrations.

`npm run database:evidence -- restore <before.json> <after.json> <restore-target.json>` checks binding invariants. Snapshot shape: projectId, defaultBranchId, branches[{id,name}], endpoints[{id,branchId}], connections[{service,endpointId,database,role}]. The target contains branchId and endpointId. No URLs/passwords. Every original branch/name, endpoint→branch and application target must remain unchanged; restore IDs must be new. Full service inventory is a prerequisite; missing or ambiguous inventories fail. This is a mandatory approval/readback gate, not a substitute for preventing source-targeting API calls. No repository tool invokes a hosted restore API.

## Restore safety before any hosted change

1. Confirm environment, full application/control SHA, project/branch/database/endpoint IDs and every consuming service, including deployment/custom-env/branch overrides. Independently parse actual secrets in a hidden/private operator session; keep only metadata and evidence hashes. Resolve UNKNOWN before proceeding.
2. Record baseline project default/primary branch, every existing branch/name, endpoint bindings and effective application targets. Include staging operator counts/mapping and non-Prisma schemas in private protected evidence. Check live provider/worker enablement separately; do not alter it here.
3. Approve the exact source, backup time/LSN, backup destination/encryption/access/retention and **new** restore branch/endpoint. Use a creation operation explicitly documented to restore into a separate branch. Do not invoke restore/reset/swap on source, change project default, reparent/move an endpoint, rename the source or allow automatic application connection rewiring. Do not use an unreviewed SDK convenience restore that replaces a branch under the existing endpoint.
4. Check the planned operation has no update/delete/swap/default-setting of any existing branch/endpoint. Restrict the executor to the approved operation where the platform supports scoped permissions. If exact semantics cannot be established, use logical export into a separate approved target instead. Creating a paid target still needs explicit approval.
5. Restore data/schema and separately review owner/role/grants/policies. Do not use `--no-owner --no-acl` on a real migration and claim privileges preserved: those flags are used only by synthetic CI. Production restore requires approved security mapping and independent catalog reconciliation. Do not dump role passwords into artifacts.
6. Compare baseline bindings immediately after target creation and after restore. Run the binding checker. Any changed source assignment/default/connection is an incident: stop, quarantine the target, preserve evidence and request the exact corrective action. Never silently switch assignments back while workers may still be writing.
7. Reconcile complete table counts and stable keyed checksums, PK/FK/unique/index/type/extension/schema/history equality, role policies and identity mappings. Do not expose low-entropy PII hashes publicly; keep real-data consistency evidence private. Synthetic `scripts/database-reconciliation.sql` scans all public tables and emits only count/digest for local/CI fixtures; it is not authorized for hosted real data.
8. Verify all frozen dispatch tokens, receipts, checkpoints, audit links, TTLs and uncertain holds. Start only a simulated worker on an isolated synthetic tenant after security authorization. Expired in-flight work quarantines; no blind retry/resend during restore.

Required incident regression: simulate source/default branch swap, existing endpoint rebound to restore branch, application URL retarget and restore over source. Each must be rejected. Source and restore endpoints must remain independently identifiable across before/after API readback. Prior restore metadata `restored_as=br-mute-boat-a6ylen11` is a reason to enforce these invariants; it is not sufficient proof of historical endpoint correction or complete restore equality.

## Staged change/cutover sequence

1. Resolve production authority and migration lineage; approve exact target/schema/roles and named service scope.
2. Validate schema/history on a separate sanitized target, replay migration chain and test security before touching existing state.
3. Take a verified source backup immediately before maintenance; demonstrate independent restore and original binding invariants.
4. Load isolated target; reconcile all approved data without altering identity keys, receipts or history.
5. Pass tests in [acceptance matrix](validation.md), including real operator identity acceptance privately and simulated provider delivery. Record expected losses/latency and operator ownership.
6. Define write-freeze: stop accepted producers, webhook intake and workers under separate service authorization; verify no in-flight transactions/claims, record last accepted IDs/LSN/time and durable request handling during freeze. Queue/reject inbound requests using an approved retry contract. No assumed dual-write. Design any replication/catch-up keys, ordering and conflict resolution before loading the initial target. After freezing the source, replay/replicate every write through the recorded final position, or reload from a fresh frozen-source backup. Verify completion and final all-table counts, integrity and approved consistency proofs at that position before seeking cutover authorization or switching any connection. If completion cannot be proved, remain frozen and do not switch.
7. Establish rollback window and RPO. Proposed minimum source retention seven days after acceptance, subject to privacy policy. Before resumed writes, rollback can return to the frozen source with zero lost accepted writes; afterward rollback requires reconciliation of every target-only write. Default allowable acknowledged-record loss is zero. If that cannot be met, stay frozen and obtain an explicit operator decision; do not overwrite either side.
8. Present source/target/schema/role/evidence/SHA/cost/write-freeze/rollback package and obtain **cutover authorization**. No pending approval is inferred from elapsed time or green CI.
9. Switch only approved service secrets/connections, drain pools, verify target identity at runtime, deploy only approved compatible code. No automatic git deployment is enabled by this PR.
10. Run authenticated/tenant-denial/operator/Clerk mapping smoke, synthetic inquiry replay, queue claim/restart/disconnect, uncertainty and receipt readback. Do not send customer messages or HubSpot writes without separate authorization.
11. Monitor agreed error, auth-denial, connection saturation, queue age, uncertain counts, counts/checksum drift and p95 latency against measured baseline. Proposed rollback trigger: any identity/tenant violation, missing accepted receipt, unaccounted duplication/loss, changed source binding, or sustained connectivity errors; establish quantitative latency/error thresholds with the operator before cutover.
12. Retain original DB and backup through approved rollback window, frozen or read-only; document which system accepts writes. Do not call the source decommissioned while rollback depends on it.
13. Decommission only after separate approval and verified no consumers, retention/legal holds and recovery dependency. Never delete Supabase/Neon resources during discovery.

## Rollback

Stop only authorized producers/workers first; preserve both databases, audit/queue evidence and exact deployed SHA. Determine whether new writes exist. If none, restore approved original connections and known-good schema-compatible code, then repeat identity and binding readback. If new writes exist, reconcile receipts/idempotency/checkpoints under a reviewed forward-recovery plan before resuming source; never overwrite source from an older backup. Do not execute destructive down migrations. Uncertain deliveries stay quarantined, including provider calls with unknown acknowledgment. Role revocation, endpoint suspension or restore cleanup each needs approval scoped to that resource.

## Outstanding approval register

| ID | Required decision / evidence | Owner | State / blocks |
| --- | --- | --- | --- |
| A01 | Confirm Render Michael's workspace for read-only service/env discovery | AJ Digital | authorized 2026-10-10; connector returned null, inventory remains UNKNOWN; Render dependency inventory |
| A02 | Privately verify effective Vercel, GitHub/Doppler and Render URL/role/environment mappings | AJ Digital + operator | UNKNOWN; authority and source identity |
| A03 | Identify production dataset and main neon_auth/demo consumers | AJ Digital | pending; production target and any consolidation |
| A04 | Ratify ADR-0070, PG17 production proposal and staged PG18 compatibility evidence | AJ Digital | proposed; no version/region change authorized |
| A05 | Resolve distinct applied 0017 histories across supervised runtime and FRL stack | human reviewers | blocked; no renumber/checksum rewrite or cross-lineage deploy |
| A06 | Approve restored-copy grants/ownership/RLS and PUBLIC TEMP strategy for every consumer | security reviewer + AJ Digital | pending; worker principal/enablement |
| A07 | Approve private backup destination, retention/legal holds, PITR plan/budget, RPO/RTO | AJ Digital | pending; current six-hour coverage insufficient for proposed targets |
| A08 | Hosted synthetic role/tenant/schema preparation and isolated restore drill | AJ Digital | NOT AUTHORIZED; no hosted writes from this handoff |
| A09 | Paid Neon/Render provisioning or plan/network changes | AJ Digital | NOT AUTHORIZED |
| A10 | Runtime secret rotation, service deploy/connection switches, exact SHA and write freeze | AJ Digital | NOT AUTHORIZED |
| A11 | Actual customer/identity data movement and private reconciliation plan | data owner + AJ Digital | NOT AUTHORIZED; no migration currently selected |
| A12 | Cutover, rollback window/loss policy and post-cutover smoke | AJ Digital | NOT AUTHORIZED |
| A13 | Source/resource retirement, restore-copy cleanup and obsolete Supabase deletion | AJ Digital | NOT AUTHORIZED; separate final decision |
| A14 | PR review/merge and PR #209/#210/#93 decisions | human reviewers | separate; this PR changes no PR state on those stacks |

Live ResponseOS routing/provider activation, FRL content, domain/DNS/indexing, billing and receptionist behavior remain outside this task's authorization.

A15: Application pool reset after a lost connection (P1017, or P2010 with SQLSTATE 57P01/57P02/08xxx) is implemented for review and validated on synthetic local data without replay. Hosted pooler/network-outage and PR #210 worker recovery remain unverified; do not close cutover acceptance from local tests alone.
