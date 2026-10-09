# Final staging reconciliation and authorization package

**Historical proposal:** Database preparation has since been authorized and partially applied. See [current applied-state evidence](staging-database-application-2026-10-09.md). Archived-branch, missing-role and unapplied-migration statements below describe the original proposal, not current state. Render provisioning remains blocked.

2026-10-09. **Configuration proposal only. Hosted readiness remains blocked.** PR #210 stays draft, stacked on PR #209. No main ResponseOS database access, hosted SQL, credentials retrieval, activation, migrations, provisioning or deployment occurred during reconciliation.

## Fixed proposed target and fresh observations

| Item | Exact target / readback |
| --- | --- |
| Provider / project | Neon / responseos-staging-mock / patient-snow-16014934 |
| Branch | br-mute-boat-a6ylen11, named main **inside the staging project**, currently archived |
| Database | neondb; existing owner neondb_owner |
| Version / region | PostgreSQL 18 / AWS us-west-2 |
| Endpoint | ep-young-morning-a6oeu9vv; idle, disabled=false, pooler_enabled=false |
| Direct hostname | ep-young-morning-a6oeu9vv.us-west-2.aws.neon.tech |
| Current role inventory | Only neondb_owner listed; no dedicated worker role established |
| Public network | block_public_connections=false; allowed_ips.ips=[]; no effective source restriction proven |
| Endpoint authentication metadata | passwordless_access=true; role authentication_method=password. Meaning/effective exposure must be verified; this is not evidence of anonymous SQL access |
| Recovery metadata | history_retention_seconds=21600 (six hours); actual restorable timestamps and retained data not queried |
| Compute / subscription | Fixed 0.25 CU; free_v3; suspend_timeout_seconds=0 in metadata |
| Render workspace candidate | Michael's workspace / tea-db1rckjbc2fs73diota0 / admin@floridarampandlift.com; must be confirmed as intended owner |

`infra/routing/staging-target.json` records these nonsecret identities. The main ResponseOS project quiet-band-27365020 and live-demo dark-lake-70639149 are explicitly excluded. The staging branch's name main does NOT select the main ResponseOS project. No connection string is embedded or retrieved.

Render supports Oregon (`region: oregon`), now selected in the inactive Blueprint. Region alignment reduces distance; Neon is external to Render and connectivity still traverses a secured public endpoint. Render's private network does not extend to Neon. No measured latency or successful connection is claimed. Region cannot be changed in place after creation. Sources: https://render.com/docs/regions and https://render.com/docs/outbound-ip-addresses.

## Worker and credential specification

One worker responseos-routing-staging; plan 0.5c-512mb, one instance, concurrency 2, poll 10000ms, 90-second shutdown allowance, Node24.18.0/npm11.16.0. Manual deployment of an exact reviewed commit, no automatic deployment or previews. Build npm ci --include=dev plus Prisma generation; no predeploy migration. Start Node directly with tsx. Worker enabled=false, mode simulated, environment test, Company bindings empty. No HubSpot token, intake signing key, DIRECT_URL, notification credential, disk, Redis or new database.

Proposed synthetic tenant frl_routing_staging_synthetic and role responseos_routing_worker_test are names for approval, not existing entities. Configure DATABASE_URL only after role creation, using the exact hostname/database above, sslmode=require and strict certificate validation. Limit Prisma connections to 4 initially. Never use neondb_owner in worker. Migration and fixture-preparation principals are separate and short-lived; runtime receives only the worker role. Secret value goes directly into Render's secret input. Do not supply or print secrets in chat, logs, PRs or artifacts.

Before first start, independently parse the actual secret URL and read back endpoint/project/branch/database/user against this manifest. Verify server certificate/hostname, actual encrypted session, rejection of invalid certificate/plaintext and incorrect credentials. These require an authorized connection to the archived branch and remain unperformed. Current runtime TLS checks supplement, not replace, these tests. Do not enable passwordless access or disable TLS to fix connectivity.

## Least-privilege permission specification

