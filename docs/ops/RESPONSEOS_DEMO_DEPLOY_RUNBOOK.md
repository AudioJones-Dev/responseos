# ResponseOS — Mock-Safe Demo Deploy Runbook

**Status:** Operational checklist for Gate Set A ([`RESPONSEOS_V0_3_READINESS_GATES.md`](./RESPONSEOS_V0_3_READINESS_GATES.md)).
**Does not authorize a deploy by itself** — founder must complete ADR-0046 Gate A1 and provision secrets (L-02).

## Host topology (ADR-0019 / ADR-0026)

- **App:** Vercel project (preview or dedicated demo project)
- **DB:** Neon Postgres branch
- **Secrets:** Doppler config (ADR-0038) or Vercel env — never commit values
- **Auth:** Clerk + `RESPONSEOS_REQUIRE_AUTH=1` (ADR-0039)

## Required env (hosted demo)

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` / `DIRECT_URL` | yes | Neon |
| `CLERK_SECRET_KEY` | yes | Fail-closed with A2 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | |
| `RESPONSEOS_REQUIRE_AUTH` | yes | Set to `1` |
| `NEXT_PUBLIC_APP_URL` | yes | Public demo URL |
| `CLERK_WEBHOOK_SECRET` | if Clerk webhooks enabled | Fail-closed without it |
| `AUDIT_NOTIFY_WEBHOOK` | optional | Operator notify for `/audit` |
| Live provider keys | **no** | Must remain unset for mock-safe demo |

## One-shot DB provision

```bash
npx prisma migrate deploy
npx prisma db seed
```

## Public surfaces (must stay reachable with auth required)

- `/`, `/pricing`, `/audit`, `/trust`, `/demo/*`, `/industries/*`
- `/api/health`, `/api/audit-requests`
- `/sign-in`, `/sign-up`, `/api/webhooks/*`

## Pre-promote smoke

1. `GET /api/health` → `status: ok`, version matches `package.json`
2. Anonymous `GET /admin` → redirect to `/`
3. Anonymous `GET /client/dashboard` → redirect to `/`
4. Anonymous `GET /demo/walkthrough` → 200
5. Confirm Gate A11 is accepted and implemented: a valid
   `POST /api/audit-requests` records the canonical intake event before its
   derived assessment, and replaying the same `Idempotency-Key` does not create
   another assessment
6. Confirm Gate A12 host/edge abuse control returns `429` under the approved
   test policy; do not substitute an in-memory process limiter
7. Confirmed: no live provider secrets in the env

## Rollback

- Disable the Vercel deployment / unassign domain
- Leave `master` auto-deploy **disabled** (`vercel.json`)
- Rotate Clerk/Doppler credentials if exposure suspected
