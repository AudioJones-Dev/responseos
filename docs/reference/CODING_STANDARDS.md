# ResponseOS Coding Standards

**Status:** Draft reference baseline. Pending Audio approval.
**Scope:** Engineering standards for code changes in ResponseOS.

## Source of Truth

This document summarizes repo standards already enforced by:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/SECURITY.md`
- TypeScript, ESLint, Vitest, Prisma, and CI

If this document conflicts with `AGENTS.md` or accepted ADRs, `AGENTS.md` and ADRs win.

## General Standards

- Use TypeScript strict mode.
- Keep changes scoped to the approved task.
- Prefer existing local patterns over new abstractions.
- Do not introduce live provider integrations before v0.3 authorization.
- Do not introduce Firebase.
- Do not commit secrets or print secret values.
- Do not represent ResponseOS as HIPAA-certified.
- Do not push directly to `master`.

## Next.js Standards

- This repo uses Next.js App Router.
- Before framework-sensitive edits, read the relevant local Next.js guide under `node_modules/next/dist/docs/`.
- Keep route handlers under `app/api/**/route.ts`.
- Preserve the canonical response envelope unless an approved API decision changes it.

## Data and API Standards

- Prisma schema changes require a migration.
- Tenant-scoped reads/writes must use session-derived `accountId`.
- Do not trust client-supplied tenant identifiers for authorization.
- Webhook handlers must verify signatures before parsing or mutating when they handle live provider traffic.
- Provider callbacks must be deduped before business mutation.
- API/data doc changes should reconcile `docs/api-spec.md`, `docs/data-schema.md`, and `prisma/schema.prisma` when contracts change.

## Provider Standards

- Provider adapters must fall back to mock behavior when env vars are missing.
- Live provider behavior requires explicit v0.3 authorization.
- New provider work must document signature validation, failure modes, mock fallback, and observability implications.

## Testing Standards

Run when applicable:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration
```

If integration tests cannot run because Postgres is unavailable, record the blocker. Do not claim full green health.

## Documentation Standards

- New architecture decision: update `docs/DECISIONS.md` or the approved ADR location.
- New milestone/scope change: update `docs/ROADMAP.md`.
- Merged PR: update `docs/CHANGELOG.md`.
- Tracked work: update `dashboard/dashboard-data.json`.
- Do not delete existing docs without explicit approval.
- Mark stale docs historical or superseded when appropriate.

