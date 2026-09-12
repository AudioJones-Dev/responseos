# Review remediation — prospect transport and CRM retries

Status: implementation authorized by Audio's “proceed” following the review.

- Problem: pinned HTTPS lookup uses the wrong callback shape; request deadlines end at headers; concurrent CRM retries can duplicate provider writes.
- Outcome: real website acquisition honors Node lookup modes and bounds body consumption; one worker owns each pending or retryable CRM operation.
- Success criteria: regression tests cover both lookup modes, stalled robots/page bodies, redirect cancellation, and concurrent CRM execution with one set of provider effects.
- Scope: website transport, CRM operation claiming, regression tests, progress board.
- Out of scope: provider activation, credentials, deployment, schema changes, automatic recovery of abandoned processing operations.
- Constraints: preserve validated-address pinning, tenant scope, provider kill switches, existing provider-ID checkpoints, and mock-first behavior.
- Existing assets: ADR-0047/0048, website acquisition, CRM sync service, unit and Postgres integration suites.
- Plan: correct callback shape; retain request cancellation through bounded body reads; atomically claim eligible operations; validate regressions and repository checks.
- Risks: crashed CRM workers remain processing and require reconciliation before retry; never automatically reclaim while a worker may still write.
- Open questions: none blocking this bounded fix.

## Validation

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 52 files / 594 tests passed with Git for Windows Bash prepended to the command-local PATH. The initial run timed out in three existing Bash syntax checks when the Windows/WSL launcher was selected.
- `npm run build`: passed.
- `git diff --check`: passed.
- Added a Postgres concurrency regression in `tests/integration/crm-sync.integration.test.ts`; database integration validation was not run because the Docker Desktop Linux engine is unavailable.
- Validation used the existing installation: Node v26.8.1, Next.js 16.2.12, Vitest 4.1.10. These differ from the manifest's Node 24.18.0, Next.js 16.3.4 and Vitest ^4.1.11; clean-install/CI validation remains required before merge.

Risk boundary: runtime retry ownership and website request handling only. No schema, provider configuration, credentials, deployment, commit, or push changes. Abandoned processing operations require reconciliation before a retry is authorized.
