# FRL PR A validation

## Second security pass: Next 16.3.8

October 7, 2026. Registry recheck exposed six additional Next advisory IDs on
16.3.6. Updating only Next and required env/SWC companions to 16.3.8 cleared
those IDs. Full audit still reports five high development-tooling packages
from one braces advisory; production-only audit is clean. Exact paths, versions,
reachability limits, rejected ineffective upgrades and before/after audits are
in the [updated evidence ledger](../security/pr195-dependency-evidence.md).

Lint, TypeScript, 668 unit tests, the original 52 projection tests against the
patched tree, Prisma generation, migration deploy/parity, both builds and
environment-contract validation passed. All 174 PostgreSQL tests passed in one
invocation, including the 17 FRL persistence/rollback/restore tests.
An initial migration check stopped before tests because the local
server started on its default port; restarting the same isolated cluster on
55432 corrected the local setup without source changes.

The PR body records exact-head CI after this change is pushed. The unchanged
full audit gate remains mandatory. No breaking dependency replacement, worker,
CRM operation, acquisition activation, deployment or gate closure is included.

## Security follow-up: patched dependencies

October 7, 2026. The authorized security pass proved all original 11 package-level
findings inherited from master, then cleared six with compatible patches.
The full audit still fails with **5 high, 0 critical, 0 moderate** findings, all
from the unpatched braces chain in Next ESLint tooling. Production-only audit
returns zero findings, but does not replace the full required security gate.
See the [complete dependency evidence ledger](../security/pr195-dependency-evidence.md)
for advisory IDs, versions, resolved paths, reachability and remaining remediation.

| Patched-tree check | Result |
| --- | --- |
| Fresh npm ci | Passed using npm 11.16.0 |
| Prisma client generation | Passed, unchanged Prisma 6.19.3 |
| Full ESLint / TypeScript no-emit | Passed |
| Unit tests | 668 passed in 57 files |
| Full PostgreSQL integration suite | 174 passed in 14 files in one clean invocation, including all 17 FRL persistence/migration tests |
| Migration deploy / shadow-schema parity | No pending migration / no difference |
| Empty rollback and reapply, populated rollback refusal, backup/restore | Passed within the integration suite |
| No-database / database-backed application builds | Both passed on Next 16.3.6 |
| Original HubSpot projections | 52 passed against patched dependencies using temporary exact copies from the unchanged commissioning checkout; copies removed after validation |
| Repository environment contract / git diff check | Passed |
| Full dependency audit | FAIL: 5 high findings; unchanged audit threshold |

The integration command used `pnpm dlx npm@11.16.0 exec -- vitest run --config
vitest.integration.config.ts` with command-local Git Bash/PostgreSQL PATH and the
isolated loopback responseos_test database, supplying npx for the existing seed
test. Local Node remains 24.19.0 versus CI's pinned 24.18.0. No persistence source,
migration, projection, worker or CI policy was changed by remediation.

Original-head CI run [37690513641](https://github.com/AudioJones-Dev/responseos/actions/runs/37690513641)
completed: both jobs failed at the audit gate before test/build execution.
Follow-up exact-head CI must be checked after pushing this patch; local passing
checks are not CI approval. Its run and outcome will be recorded in the PR body.
PR #195 remains draft, open and unmerged. G02-G07 remain open and PR B has not
started. No live CRM writes, deployment or production database changes occurred.

## Initial implementation validation (before remediation)

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
