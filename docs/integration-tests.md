# Integration tests

Phase D adds a Postgres-backed integration test suite for the v0.2 data layer.
The suite resets a disposable database, applies the committed Prisma migration,
runs the deterministic seed, and then verifies seed idempotence plus tenant
scoping through `lib/data/*`.

## Required database URL

Run these tests only against a local/disposable Postgres database. Both
`DATABASE_URL` and `DIRECT_URL` may point at the same local database URL:

```bash
postgresql://postgres:postgres@localhost:5432/responseos_test?schema=public
```

## Local run

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/responseos_test?schema=public" \
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/responseos_test?schema=public" \
npm run test:integration
```

The integration suite runs `prisma migrate reset --force --skip-seed`, so the
configured database will be dropped/recreated before assertions run. Keep unit
coverage on the existing mock fallback with:

```bash
npm test
```
