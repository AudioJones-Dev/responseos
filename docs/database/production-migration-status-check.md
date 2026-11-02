# Production migration status: read-only check

Status: **reusable procedure; first used 2026-11-02** (see [`production-migration-0009-0013.md`](./production-migration-0009-0013.md)). Running it needs the operator's approval and the operator's own Neon console session. It changes nothing. It authorizes no migration, seed, restore, credential change or deployment.

## Why

On 2026-11-02 at 17:36:59 UTC, production (`6f579cc`) logged:

> `[demo/receptionist] not answering: agent profile read failed (P2021)`

The same error was logged on 2026-10-26 (`production-target-check.md` §1). P2021 means Prisma reached the database and logged in, but the `AgentProfile` table does not exist. Migration `0009` creates that table. `ProspectIntake`, which `/audit` intake writes to, comes from `0011`. So production's schema is behind `master` (`0001`–`0013`), and turning intake on would fail too.

This check answers three questions before any fix is planned:

1. Which migrations has production applied, and in what order?
2. Are any FRL pilot-lineage migrations (`0014`+, decision B1-04) or unknown names present?
3. Is a plain `prisma migrate deploy` of master's chain safe, or does the history need reconciling first?

## Target

Identify the target by evidence, not by branch name. Neon branch names need not match the environment that uses them.

1. While the candidate computes are idle, request `https://responseos.pro/demo/receptionist` once.
2. Note which compute endpoint's `last_active` moves to within seconds of the request.
3. Repeat once.
4. Confirm the production deployment and its `DATABASE_URL`/`DIRECT_URL` have not changed since.

If two endpoints react, or none does, stop. Running this against the wrong database produces a confident wrong answer.

When a connection string is needed (for example for `prisma migrate`):
- Run commands through a wrapper that refuses any host but the identified endpoint.
- Redact the password from the wrapper's output.
- Neon's Connect dialog can default to a different branch, and to a pooled host.

## Step 1: run in the Neon console SQL Editor

Paste the whole block. It runs in a read-only transaction, and Postgres rejects any write inside it.

```sql
BEGIN TRANSACTION READ ONLY;

SELECT current_database()                                  AS database,
       current_setting('server_version')                   AS postgres,
       to_regclass('public._prisma_migrations') IS NOT NULL AS has_migration_table,
       to_regclass('public."AgentProfile"')     IS NOT NULL AS has_agent_profile,
       to_regclass('public."ProspectIntake"')   IS NOT NULL AS has_prospect_intake,
       (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') AS public_tables;

ROLLBACK;
```

If `has_migration_table` is `true`, run this second block:

```sql
BEGIN TRANSACTION READ ONLY;

SELECT json_build_object(
         'migrations',
         COALESCE(
           json_agg(
             json_build_object(
               'name',        migration_name,
               'checksum',    checksum,
               'finished',    finished_at IS NOT NULL,
               'rolled_back', rolled_back_at IS NOT NULL
             )
             ORDER BY started_at, id
           ),
           '[]'::json
         )
       ) AS history
FROM _prisma_migrations;

ROLLBACK;
```

Neither query returns row data, credentials or personal information. The output is table names, migration names and checksums only.

## Step 2: save the output privately

- Save the `history` value as `applied-history.json` in a new folder under `Documents/GitHub/responseos-evidence/`.
- Keep Step 1's row in the same folder.
- **Never save it in the public repository.**

## Step 3: compare against the repository (offline)

From a checkout of `master`:

```bash
npm run database:evidence -- history <path-to>/applied-history.json
```

The tool never connects to a database. It reports `ok: true` when production's history is an ordered prefix of the repo's chain with matching checksums. Otherwise it reports one or more of these:

| Error | Meaning | Next |
|---|---|---|
| `applied_migration_absent_from_repository` | A migration master doesn't have, probably the FRL pilot lineage (`0014`+) | Stop. Reconcile under B1-04 before any deploy |
| `migration_checksum_mismatch` | An applied file differs from the repo's | Stop. Find which version was applied |
| `migration_application_order_mismatch` / `migration_history_gap` | Out-of-order or skipped migrations | Stop. Reconcile manually |
| `unfinished_migration` | A failed or partial migration is recorded | Stop. Resolve it (`prisma migrate resolve`) as its own approved step |
| `duplicate_applied_migration` | The same migration is recorded twice | Stop. Reconcile manually |

**Empty history caveat.** If `history` is `{"migrations":[]}` (the table exists but has no rows), the tool reports `migration_history_gap`, because it computes its gap window wrongly when nothing has been applied. Read that case as "no Prisma migrations recorded" and treat it like `has_migration_table = false`.

**Tested 2026-11-02, offline only.** Synthetic histories confirmed the outcomes above: a clean `0001`–`0008` prefix gives `ok`; a pilot `0014` gives absent-from-repository plus order mismatch; checksum drift, an unfinished migration and an empty history each give the error listed. The Step 1 SQL has not been run against any database, because no local Postgres was available (Docker hold).

## Reading the result

| Outcome | What it means | Fix path (each step needs separate approval) |
|---|---|---|
| `ok`, last applied `0008` or earlier | Production is a clean prefix of master | Restore point → `prisma migrate deploy` → seed or enable the internal-demo agent profile → re-check `/demo/receptionist` |
| `has_migration_table = false` | The schema was never managed by Prisma here, or this is the wrong database | Stop. Re-confirm the target (ADR-0085 readout) |
| Any error from Step 3 | The history has diverged | Stop. Reconcile under B1-04 or ADR-0070 first |
