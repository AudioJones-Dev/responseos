# Schema and security impact assessment

Current evidence is [catalog/history readback](readback-2026-10-09.json), not security certification. No hosted DDL, DML, GRANT, REVOKE, RLS or restore was executed.

## Schema/role comparison

| Target | Observed application schema | Applied history | Identity aggregates | Security posture |
| --- | --- | --- | --- | --- |
| main project default, PG17 | no public tables; nine neon_auth tables outside Prisma | public migration ledger absent | identity rows not queried | PUBLIC CONNECT/TEMP; no dedicated ResponseOS app role observed |
| main project demo, PG17 | 23 public tables incl migration ledger | not read separately | not queried | no public RLS; neon_auth schema exists |
| staging main, PG18 | 35 public tables incl migration ledger | 0001–0013, finished, no rolled-back rows | User=1, Clerk-linked=1, operators=1; Accounts=0; orphan account links=0 | all application tables owned by neondb_owner; no RLS/policies; public show_db_tree function |
| staging restore branch | aggregate/history count only | 13 records, checksums not compared | User=1, Clerk-linked=1, Accounts=0 | grants/schema not separately audited |
| live-demo, PG17 | 42 public tables incl migration ledger | 0001–0017 including supervised-runtime/call-control additions | User=1, Clerk-linked=1, operators=1; Accounts=1; Clerk-linked Accounts=0; orphans=0 | all application tables owned by neondb_owner; no RLS/policies |

Shared first 13 migration names/checksums are in the evidence. Staging schema column/default fingerprint differs from live-demo and main, as expected from different histories. Fingerprints are diagnostics, not cross-version schema equivalence proofs (PG18 catalogs also represent NOT NULL constraints differently). No row-level customer reconciliation was attempted. A schema-only diff against the exact approved commit is required before any hosted migration.

Existing role metadata on staging/live-demo: neondb_owner and neon_service have BYPASSRLS/CREATEDB/CREATEROLE; neon_superuser is a non-login elevated group; cloud_admin is provider-managed. Main additionally has neon_auth. Runtime use of these roles is unverified because deployment URL values are unavailable. Do not modify provider-managed roles or assume list-role UI is the full catalog. `public` schema grants PUBLIC USAGE, not CREATE; database ACL grants PUBLIC TEMP and CONNECT. Current external network allows public connections, with no IP entries; this is not proof of anonymous database access. `passwordless_access=true` needs an effective-auth review.

## Migration 0017–0019 review

