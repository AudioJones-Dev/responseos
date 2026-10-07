# FRL PR A validation

October 7, 2026. Branch codex/frl-ledger-foundation, master baseline
3252a6de9c8a40992b3edc655c05ffbe73459194. Local persistence validation only.

| Check | Evidence |
| --- | --- |
| Prisma client generation | Passed with pinned Prisma 6.19.3 |
| Forward migration | Passed on fresh isolated local PostgreSQL 16.15 |
| Migration/schema parity | No difference detected against a dedicated shadow DB |
| Focused Postgres tests | 17 passed across persistence and migration/recovery suites |
| Unit suite | 668 passed in 57 files |
| TypeScript no-emit | Passed |
| Full ESLint | Passed |
| No-database production build | Passed, default Turbopack |
| Existing projections | 52 passed in original unchanged commissioning checkout |
| Dependency audit | FAIL: 11 inherited findings (2 moderate, 8 high, 1 critical) |
| Full integration suite | 174 passed across full run plus focused environment-corrected rerun (see below) |
| Database-backed build | Passed against isolated PostgreSQL |
| Repository environment contract / diff check | Passed |

Commands use node with node_modules/prisma/build/index.js,
node_modules/vitest/vitest.mjs (unit or --config vitest.integration.config.ts),
node_modules/typescript/bin/tsc --noEmit, node_modules/eslint/bin/eslint.js,
and node_modules/next/dist/bin/next build. Audit used pnpm dlx npm@11.16.0
 audit --audit-level=high --json; package manifests and lockfile are unchanged.

Local Node is 24.19.0; CI pins 24.18.0. Dependencies were copied from the existing
commissioning checkout with the same unchanged lockfile into a separate real
node_modules directory. PostgreSQL binaries came from the
[EDB Windows archive](https://www.enterprisedb.com/download-postgresql-binaries).
The temporary server listens only on loopback port 55432, contains synthetic
fixtures, and is independent of FRL/provider production infrastructure.
Git Bash and Postgres binaries were placed only on command-local PATH.

The integration harness refuses nonlocal databases and names other than
responseos_test before truncation. Backup tests create uniquely named local
restore databases and remove them afterward. Migration rollback is empty-only;
populated rollback is rejected, with additive schema retained for code rollback.
The dump/restore test verifies persisted event/outbox identity and immutability.
No worker crash/lease/ambiguous-HubSpot acceptance is claimed by PR A.

The npm audit failure is inherited from master and is also documented on the
open draft handoff/notification PRs 193/194. Keep PR A draft; no dependency
remediation, merge or release is implied. G02-G07 stay open; migrations were
applied only to the disposable test instance. Provider writes, purchases,
production activation and deployment did not occur.

Full integration first run: 173 passed, 1 failed because the existing seed-determinism
test could not find npx. Running that test through pnpm dlx npm@11.16.0 exec with
the same isolated database supplied npx and passed. No source fix was needed.
Thus all 174 tests passed across those runs; this is not represented as a single
clean invocation. The 17 new focused DB tests also passed independently.

Review: [draft PR #195](https://github.com/AudioJones-Dev/responseos/pull/195).
Do not merge while the inherited dependency audit gate fails.