Review-only permission requirements; no grants/RLS installed. Runtime role LOGIN with generated rotated password, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS, no ownership or membership in neondb_owner/neon_superuser. CONNECT to neondb and USAGE on the application schema. Review inherited PUBLIC privileges; revoke CREATE/TEMP or public grants only after confirming other staging consumers, never organization-wide by default.

| Relation | Required operations | Restriction |
| --- | --- | --- |
| Account | SELECT id; UPDATE privilege needed for FOR UPDATE locking | Only proposed synthetic account; test no arbitrary Account mutation is possible |
| FrlWebIntake | SELECT | Synthetic account, environment=test only; no payload insert/update/delete |
| HostedRoutingDelivery | SELECT, UPDATE | Linked synthetic test intake only; no insert/delete |
| Notification | SELECT, INSERT | Synthetic account; routing in_app notices only; no external channels |
| AuditLog | INSERT, SELECT needed for INSERT RETURNING | Synthetic account, system hosted_routing events only; no update/delete |

Use role-specific database row policies, with test-environment restriction through intake linkage where applicable. A shared schema must not rely solely on application WHERE clauses. Account lock privilege can also permit UPDATE, so enforce an approved immutable-row trigger or equivalent guard against runtime Account edits. Restrict audit/notification insertion fields; no forgeable arbitrary tenant/actor/channel. Final SQL must be reviewed against existing policies and Prisma-generated RETURNING/locking queries before approval. This package does not assert that those controls already exist.

Negative acceptance with the actual worker principal: wrong tenant/environment reads return nothing; writes to other tenants fail; Account edits, unrelated tables, DDL, DELETE, role creation and ownership escalation fail. Positive claims/checkpoints/notices/audit must still work. Missing controls or inability to prove privilege boundaries blocks worker enablement. Synthetic-only contents of the existing database are not established by its name; authorized metadata/data classification must precede writes. Never clone from the main ResponseOS project.

## Network and backup arrangements

Neon IP Allow is a Scale feature; current free_v3 cannot be assumed to support source restrictions. Render outbound CIDRs are shared regionally and must be read back from the actual created service, not guessed. The Oregon legacy-workspace exception may affect stable ranges. Same-region public TLS plus strong scoped credentials is the proposed **synthetic-only exception**, requiring explicit risk acceptance; no customer data. Alternatively require an independently approved Scale/network upgrade and revised quote. No upgrade or dedicated IP purchase is included. Sources: https://github.com/neondatabase/website/blob/main/content/docs/introduction/ip-allow.md and https://render.com/docs/outbound-ip-addresses.

Six-hour history metadata is not a demonstrated backup. Archived branch/idle endpoint cannot be assumed immediately usable or restorable. After separate authorization: activate only the named staging branch as needed, inspect migrations/schema/classification, preserve a provider-supported snapshot or encrypted logical backup, then apply only reviewed missing additive migrations. Run a provider-native point-in-time restore to a NEW disposable branch in the SAME staging project, never overwrite the source. Do not clone customer/main data. An extra branch/endpoint and backup artifact are explicit billable/mutating scope.

Seed designated synthetic cases, record committed timestamp/LSN and redacted row digests; restore to the selected point inside actual available history. Verify intakes/deliveries/audits/notices, confirmed replay, expired fence rejection, interrupted Task quarantine and zero provider calls. Measure actual RPO/RTO, test restricted backup access and record resource IDs. Proposed staging objectives: no loss of fixtures committed before the chosen restore point and recovery within 30 minutes; unverified objectives, not guarantees. Restore must pass before simulation deployment. Six-hour history remains insufficient for longer recovery requirements; any policy change needs approval. Proposed encrypted export retention seven days; backup location/access and deletion scope must be approved, never stored in Git. Disposable branch deletion requires explicit cleanup authorization.

## Costs and proposed bounded trial

One Render worker is $7/month base; 1c-2g at $25/month is NOT proposed. Workspace subscription, metered/build/transfer charges and tax are additional and unverified. Confirm the existing workspace plan before resource creation; do not create or upgrade a workspace by implication. Source: https://render.com/pricing.

