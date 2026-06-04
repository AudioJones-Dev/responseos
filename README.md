# ResponseOS

**AI Revenue Recovery Platform.** Built by AJ Digital LLC / Audio Jones.

> ResponseOS helps service businesses recover missed revenue by capturing demand, responding instantly, qualifying leads, booking opportunities, and reporting ROI.

## Current status (May 2026)

- **v0.1** foundation shipped: internal operator console, read-only client dashboard, marketing surface, 11 typed domain models, mock provider adapters, canonical API envelopes.
- **v0.2 Phases A–D** merged: real Postgres schema + deterministic seed (PR #5), auth + tenant-aware data access layer (PR #6), consumers routed through the v0.2 data layer (PR #7), integration test suite + Postgres-backed CI job (PR #12).
- **v0.2 closeout** in flight: `Organization` → `Account` rename, real Auth.js provider wiring, UI rebuild against `DESIGN.md` tokens, remaining v0.2 data-model expansion (provider_connections, conversations, call_segments / transcripts, workflow_runs, qa_logs).
- **Live provider integrations are still gated to v0.3.** No Twilio / Retell / Vapi / Stripe / GHL / HubSpot calls run against real accounts from this repo. No production deploys.

For the full version table and milestone state see [`docs/ROADMAP.md`](./docs/ROADMAP.md); for the per-PR history see [`docs/CHANGELOG.md`](./docs/CHANGELOG.md).

## What's in the box

- App: Next.js 16 App Router with route groups `app/(marketing)`, `app/(admin)`, `app/(client)`.
- API + webhook route stubs returning canonical envelopes under `app/api/`.
- Domain types in `types/` (11 v0.1 models, expanding in v0.2).
- Prisma schema + first migration (`prisma/migrations/0001_v0_2_foundation`) + deterministic seed.
- Data access layer with tenant scoping in `lib/data/*`; auth scaffold in `lib/auth/*`.
- Mock provider adapters in `lib/providers/*` — every provider falls back to mock when env vars are missing.
- Mock fixtures in `lib/mock/*` back every page; the v0.2 seed mirrors them field-for-field.
- Revenue + scoring math in `lib/revenue/*` and `lib/scoring/*`.
- Unit tests in `tests/unit/`; integration tests in `tests/integration/` against Postgres 16.

## Tech stack

- Next.js 16 App Router. **This is not the Next.js you know** — read the relevant guide in `node_modules/next/dist/docs/` before writing code. See [`AGENTS.md`](./AGENTS.md).
- TypeScript (strict).
- Tailwind CSS v4.
- ESLint v9 (flat config).
- Prisma 6 + Postgres 16.
- Vitest (unit + integration).
- Clerk auth (Standard lane), Cloudflare R2 (Standard lane), Supabase Postgres (Standard lane).

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
```

The app boots with **zero credentials** — every provider falls back to mock when its env vars are missing (ADR-0001). You only need real values to exercise a live path.

### Secrets management (Doppler — optional)

Secrets are managed with [Doppler](https://docs.doppler.com/) as an **opt-in** runtime injector. It is never required: the mock-first fallback above means the app runs without it. See ADR-0038 in [`docs/DECISIONS.md`](./docs/DECISIONS.md).

One-time setup (Doppler CLI must be installed):

```bash
doppler login          # once per machine
doppler setup          # maps this repo to the project/config in doppler.yaml
```

Then run with secrets injected straight from Doppler instead of maintaining a local `.env.local`:

```bash
npm run dev:doppler     # doppler run -- next dev
npm run build:doppler
npm run start:doppler
npm run secrets:check    # list configured secret names (no values printed)
```

`doppler.yaml` (committed) only pins the project/config mapping — it holds no secret values. If you prefer the classic flow, copy `.env.example` to `.env.local` and run the plain `npm run dev` / `npm run build` scripts; both paths work.

Integration tests need a local Postgres:

```bash
docker run --rm -d --name responseos-pg -p 5432:5432 \
  -e POSTGRES_USER=responseos -e POSTGRES_PASSWORD=responseos \
  -e POSTGRES_DB=responseos_test postgres:16
DATABASE_URL=postgresql://responseos:responseos@localhost:5432/responseos_test \
DIRECT_URL=postgresql://responseos:responseos@localhost:5432/responseos_test \
npx prisma migrate deploy && npx prisma db seed && npm run test:integration
```

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration   # needs Postgres
```

CI runs `validate` (lint → typecheck → test → build) and `integration` (Postgres 16 service, `prisma migrate diff`, `prisma migrate deploy`, `prisma db seed`, integration tests, DB-backed build) on every push and PR.

## Environment policy

- **Only** `.env.example` is committed; it contains placeholder keys.
- Copy to `.env.local` (gitignored) for local runs, **or** inject secrets with Doppler (`npm run dev:doppler` — see above). `doppler.yaml` is committed but holds the project/config mapping only, no secret values.
- **No real secrets in this repo, ever.** Provider adapters fall back to mock when env vars are missing, so the app boots and runs without any live keys. Doppler is an opt-in convenience layer, not a requirement (ADR-0038).

## Hard constraints

- No Firebase.
- No live provider integrations until v0.3 is explicitly authorized — `lib/providers/*` mocks stay in force.
- No production deploys from this repo (no Vercel, no AWS) until v0.3 readiness gates clear.
- ResponseOS is **not** HIPAA-certified. The HIPAA-ready lane is a future architectural pattern, not a current product capability.

## Where to read next

- [`docs/README.md`](./docs/README.md) — index of all product + architecture docs.
- [`docs/PRD.md`](./docs/PRD.md) — short product source of truth.
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — version table, what ships when.
- [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) — per-PR history.
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) — architecture decisions (ADRs).
- [`docs/architecture.md`](./docs/architecture.md) — event-ledger-first design and the three deployment lanes.
- [`docs/api-spec.md`](./docs/api-spec.md) — canonical envelope, routes, idempotency rules.
- [`docs/automation-flows.md`](./docs/automation-flows.md) — the seven RECOVER flows.
- [`docs/DESIGN.md`](./docs/DESIGN.md) — visual system and UX spine.
- [`docs/SECURITY.md`](./docs/SECURITY.md) — secrets, signatures, tenant isolation.
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — three deployment lanes, CI/CD, SLOs.