| Change | Exact effect | Who can be affected |
| --- | --- | --- |
| 0017_frl_web_intake_receipts (#209) | creates FrlWebIntake; account FK RESTRICT; unique reference and account/environment/submission; environment and blocked-delivery checks | intake API and operators; database-level DDL locks/storage affect concurrent consumers; no existing User/Clerk row rewrite |
| 0018_frl_mock_delivery_state (#209) | unique account/id on intake; creates mock outbox with composite tenant FK, bounded attempts, lease/status and receipt invariants | local mock runner, intake/operator reads; additive index takes a table lock; no auth schema change |
| 0019_hosted_routing_delivery (#210) | creates hosted queue with composite tenant FK, manifest/checkpoints, attempt/lease/confirmation checks and scheduling index | worker, status UI/API, intake enqueue; shared Account, AuditLog and Notification accesses already exist in code |
| applied live-demo 0017_call_control_qualification | different migration name/checksum and schema branch; absent from FRL stack and default | supervised demo/call-control consumers; requires explicit lineage/compatibility reconciliation |

None of the three FRL migration files contains `GRANT`, `REVOKE`, `ENABLE ROW LEVEL SECURITY` or `FORCE ROW LEVEL SECURITY`. Do not claim worker privilege isolation from these migrations. Additive table creation is still a hosted write requiring authorization, a backup and migration-runner privilege review. Never edit applied history/checksums, run migrate reset/db push, or mark divergent migrations resolved to silence drift.

## Proposed permission changes — separate approval

| Proposal | Impact / mandatory review |
| --- | --- |
| REVOKE TEMP ON DATABASE ... FROM PUBLIC | database-wide for every role inheriting PUBLIC, not worker-only. Can break temporary-table reporting, maintenance, extensions/functions, dump/restore helpers and migration assumptions. Inventory users and explicitly grant required exceptions before approval. PostgreSQL lacks a per-role DENY overriding PUBLIC; revoking from worker alone cannot remove inherited PUBLIC TEMP. |
| Revoke PUBLIC CONNECT or schema USAGE/CREATE | affects other apps, Clerk sync, operators, maintenance and future migrations, depending on explicit grants/membership. No broad revocation from this PR. |
| Dedicated runtime/worker grants | affects only that principal if confined to new grants; granting Account UPDATE for FOR UPDATE also permits real column mutation unless guarded. Require actual Prisma lock/RETURNING SQL tests. No table ownership, DDL, DELETE or role escalation. |
| ENABLE RLS on shared tables | affects every non-owner/non-BYPASSRLS consumer, including web data access, Clerk provisioning and operators. No policy defaults to deny. Broad/permissive policies can defeat tenant protection through OR semantics. Evaluate all roles, commands and WITH CHECK policies. |
| FORCE RLS | includes ordinary table owners but does not constrain superusers/BYPASSRLS. Can break migration/data-maintenance runners lacking a suitable policy. Existing neondb_owner bypass is not fixed by FORCE alone. |
| Role/ownership revocation | shared owner consumers, Prisma DDL, signed identity sync and operator session lookup can fail; verify positive and negative behavior on restored copy first. |

## RLS strategy requiring approval

Keep existing session-derived tenant authorization for web surfaces while documenting that DB enforcement is absent. Do not describe this as database isolation. Before worker enablement, apply role-specific policies limiting FrlWebIntake by approved account AND environment; delivery access must join that scoped intake; Account visibility/locking only for the permitted account; Notification and AuditLog policies restrict tenant and allowed fields/events. Account edits need a reviewed immutable-row guard or narrowly controlled lock operation; a SELECT policy alone is insufficient. App/Clerk roles need separately reviewed policies/grants so enabling RLS does not deny existing behavior.

If general app RLS is later adopted, derive tenant context exclusively from trusted session/server config and bind `SET LOCAL` in the same transaction as every query. Transaction pooling cannot carry session SET state safely between requests. Design global Clerk lookup/provisioning and authenticated operator access explicitly; do not accept a client-supplied account GUC or policy bypass to make tests green. Migrations/restore must preserve policies, owner/grants, and data; credential secret values are provisioned separately, never restored from Git.

Clerk preservation includes internal User/Account primary keys, exact Clerk user/org IDs, authoritative role, null account for control-plane operators, webhook idempotency/audit linkage and unique constraints. Never relink by email or seed over the operator. Signed webhook replay and session resolution need synthetic fixture tests plus private actual-operator acceptance after any role change.

No permissions SQL is shipped or automatically applied: least-privilege/RLS design cannot be declared approved before restored-copy tests and consumer readback. Application SQL scoping and structural composite FKs help but are not equivalent to role-level isolation.

## Supplemental working-tree permission proposal

During this audit the separate `responseos-hosted-routing-phase1` worktree contained untracked `infra/routing/worker-permissions.review.json`, `scripts/routing-permissions-local-review.ts`, and staging inspection/preparation reports. They are **not part of pinned PR #210 head d1a08bdd** and were read without modification. Their claims of approvals/provider actions belong to that workstream and authorize no action here. Pin their content hashes before any later review/application.

The concrete SQL creates a NOLOGIN, NOBYPASSRLS worker role with connection limit four, revokes database PUBLIC TEMP, grants Account SELECT(id)/UPDATE(id), scoped delivery UPDATE columns and SELECT/INSERT on notices/audits. It enables RLS (does not FORCE it) on Account, FrlWebIntake, HostedRoutingDelivery, Notification and AuditLog, with role-specific policies for synthetic account/test/simulated mode and an invoker trigger blocking worker Account updates. These shared-table/database changes have the broader effects above; they are not limited to the new outbox. Preserve existing operator/Clerk behavior when testing them.

The local review script derives its connection from an owner URL and adds `options=-c role=responseos_routing_worker_test`. Verifying current_user and six denied statements is useful effective-role coverage, but **does not prove a separately authenticated runtime login**: session_user still has the owner's identity and RESET ROLE can regain it. Require a real dedicated LOGIN with no privileged membership, verify both current_user/session_user, and deny RESET ROLE/SET ROLE escalation to owner, grant-option escalation, direct source identity access and runtime access to DIRECT_URL. The new connection checker rejects `options` so this test mechanism cannot accidentally become an approved runtime credential.

Further tests must cover same-account wrong-environment reads/updates, malicious direct SQL inserts, invalid notification JSON/message contents, arbitrary audit category/expiry/action content, broader permissive-policy interactions, and all existing non-owner consumers. Current proposed audit/notice predicates constrain tenant and selected fields but do not prove every stored content field is safe; do not claim opaque-only messages or full audit integrity from these grants. The trigger blocks UPDATE, while missing DELETE privileges independently block deletion. No hosted permission acceptance follows from this supplemental review.

Pinned #210 runtimeConfig rejects explicit certificate bypass but allows an absent sslaccept parameter with sslmode=require. Prisma 6 documents accept_invalid_certs as its default: require an explicit sslaccept=strict and actual invalid-certificate rejection before hosted use. This PR's separate preflight closes that configuration acceptance gap without silently changing the unmerged worker stack. libpq verify-full and Prisma-native TLS parameter support are different; see architecture.md.

Fresh catalog metadata independently confirms `show_db_tree` is owned by neondb_owner, SECURITY INVOKER (`security_definer=false`), with null/default ACL and no function-local settings. Default function EXECUTE is normally available through PUBLIC; inspect its body/actual callers before changing that privilege. This is distinct from a SECURITY DEFINER escalation claim, which the readback does not support.


Application pool recovery: the shared web application client resets its connection pool after P1017 only after active root operations/transactions drain. This can affect every application data accessor using lib/db/client.ts, so full tenant/operator/authentication regressions are required. Query arguments and account filters are unchanged; failed writes and transactions are never replayed. Other direct Prisma constructors, including the separately reviewed PR #210 worker, are outside this factory. No role, grant, RLS, identity mapping or hosted connection is changed.
