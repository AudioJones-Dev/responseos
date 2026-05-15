<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent contract — ResponseOS

This file is the contract for any AI agent (Claude Code, Codex, etc.) working in this repo. Read it before editing.

## Before you touch code

1. Read [`docs/PRD.md`](./docs/PRD.md) — what the product is and isn't.
2. Read [`docs/ROADMAP.md`](./docs/ROADMAP.md) — what milestone is in flight and what's explicitly out of scope.
3. Read [`docs/DECISIONS.md`](./docs/DECISIONS.md) — the load-bearing decisions. Don't relitigate them without an ADR update.
4. Skim [`docs/architecture.md`](./docs/architecture.md) — event-ledger-first, multi-tenant, provider-adapter pattern.
5. If you're touching the schema, data layer, or API contracts, read the relevant docs first (`data-schema.md`, `api-spec.md`, `SECURITY.md`).

## Hard rules

- **No live provider integrations** until v0.3 is explicitly authorized. `lib/providers/*` mocks stay in force.
- **No real secrets in the repo.** `.env.example` is placeholders only. If you need a credential to test, ask the human — don't paste one in.
- **No Firebase.**
- **No production deploys** from this repo until v0.3 readiness gates clear.
- **Tenant isolation is non-negotiable.** Every read/write filters by `organizationId` derived from the session, never from client input. See [`docs/SECURITY.md`](./docs/SECURITY.md).
- **Webhook signature validation is mandatory** before any business mutation. See ADR-0009 in [`docs/DECISIONS.md`](./docs/DECISIONS.md).
- **Provider adapters must fall back to mock** when env vars are missing. The app boots and runs without secrets at every version.
- **ResponseOS is not HIPAA-certified.** Don't represent it as compliant in copy, comments, or commits.

## Branch + PR policy

- Develop on a feature branch off the latest commit on the default branch.
- Open PRs as **draft** until CI is green; then mark ready for human merge. PR pattern follows PRs #5 / #6 / #7 / #12.
- Commit messages are imperative and scoped: `feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`. Match the existing log style.
- Never push to `master` directly. Never force-push to a shared branch without explicit approval.

## Validation gates (must pass locally and in CI before merge)

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration   # needs Postgres 16 — see README for the docker one-liner
```

CI runs `validate` (lint + typecheck + unit test + build) and `integration` (Postgres 16 service container, `prisma migrate diff`, `prisma migrate deploy`, `prisma db seed`, integration tests, DB-backed build). Both jobs must be green.

## Documentation hygiene

- New architectural decision → add or update an ADR in [`docs/DECISIONS.md`](./docs/DECISIONS.md).
- New milestone or scope change → update [`docs/ROADMAP.md`](./docs/ROADMAP.md).
- Every merged PR → add a line to [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) (newest first).
- File renames or moves → update cross-references in non-archived docs in the same PR.
- Implementation briefs that have shipped → move to [`docs/archive/`](./docs/archive/).

## Scope discipline

Don't add features, refactor, or introduce abstractions beyond what the task requires. A bug fix doesn't need surrounding cleanup; a one-shot operation doesn't need a helper. Don't design for hypothetical future requirements. Three similar lines is better than a premature abstraction.

Don't add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code and framework guarantees. Only validate at system boundaries (user input, external APIs).

Default to writing no comments. Only add one when the WHY is non-obvious.
