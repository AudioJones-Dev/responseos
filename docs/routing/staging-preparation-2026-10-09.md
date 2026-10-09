# Staging preparation after approval — October 9

Scope: approved staging preparation, simulation only; no production/main ResponseOS access, HubSpot writes, paid plan upgrade or Render creation. Proposed $10 cap cannot be provider-enforced using available tools. Chargeable Render provisioning remains blocked by that restriction and unavailable workspace billing readback.

## Completed provider actions

Existing project patient-snow-16014934 remained free_v3. No snapshots existed. Current published Free entitlement includes one manual snapshot and ten branches; no automatic overages or upgrade was requested. Created snapshot snap-solitary-darkness-a6z6ik41, frl-preparation-backup-2026-10-09, at13:11:54UTC, expires October16 at13:15UTC. This occupies the one manual snapshot slot. Snapshot stays within Neon staging, not an external export.

Restored it as branch br-aged-block-a61fvlo5. The call's omitted finalize parameter unexpectedly finalized restoration: original branch names/default flag and endpoint association moved. This was an execution mistake: finalize:false should have been explicit. Immediately stopped migration work, disclosed the incident, restored original branch br-mute-boat-a6ylen11 to name main/default and restored original endpoint ep-young-morning-a6oeu9vv to it. Removed only newly created endpoint ep-silent-frost-a63tv2wk while correcting the mapping. Original branch data were not deleted or overwritten.

Created isolated restore-check endpoint ep-noisy-pond-a65ml884 at fixed0.25CU after mapping repair. An attempt to specify suspend_timeout300 was rejected HTTP412 on the existing plan; retried with plan defaults, no upgrade. Read-only aggregate row digests across **all35tables** match between original and restored branch. Only nonempty tables: User1, WebhookEvent3, _prisma_migrations13. No raw customer/auth payload or credentials returned. This proves snapshot restoration of existing staging contents, NOT routing-ledger restart/PITR acceptance: hosted routing tables do not exist yet.

Final endpoint readbacks: original ep-young-morning-a6oeu9vv on br-mute-boat-a6ylen11 idle; restore ep-noisy-pond-a65ml884 on br-aged-block-a61fvlo5 idle. Both explicitly suspended after queries. Restore branch retained for review; no deletion of retained branch/records performed. No migrations, hosted role creation or fixture insertion occurred.

## Classification

Minimal read-only aggregation classified the existing User as role operator on an approved organization email domain (FRL/AJ Digital/Audio Jones); no address revealed. Webhooks are Clerk organization.created, organizationMembership.created, user.created, one each, each retaining a raw body. Treat these as potentially identifying authentication/administrative data, **not synthetic inquiry fixtures**. Preserve them, deny the routing worker access to User/WebhookEvent and do not clone them into any public demo. All35table digest comparison establishes other tables empty at that check. No interpretation that these records are customer inquiries or safe to publish.

## Local database permission review

Prepared `infra/routing/worker-permissions.review.json`, not applied hosted. Role responseos_routing_worker_test is initially NOLOGIN, NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS with connection limit4 and no privileged membership. Scope grants and role-specific RLS to frl_routing_staging_synthetic/test/simulated. Account lock gets UPDATE(id) privilege, with an invoker trigger prohibiting worker mutation. Delivery UPDATE has explicit mutable columns only. Notification inserts restricted to internal queued notices linked to owned delivery; audit inserts restricted to system routing actions. No owner credentials or stored password in artifact.

The package includes a database-scoped PUBLIC TEMP revoke to prevent inherited TEMP creation. This changes database-wide public privilege and must be reviewed for other staging consumers before hosted application; owner explicit privileges remain. Enabling RLS also requires an applied-principal regression check. Credential creation/LOGIN activation remains a secure separate step; no plaintext password in review JSON.

Empirical local PostgreSQL16 test `scripts/routing-permissions-local-review.ts`: actual restricted current_user verified; full simulated worker including Note/Task/checkpoints/audit/notices confirmed; cross-tenant intake reads returned0. Six probes rejected: Account mutation, delivery DELETE, User SELECT, CREATE ROLE, ALTER TABLE and CREATE TEMP TABLE. Typecheck passed. Script refuses nonloopback/nonowned port55440; it is not a hosted grant installer. Local cluster stopped afterwards. This is not PostgreSQL18 hosted privilege acceptance.

## Remaining gates and costs

Expected incremental monetary charge is$0 within unchanged Free plan, not invoice-verified. Usage counters are stale/zero and cannot establish actual remaining quota; control-plane snapshot/restore causes writes/storage bookkeeping. Both endpoints are idle, each capped0.25CU. Existing snapshot/second branch occupy Free quotas; no subscriptions changed. No reliable hard$10 cap or Render workspace total available, so no chargeable Render resource created. Free quota exhaustion may block subsequent work instead of billing; do not upgrade automatically.

Before hosted writes: review exact permission JSON (including PUBLIC TEMP/RLS impacts), migrations0017/0018/0019 source/checksum and regression scope, preserve operator/Clerk data, use a proper Prisma migration execution/recording path with secret handling and independent principal. Snapshot restore has a documented control-plane side effect; future restore calls must explicitly use finalize:false and verify original branch/default/endpoint before queries. Do not automate a repeat with defaults.

Then apply reviewed permission changes and synthetic tenant under the approved write scope, prove PostgreSQL18 negative/positive permissions and authenticated strict TLS, create synthetic routing fixtures and prove their hosted restoration without source replacement. Only after those pass and billing/cap controls are resolved can a concrete Render simulation deployment proceed. PR210 remains draft/unmerged. Production and real provider gates remain closed.
