# Env Spec

The full template lives in `.env.example` at the repo root. It is checked into the repo with **placeholder values only**. Copy to `.env.local` (gitignored) and fill in real values for local dev.

> **Hard rule:** never commit real secrets. Real keys go in Secrets Manager / Vercel env / AWS Secrets Manager — not in this repo.

## Variable groups

### App
- `NEXT_PUBLIC_APP_URL` — base URL the browser sees (e.g. `http://localhost:3000`).
- `NODE_ENV` — `development` / `production` / `test`.

### Database (Postgres / Supabase)
- `DATABASE_URL` — pooled connection string used at runtime.
- `DIRECT_URL` — non-pooled connection string used by Prisma migrations.

### Auth (Clerk)
- `CLERK_SECRET_KEY` — server-side.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — client-side.

### Storage (Cloudflare R2)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` — for call recordings + quote photos.

### Telephony (Twilio)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.

### AI Voice
- `RETELL_API_KEY`, `VAPI_API_KEY`, `BLAND_API_KEY`.

### Email (Resend)
- `RESEND_API_KEY`, `EMAIL_FROM`.

### Billing (Stripe)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

### Workflows (n8n)
- `N8N_WEBHOOK_SECRET`, `N8N_BASE_URL`.

### CRM
- `GHL_API_KEY` (HighLevel), `HUBSPOT_ACCESS_TOKEN`.

### Observability
- `SENTRY_DSN`, `POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`.

## Graceful missing-env handling

Provider adapters in `lib/providers/*` are designed to **fall back to mock** when the corresponding env var is missing. The app boots and runs without any real keys; mock fixtures back every screen. This is intentional for v0.1.

When you add a real provider integration in v0.3:
1. Adapter reads its env vars at construction time.
2. If any required var is empty, it logs once at startup and the adapter exposes its mock implementation.
3. If all vars are present, the adapter uses the real client.

## Naming + scoping conventions

- Server-only secrets: never prefixed with `NEXT_PUBLIC_`.
- Anything client-bundled: prefixed with `NEXT_PUBLIC_`. Treat it as public.
- Tenant-specific keys (e.g. a per-workspace HighLevel API key) live in the database, not `.env` — encrypted at rest, decrypted at request time.

## Rotation

Per the deep research report, vendor keys, webhook secrets, DB credentials, and signing keys live in AWS Secrets Manager (or Vercel env for v0.1) with automatic rotation where possible. Webhook signing secrets rotate alongside provider configuration changes; long-lived API keys are rotated quarterly.
