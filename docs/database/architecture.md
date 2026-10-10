# Canonical Neon architecture — proposed ADR-0070

Status: proposed operational standard; reinforces accepted ADR-0026, does not authorize infrastructure changes. Hosting, role creation, RLS, paid plan selection and cutover remain operator approvals. Current implementation status and decisions must remain distinct.

## Selection and ownership

Keep Neon as the canonical ResponseOS relational platform: the repository already uses ordinary PostgreSQL through Prisma, its migration history and event ledger are portable, and ADR-0026 already selected Neon. There is no confirmed Supabase database to export. Avoid adding Neon-specific query APIs, auth or object services merely for uniform branding.

Clerk remains identity authority; ResponseOS PostgreSQL remains authority for local account mapping, role, ledger, routing receipts, idempotency and recovery state. HubSpot remains the downstream CRM copy, MailerLite the marketing service, Sanity the FRL CMS. Existing object storage and provider-owned artifacts remain outside relational migration. Neon Auth is not selected: the main project's existing `neon_auth` schema needs an ownership audit, not replacement of Clerk or deletion.

**Authoritative databases are environment-specific.** Retain staging `patient-snow-16014934 / br-mute-boat-a6ylen11 / neondb` as authority for its existing operator and staging schema. Retain live-demo `dark-lake-70639149 / br-aged-block-auq28jrd / neondb` as authority for its demo/supervised-runtime history. Do not copy either wholesale into production. Main `quiet-band-27365020 / br-floral-sunset-aqn7cfw4` is the production candidate by topology, but has no public application tables and has unrelated-to-Prisma auth tables. It is **not established as the authoritative production ResponseOS dataset**. Its older demo branch also has application tables. Deployed URL readback and data-owner acceptance must select the exact production database before schema changes or consolidation. No authoritative FRL production intake ledger is demonstrated by these reads.

## Environments, versions and placement

| Environment | Placement / version | Boundary |
| --- | --- | --- |
| Production candidate | existing responseos project, AWS us-east-1, PG17 | dedicated production roles and secrets; exact branch/database approved after authority audit; no staging identity/data import |
| Staging | existing responseos-staging-mock, AWS us-west-2, PG18 | retain operator mapping; proposed Render Oregon worker is geographically aligned; simulation only until approved |
| Live demo | existing separate US East project, PG17 | retain separate migration lineage and access; no FRL ledger auto-application |
| Development / CI | local disposable Postgres; CI 16/17/18 | synthetic fixtures; no hosted credentials or production-derived identities |
| Future hosted previews | isolated schema-only or sanitized source | separate roles, TTL/cost ownership; never inherit production auth/PII silently |

Prefer PG17 for a newly approved production baseline because the two East projects already use it; keep staging PG18 intact. This is a proposed baseline, not an upgrade/downgrade. PostgreSQL 18 acceptance must include restore and worker tests; CI now covers both versions plus current local 16. A PG18 physical backup cannot be restored into PG17. Logical export across versions requires extension/DDL/type compatibility verification; do not infer backward compatibility from passing Prisma generation. Move staging regions only if measured latency/residency needs justify an explicitly approved migration. Do not promote it because its version is newer.

## Connections and roles

Runtime uses pooled Neon `DATABASE_URL`; migrations, dumps and restore use direct `DIRECT_URL` in separate operator/CI contexts. Existing Prisma datasource separation stays intact. Pooled and direct endpoints must resolve to the same approved project/branch/database, with different runtime and migration principals. A direct URL is not evidence that credentials differ.

Proposed role hierarchy: non-login schema owner, dedicated environment migration login allowed to assume that owner only during maintenance, application login without ownership/CREATEDB/CREATEROLE/BYPASSRLS, narrower worker login bound to approved tenant/environment, and time-limited audited operator/readback principal. Do not give runtime membership in neondb_owner/neon_superuser. Existing objects are owned by neondb_owner; transferring ownership/grants is a separately reviewed change, including migration replay and Clerk provisioning tests. Migration shadow databases exist only on isolated local/CI clusters; production runtime never gets CREATE DATABASE.

The worker receives only its pooled URL; no DIRECT_URL, Clerk keys, intake signing keys or provider tokens in simulated mode. Its current proposed queries require Account locking, intake SELECT, delivery SELECT/UPDATE, notification SELECT/INSERT and audit INSERT/SELECT RETURNING. Do not broaden grants to all tables or enable automatic migrations on worker start.

TLS: require encryption with certificate/hostname validation and reject plaintext, certificate bypass and process-wide TLS disable. For the installed Prisma 6 native connector require **sslmode=require AND sslaccept=strict**; its documented default sslaccept accepts invalid certificates, so sslmode alone is insufficient ([Prisma v6 PostgreSQL documentation](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql)). The preflight requires this explicit pair and rejects duplicate/unknown connection options. Native libpq pg_dump/pg_restore use a separate direct-connection configuration with sslmode=verify-full and appropriate trust roots; do not feed Prisma-only sslaccept parameters into libpq. URI configuration checks still do not prove an encrypted verified connection; negative certificate tests remain mandatory. Do not alter Neon passwordless or network settings based on the metadata flag alone. IP/network restrictions need a separately costed supported plan and verified Vercel/Render egress; no fixed private path is inferred.

## Security, evidence and private-data lifecycle

Existing application authorization remains in force. Approved worker activation requires database-enforced account/environment restrictions plus negative tests on the actual worker principal; see [impact assessment](security-impact.md). General web RLS cannot be turned on with no policy/transaction design: Clerk sync and operator cross-tenant access require explicit policies. No unreviewed `PUBLIC TEMP` revocation or schema-wide grants are part of this PR.

