# Validation and reconciliation evidence — 2026-10-09

Scope: isolated local PostgreSQL 16.15 on loopback port 55463, synthetic data only. This audit created its own cluster under ignored `.database-validation/pg16`; it did not reuse or truncate a hosted database. Local Node 24.19.0 (available bundled patch release), npm 11.16.0, Prisma 6.19.3, Next 16.4.0. CI retains pinned Node 24.18.0 and must separately pass on 16/17/18. No real credential or customer record was loaded into tests.

## Observed local results

| Gate | Result / limit |
| --- | --- |
| Prisma generate | PASS; existing Prisma 6 datasource retained; no major upgrade |
| lint / typecheck / diff whitespace | PASS |
| Unit suite | 57 files, 695 tests PASS; includes 25 connection/history/restore guard cases |
| Integration suite | 13 existing files, 163 tests PASS in a complete rerun; new database backend-loss/reconnect test separately PASS (164 total) |
| Schema replay | 0001–0013 replayed on empty owned local DB; Prisma migration-to-schema shadow diff reports no difference |
| Production build | PASS with synthetic DB; existing app/API/auth/provider code unchanged |
| Production dependency audit | zero vulnerabilities with npm audit --omit=dev; existing full/dev audit policy left intact |
| Offline applied-history comparison | staging matches all 13 local migration files/checksums; live-demo rejected because applied supervised-runtime migrations are absent from master |
| CLI fail-closed behavior | missing credentials rejected with static codes; invalid restore inventory rejected; no URL/SQL-error printing |
| Upstream routing regression | PR #210 pinned d1a08bdd: 24 unit + 25 integration tests PASS against separate synthetic routing_test database; migrations 0001–0013 and 0017–0019 replayed there only. No upstream tracked files edited. This is evidence for that SHA, not a claim those features are on master |

Initial local tests encountered missing Bash/npx; the verified Git Bash and official npm 11.16.0 CLI were supplied on the test-process PATH, then affected/full suites were rerun. Downloaded tooling was moved under ignored node_modules so it was not treated as application source by lint. No test assertions, audit thresholds or CI security gates were weakened. Prisma emits an existing package.json seed-config deprecation notice; migration to a new Prisma major is outside scope.

## Synthetic logical restore

Source responseos_test → new responseos_restore, same owned loopback cluster, PG16. `pg_dump` custom archive and `pg_restore --exit-on-error`; no source/default/hosted endpoint change. Synthetic-only ownership/ACL omission is explicit, so this exercise does not prove privilege restoration.

- Archive bytes: 122,200.
- Dump/create/restore interval: 1.1527 seconds on this workstation; not hosted RTO.
- 35 public tables including `_prisma_migrations` reconciled, exact count and stable row-digest per table.
- Source and target reconciliation-output SHA256: `1DAEDF16B905E1B4E95A1857822FA5BD676BEC43CFDB24B37F7F29847BA55F29`.
- [Synthetic table counts/digests](synthetic-reconciliation.txt); no row content or credentials.
- Prisma source→restore schema diff: no difference.

The source fixture DB was subsequently reused for more tests; the committed reconciliation describes the captured restore snapshot, not a permanent live row count. Real-data reconciliation would need consistent snapshot/write-freeze handling, exact approved table/identity mapping, protected keyed checksums and post-catch-up proof. None was performed or required for a confirmed provider data migration here.

CI now adds PostgreSQL 16/17/18 matrix runs: schema replay/shadow diff, seed, full integration, version-matched pg_dump/pg_restore **inside the service container**, all-table synthetic count/digest comparison and Prisma schema diff before DB-backed build. Matrix definition is not passing CI evidence; inspect exact commit checks before readiness.

## Required acceptance matrix

| Requested test | Evidence / remaining gate |
| --- | --- |
| schema comparison | local shadow and restore diffs PASS; hosted exact-schema diff not performed |
| row counts/checksums | all 35 synthetic public tables match; staging operator aggregates independently read; no real-data migration |
| primary/foreign/unique constraints | existing integration coverage plus schema replay; upstream FRL tests reject cross-tenant linkage/inconsistent fences; hosted enforcement under new role pending |
| tenant isolation / operator authorization | existing application suites and upstream scoped tests PASS; actual hosted RLS/non-owner acceptance pending |
| authentication mapping | existing Clerk unit/integration suite PASS; staging count confirms one linked operator, not a login smoke; no identity move |
| migration replay | base and separately pinned routing chain replay PASS on local PG16; 17/18 CI pending |
| concurrent worker dispatch | pinned #210 competing-client/fence and identical-persistence tests PASS |
| duplicate inquiry replay | pinned #210 receipt replay/concurrent idempotency tests PASS |
| delivery uncertainty quarantine | pinned #210 lease-expiry, lost-ack, partial-association, checkpoint and plan-change tests PASS |
| worker restart recovery | pinned #210 isolated process stop/restart test PASS with durable simulated receipt |
| DB disconnection/reconnection | new test terminates its own synthetic backend, reconnects and verifies one committed tenant survives; multi-service outage/hosted network acceptance pending |
| backup restoration | local all-table logical restore PASS; six-hour Neon history metadata observed; hosted binding-safe routing-data restore not run |
| security privilege validation | offline role/URL/options rejection PASS; shared-table RLS/PUBLIC TEMP impact reviewed; no actual dedicated LOGIN hosted grants installed/tested |
| application regression | lint/type/unit/integration/build PASS locally; no FRL behavior changed |
| HubSpot adapter simulation | pinned #210 simulated Contact/Note/Task/checkpoint/association/uncertainty tests PASS; no live provider calls |

Supplemental untracked permission proposal reviewed separately: JSON SHA256 `47E35095EEBCC836CD1C8361757885AF2C0FC0DA97065A1BCC4239EC899FA971`; local-review script SHA256 `49AF19075D3C9137BAB3D75BB709FAA76A6B5F90164ACEF71C00C201B2E7EAD1`. Its report claims prior all-35-table hosted snapshot reconciliation; that report was read, not independently rerun here. This audit independently read original/restore User, Clerk-linked User, Account and migration counts only. Prior TLS handshake/usage/approval claims likewise remain attributed reports. Current metadata confirms corrected original/restore bindings; no historical operator action is inferred from current state.

No production cutover, actual provider data migration, live routing, hosted grant/RLS validation or production readiness is claimed. Outstanding gates are in [approval register](runbook.md#outstanding-approval-register).
