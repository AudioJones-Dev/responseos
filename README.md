# ResponseOS

**AI Revenue Recovery Platform.** Built by AJ Digital LLC / Audio Jones.

> ResponseOS helps service businesses recover missed revenue by capturing demand, responding instantly, qualifying leads, booking opportunities, and reporting ROI.

## v0.1 scope (this repo, today)

- Internal AJ Digital operator console (`app/(admin)/`).
- Read-only client dashboard (`app/(client)/`).
- Public marketing surface (`app/(marketing)/`).
- 24 API + webhook route stubs returning canonical mock envelopes.
- Mock provider adapters only — no live Twilio / Retell / Vapi / Stripe / GHL / HubSpot calls.
- 11 typed data models in `types/` and a matching Prisma schema stub in `prisma/schema.prisma` (no migrations yet).
- Utility math: `lib/revenue/calculate{RecoveredRevenue,RoiMultiple}.ts` and `lib/scoring/leadQualificationScore.ts`.
- Mock fixtures in `lib/mock/` back every page.
- Full product + architecture docs under `docs/` (start at [`docs/README.md`](./docs/README.md)).

## Tech stack

- Next.js 16 App Router (top-level `app/` with route groups `(marketing)`, `(admin)`, `(client)`).
- TypeScript (strict).
- Tailwind CSS v4.
- ESLint v9.
- Prisma (schema stub; v0.2 wires the real DB).
- Future: Clerk auth, Cloudflare R2 storage, Postgres / Supabase.

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
```

## Validation

```bash
npm run lint
npm run typecheck
npm run build
```

## Environment policy

- **Only** `.env.example` is committed; it contains placeholder keys.
- Copy to `.env.local` (gitignored) for local runs.
- **No real secrets in this repo, ever.** Provider adapters fall back to mock when env vars are missing, so the app boots and runs without any live keys.

## Hard constraints

- No Firebase.
- No live provider integrations in v0.1 — everything is mocked.
- No deploys from this repo yet (no Vercel, no AWS).
- v0.2 schema expansion (events ledger, accounts/leads split, etc.) is **documented only**; do not implement against it yet.

## Current status

Local v0.1 foundation. Branch `master`, no commits yet, no remote — first commit awaits explicit authorization after review.

## Where to read next

- [`docs/README.md`](./docs/README.md) — index of all product + architecture docs.
- [`docs/product-spec.md`](./docs/product-spec.md) — what ResponseOS is and the v0.1 → v0.2 → v0.3 roadmap.
- [`docs/architecture.md`](./docs/architecture.md) — event-ledger-first design and the three deployment lanes.
- [`docs/api-spec.md`](./docs/api-spec.md) — canonical envelope, routes, idempotency rules.
- [`docs/automation-flows.md`](./docs/automation-flows.md) — the seven RECOVER flows.
