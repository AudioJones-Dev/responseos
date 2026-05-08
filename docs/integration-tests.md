# Integration tests

Phase D adds a Postgres-backed integration test suite for the v0.2 data layer.
The suite resets a disposable database, applies the committed Prisma migration,
runs the deterministic seed, and then verifies seed idempotence plus tenant
scoping through `lib/data/*`.

## Required database URL

⚠️ The integration suite runs `prisma migrate reset --force --skip-seed` and
destroys all data in the target database. Run these tests only against a
local/disposable Postgres database. The test guard refuses to reset databases
unless the host is `localhost`, `127.0.0.1`, or `postgres`, and the database name
contains `test`.

Both `DATABASE_URL` and `DIRECT_URL` may point at the same local database URL:

```bash
postgresql://postgres:postgres@localhost:5432/responseos_test?schema=public
```

## Local run

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/responseos_test?schema=public" \
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/responseos_test?schema=public" \
npm run test:integration
```

The integration script runs `npx prisma generate` before resetting the database,
so fresh clones do not need a separate generate step. Keep unit coverage on the
existing mock fallback with:

```bash
npm test
```
