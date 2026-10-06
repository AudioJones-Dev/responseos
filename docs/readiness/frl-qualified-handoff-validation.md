# FRL qualified handoff — local validation

Date: 2026-10-06. Base: `3252a6de9c8a40992b3edc655c05ffbe73459194`
on `master`. Branch: `feat/frl-qualified-call-handoff`.

All business inputs are synthetic. No live lead, call, notification or provider
write was made. Read-only FRL HubSpot identity/owner lookup was performed; it
returned two active owner identities and reported portal onboarding incomplete.
Owner selection, recipient and transport remain pending. Actual account/owner
identity values are intentionally absent from this artifact.

## Results

| Gate | Command | Result |
|---|---|---|
| Lint | `npm run lint` | Passed |
| Types | `npm run typecheck` | Passed |
| Unit suite | `node node_modules/vitest/vitest.mjs run` | 59 files, 699 tests passed |
| Schema/migration parity | `node node_modules/prisma/build/index.js migrate diff --from-schema-datamodel prisma/schema.prisma --to-migrations prisma/migrations --shadow-database-url "$LOCAL_SHADOW_URL" --exit-code` | Passed, no difference |
| Local migrations | `node node_modules/prisma/build/index.js migrate deploy` | All 14 applied to new disposable local database |
| Integration suite | `node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts` | 13 files, 164 tests passed |
| No-database build | `node node_modules/next/dist/bin/next build` | Passed |
| Database-backed build | Same build command with disposable local database URL | Passed |
| Repository environment contract | `node scripts/config/validate-environment.mjs --repository` | Passed |
| Patch hygiene | `git diff --check` | Passed |
| Security gate | `npm audit --audit-level=high` | Failed on inherited dependencies: 11 findings, 2 moderate / 8 high / 1 critical |

The direct Node CLI commands execute the same binaries/arguments as the package
scripts. npm 11.16.0 was run using bundled pnpm's isolated `dlx` cache because
npm/npx were initially absent from the Windows PATH. Host Node is 24.19.0;
the repository/CI pins 24.18.0. Local Postgres is 16.13, bound only to localhost
on a dedicated port. Its separate empty test and shadow databases contain only
deterministic/synthetic fixtures. The downloaded binary archive's SHA-512 was
verified against registry metadata; no database service or provider was changed.

The first unit pass failed three existing Bash syntax checks because Git Bash
was absent from PATH; adding its existing installation resolved them. The first
integration pass failed seed determinism because npx was absent; adding the
isolated npm/npx cache to PATH resolved it. The final complete suites above pass.

## Tested behavior

- Disabled or mismatched account: no handoff effects.
- Incomplete, maybe, unqualified and spam: capture remains, no owned handoff
  task/notification.
- Qualified: contact/activity evidence precedes owned task and outbox entry.
- HubSpot task owner creation/readback contract tested using mocked HTTP only.
- Missing/revoked, conflicting, mismatched, malformed or changed policy: review.
- Concurrent/replayed calls: one durable handoff and one notification entry.
- Partial queue failure: persisted task is reused on retry.
- Tenant filters and role denial: no cross-tenant mutation/disclosure.
- Signature failure: stops before webhook ledger and business effects.
- All entries remain queued/unsent; no delivery or human callback promise.

## Unclosed gates

Package manifests/lockfile are unchanged from base. The existing Next.js critical
and other dependency advisories cause both CI jobs' audit step to fail before
their runtime checks. Dependency remediation and CI-green confirmation are
required before merge. Do not force an audit fix or downgrade the framework.

This artifact does not prove live CRM synchronization, notification delivery,
24/7 provider availability, human response time, approved recording/transcript
capture or production readiness. Complete the remaining acceptance in the
[handoff contract](../product/frl-qualified-call-handoff.md), including an
authorized production-candidate test. Automatic Git deployment stays disabled.
