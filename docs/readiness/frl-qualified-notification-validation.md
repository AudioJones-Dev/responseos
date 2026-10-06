# FRL qualified email — offline validation

Date: 2026-10-06. Branch: `feat/frl-qualified-notification-delivery`.
Dependency/base: PR193 at `c82edec99b6b8279181d49b0690164a5357ae341`.
The remote default branch was fetched before work; this intentionally stacked
increment requires PR193's outbox. Review separately and retarget/rebase onto
the default branch only after the parent is approved/merged. Do not merge the
stack into the parent as a substitute for that approval.

All contacts, accounts, policies and transport outcomes in validation are
synthetic. HTTP adapter tests use mocked fetch; database tests prohibit real
fetch. No recipient/owner operating values, provider credentials, real calls,
leads, emails, deployments or production migrations were used.

## Results

| Gate | Exact command | Result |
|---|---|---|
| Dependency installation | `pnpm dlx npm@11.16.0 ci --no-audit --no-fund` | Passed; manifests/lockfile unchanged |
| Prisma client | `node node_modules/prisma/build/index.js generate` | Passed |
| Lint | `node node_modules/eslint/bin/eslint.js` | Passed |
| Types | `node node_modules/typescript/bin/tsc --noEmit` | Passed |
| Unit suite | `node node_modules/vitest/vitest.mjs run` | 61 files, 723 tests passed |
| Migration/schema parity | `node node_modules/prisma/build/index.js migrate diff --from-schema-datamodel prisma/schema.prisma --to-migrations prisma/migrations --shadow-database-url "$LOCAL_SHADOW_URL" --exit-code` | Passed, no difference |
| Local migration deploy | `node node_modules/prisma/build/index.js migrate deploy` | All 15 migrations applied to a new isolated database |
| Integration suite | `node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts` | 14 files, 186 tests passed |
| No-database build | `node node_modules/next/dist/bin/next build`, database vars absent | Passed |
| Database-backed build | Same command, isolated local database vars supplied | Passed |
| Environment contract | `node scripts/config/validate-environment.mjs --repository` | Passed |
| Diff hygiene | `git diff --check` | Passed |
| Dependency security | `pnpm dlx npm@11.16.0 audit --audit-level=high --json` | Failed: 11 inherited findings, 2 moderate / 8 high / 1 critical |

Direct Node commands invoke the same binaries/arguments as the corresponding
package scripts. npm/npx and Git Bash were supplied from existing local tool
paths. Host Node is 24.19.0; CI pins 24.18.0. The existing embedded local
Postgres 16.13 server was reused on loopback port 55439, with separate synthetic
notification test/shadow databases. Initial use of a nonexistent local role was
corrected to the existing local validation role before successful checks.
No hosted database or provider was accessed by these tests.

## Evidence exercised

- Stable Resend request/key and sender; accepted POST cannot claim delivery.
- Exact email readback correlation; wrong recipient/body/sender/message/CC/BCC
  cannot certify delivery. Vendor errors and malformed responses are redacted.
- Disabled flags, missing credentials/sender and foreign account fail closed.
- Hosted/production dispatch and inspection refuse an unset auth-required gate.
- Qualified interaction: one synthetic send, retained owner/task/message IDs,
  separate acceptance and delivery observations; replay produces no second POST.
- Concurrent database claims, lost provider response and failed local commit
  preserve request identity and safe retry. Known message IDs are polled only.
- Active lease blocks retry; expired lease reuses the same key within the bounded
  window. Unknown outcome past 23 hours requires reconciliation, never resend.
- Maybe, incomplete, unqualified and spam reclassification, revoked policy,
  changed recipient/payload, wrong owner and missing CRM capture suppress send.
- Policy revoked during owner readback stops before send. Observed terminal
  delivery evidence survives later policy revocation without another send.
- Bounce is terminal failure; status inspection returns metadata without
  recipient, call message or private owner ID. New/retry batch selections keep
  held/terminal records from starving fresh work.

## Merge and commissioning remain blocked

Live GitHub inspection on 2026-10-06 confirmed PR193 remains open/draft/unmerged.
Its [CI run 37509797499](https://github.com/AudioJones-Dev/responseos/actions/runs/37509797499)
failed both `validate` and `integration` at `npm audit --audit-level=high`;
subsequent runtime checks were skipped. This branch changes no dependency
manifest or lockfile and preserves that independent merge blocker. Do not
mark either increment ready from local functional tests alone.

The new branch's GitHub CI result must be read separately after publication;
the parent result is not evidence that this branch ran its functional checks.

No live send, recipient inbox receipt, immediate dispatcher cadence, 24/7 Sam
availability or human callback timing is proved by this artifact. Resolve
owner/configuration, sender/provider authorization, dispatcher invocation
ownership, privacy/consent and the controlled candidate test in the
[delivery contract](../product/frl-qualified-notification-delivery.md).
Automatic Git deployment remains disabled; Workstream F remains prepared.