Retain immutable IDs, migration checksums, foreign/unique/check constraints, indices, original timestamps, receipt/checkpoint/audit history and uncertain holds. Keep PII expiries already in code: unqualified intake 90 days; personalized source/transcript/raw webhook content 30 days; raw Clerk webhook bodies 30 days; general-demo call content 90 days. Expiry is enforced by a guarded operator purge, not a proven hosted schedule. Audit expiries do not establish a general audit-deletion mechanism; approve a minimum 365-day audit policy and legal holds before any archive deletion. No credentials or identity row content enters evidence artifacts.

Backups can retain expired content: use encrypted private backup storage, restricted access, access logs and deletion schedules consistent with legal holds. After restore, reapply erasure/retention decisions before user access or delivery resumes; never resurrect deleted personal content or resend uncertain work. Tenant export/erasure and provider-side deletion remain gaps.

Rotation procedure: approve exact environment/service/role, create a new scoped principal/secret version, test TLS and least privilege privately, update only approved services, drain/restart connection pools, verify positive/negative access and queue continuity, then revoke old login after the rollback window. Record secret version IDs and evidence hashes, never URL/password values. Rotate migration and runtime independently; incident revocation must consider surviving pooled sessions. Do not revoke the shared owner until all consumers are identified.

## Cost analysis

Illustrative USD/month, 730 hours; not a quote or account billing readback. Current official [Neon pricing](https://neon.com/pricing) retrieved 2026-10-09: Launch $0.106/CU-hour, storage $0.35/GB-month, history $0.20/GB-month; extra branches $1.50/branch-month; public egress above included allowance $0.10/GB. No monthly minimum listed. Scale compute $0.222/CU-hour. Existing organization subscription/credits not verified.

| Scenario | Explicit assumptions, one project | Launch estimate |
| --- | --- | --- |
| Idle | suspended compute; 1 GB database + 1 GB billable history | $0.55 |
| Normal | average 0.25 CU continuously; 5 GB database + 5 GB history | $22.10 |
| High | average 2 CU continuously; 50 GB database + 50 GB history | $182.26 |

These are estimates from usage assumptions, not recovered revenue or measured load. Always-on 0.25 CU costs $19.35 compute alone. Multiply by actual independently active environments and add egress/extra branches, external backup storage and any separately approved worker. Polling every ten seconds can defeat scale-to-zero even with an empty queue. Free limits are not a production recovery guarantee; reaching limits can interrupt service. Configure approved spending/usage alerts and accountable ownership; do not provision or upgrade as part of this review.

## Recovery targets and acceptance

Observed history retention is 21,600 seconds (six hours) on all three projects. No independent backup schedule, encrypted destination, verified restore RPO/RTO or account quota enforcement was established. The prior restore branch exists and aggregates match for identity counts, but this is not a complete reconciliation.

Proposed production targets: PITR window at least seven days, encrypted independent daily logical backups retained 30 days, RPO <= 5 minutes inside verified PITR coverage, RTO <= 60 minutes after incident declaration. Independent-backup fallback RPO <= 24 hours must be separately accepted. Proposed staging: seven-day history if approved plan supports it, daily encrypted backup before maintenance, RPO <= 24 hours, RTO <= 4 hours. No measured hosted capability is claimed. Approve longer retention/legal holds and regional backup location before provisioning. Test data restoration into a **new branch/endpoint**, never source/default restore/swap workflows.

## Compatibility and reconsideration

Remaining risks: unresolved deployed targets, PG17/18 lineage divergence, extra Neon Auth ownership, owner bypass privileges, shared-table RLS effects, `show_db_tree` permissions, pooling/session semantics, real certificate/network behavior, private artifacts and backup retention. Reconsider Supabase only for a demonstrated production dependency on its Auth/Storage/Realtime/PostgREST/Edge Functions or a documented cost/security/operational requirement that Neon plus retained services cannot satisfy. Evaluate each service independently; no vendor change just for an SDK or env name.

## Doctrine §21 review

1. Layer: structured Business Memory substrate and Trust Infrastructure.
2. Keep existing Prisma/Postgres; buy managed DB; implement bounded local audit gates.
3. Improves pilot safety without enabling live routing.
4. Preserve ledger, identities, checksums and restore evidence.
5. Prevent lost receipts; does not establish verified revenue outcomes.
6. No new proprietary-learning claim or feature.
7. Managed relational storage/backup is a commodity to buy.
8. No CRM/FSM/telecom/workflow duplication.
9. Ordinary SQL/Prisma remains portable; Neon-specific topology confined to contracts.
10. Preserve app tenant scope; require worker DB enforcement before activation.
11. No changes to attribution or revenue computation.
12. No production-ready/provider-independent/HIPAA claim.
13. Separate hosted/security/data/cutover/decommission approvals retained.
14. No increased customer-data movement; unknown backup/identity ownership blocks writes.
15. Required now to prevent mistaken restore targets and divergent migration deployment.


Recovery implementation review under ADR-0070: a bounded Prisma extension resets the application pool after a lost connection (P1017, or P2010 with a shutdown/connection SQLSTATE) without replay, preserving ledger uncertainty (questions 1, 3-5). It uses the existing bought Prisma client, adds no dependency or provider lock-in and duplicates no business platform (2, 6-9). Account filtering and attribution stay unchanged (10-11). Local synthetic tests support only local recovery claims (12); hosted/deploy approvals remain separate (13), no private-data export is added (14), and the reproduced permanent pool failure requires this repair now (15).