Published Neon Free allowance is 100 CU-hours/project/month. Always-on 0.25 CU for 730h consumes 182.5 CU-hours, exceeding it; 10-second polling prevents useful scale-to-zero. Do not promise a full-month always-on free deployment. Proposed trial: at most **seven days (42 CU-hours baseline)**, with **60 CU-hours total project budget including restore tests**, subject to actual remaining quota readback and no other consumers. Free quota exhaustion can suspend connections rather than bill overages. Metadata suspend_timeout=0 conflicts with current Free documentation's mandatory idle suspension; verify effective settings after authorized activation. No automatic paid upgrade. Source: https://github.com/neondatabase/website/blob/main/content/faqs/free-plan-limits-and-quotas.md.

Proposed incremental spending ceiling **$10 for the seven-day trial**, not yet approved and not a provider-enforced hard cap. Render's $7 monthly base is the conservative allocation; remaining $3 is contingency only after specific charges are identified. Existing workspace fees excluded must be disclosed. Abort before provisioning if unavoidable incremental charges exceed the ceiling or remaining Neon quota cannot cover trial plus restore. Check daily usage; stop at seven days or 60 CU-hours, whichever first. Stopping Render alone does not prove Neon compute stopped; explicitly authorized endpoint suspension/readback is required. Ongoing always-on paid option requires separate approval: Launch compute illustration $19.35/month at 0.25 CU plus storage/usage and $7 worker = $26.35+; Scale IP restrictions cost separately, quote required. No subscription change included.

## Deployment, rollback and exact authorization request

Implementation baseline: 285143f1cd8e3d309ede92728f4f1b702135ab72 passed CI37927733255. This configuration reconciliation changes the candidate SHA; use PR #210's NEW full SHA and its green checks recorded in the PR before any deployment. Branch name alone is not a pin. This document does not authorize merge.

Requested approval is split to preserve concrete review:

**A — Database preparation only, if approved:** confirm the named staging project/branch/neondb, Render workspace ownership and $10/60-CU-hour/seven-day limits; authorize branch activation/connection, classification and privilege readbacks, dedicated role/policy and synthetic tenant creation, reviewed missing additive migrations after backup, and one disposable hosted restore branch/endpoint. Accept public TLS without IP allowlisting for synthetic data only, or choose a separately quoted network plan. Approve private encrypted backup destination/retention and whether disposable cleanup is allowed. No worker deployment in A. Report applied SQL, readbacks, restore evidence and costs before B.

**B — Render simulation only, separate approval after A succeeds:** create exactly one Oregon worker in the confirmed workspace, configure scoped secret, deploy exact green PR SHA without merging, then enable simulated test-tenant polling for the bounded trial. Keep intake API/website deployment, HubSpot writes, external notifications and customer traffic disabled. No automatic plans/scaling or extra services. Capture service/SHA/config/billing, actual outbound ranges and heartbeat/restart/queue evidence. Do not apply the disabled Blueprint and leave a billable crash-loop; enable only within approved simulation scope after prerequisite checks.

Rollback: stop simulation worker and any separately authorized synthetic producer, preserve ledger/checkpoints, suspend authorized staging endpoint if needed to stop compute, retain source/restore evidence. Redeploy only a previously approved compatible SHA after migration compatibility review. Do not run destructive down migrations or overwrite source from restore. Expired/uncertain operations stay quarantined. Revoke only the dedicated worker credential if necessary under approved scope; no unrelated role changes. No customer-facing service/domain/indexing change.

Remaining controls: human security review of applied grants/RLS and TLS, no customer data classification, hosted restore, exact URL/portal isolation, memory/connection/polling measurements, effective budget/quota monitoring, operator heartbeat/stall/uncertainty ownership and secret rotation. External paging and all real-provider acceptance remain future gates. PR #210 stays draft and unmerged throughout both stages unless separately authorized.
