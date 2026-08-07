# Env Spec

## Purpose

This document is the **environment-variable contract** for ResponseOS: what each variable is, whether
it is required or optional, which environments need it, and what the app does when it is absent. The
template lives in [`.env.example`](../.env.example) at the repo root (checked in, **placeholder values
only**). Copy it to `.env.local` (gitignored) and fill in real values for local dev.

> **Hard rule:** **never commit real secrets.** `.env.example` is placeholders only; `.env.local` is
> gitignored and must never be committed. Real values live in the platform's env store (Vercel env
> today; see [Future work](#future-work) for the secret-store decision) — not in this repo.

**Mock-first invariant (ADR-0001):** the app **boots and runs with zero secrets**. Every provider is
mocked until its key is present, and the two ResponseOS-internal overrides below are optional. **Local
development never requires a secret.**

## Variable groups

### App
- `NEXT_PUBLIC_APP_URL` — base URL the browser sees (e.g. `http://localhost:3000`).
- `NODE_ENV` — `development` / `production` / `test`.

### Database (Postgres — Neon default per ADR-0026)
- `DATABASE_URL` — pooled connection string used at runtime.
- `DIRECT_URL` — non-pooled connection string used by Prisma migrations.

### Auth (Clerk)
- `CLERK_SECRET_KEY` — server-side; setting it activates the Clerk session path (`lib/auth/session.ts`) + `proxy.ts` route protection. Absent → placeholder dev-session + pass-through proxy (ADR-0001).
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — client-side.
- `CLERK_WEBHOOK_SECRET` — Svix HMAC for `/api/webhooks/clerk` (ADR-0009). Absent → webhook fails closed (503), no mutation.
- `AJ_DIGITAL_CLERK_ORG_ID` — the AJ Digital cross-tenant control org (members → `Session.account = null`).
- `RESPONSEOS_REQUIRE_AUTH` — **optional**, read by `lib/auth/auth-required.ts` and consumed by both
  `lib/auth/session.ts` and `proxy.ts` (ADR-0039). Set it (any value other than `0`/`false`) on any
  hosted surface that must authenticate. With it set and `CLERK_SECRET_KEY` absent, the session
  resolves to `null` and the proxy redirects non-public paths to `/`, instead of falling back to the
  privileged cross-tenant `aj_admin` placeholder (gap D2).
  - **Absent → unchanged mock-first behaviour** for local dev, CI, `next build`, and the mock-safe
    hosted demo, whose prerendered pages must still render mock data (ADR-0001).
  - **Deploy checklist item:** because the trigger is opt-in, forgetting it leaves a hosted deploy
    fail-open. Set it alongside the Clerk keys, not after.

### Dev session override (local / test / dev only)
- `RESPONSEOS_DEV_SESSION` — **optional**, read by `lib/auth/session.ts`. Forces a fixed placeholder
  session, bypassing Clerk, for local dev + tests.
  - **Must never be set in production.** `lib/auth/session.ts` throws `DevSessionInProductionError`
    when it is set under `NODE_ENV=production` (hard fail — verified by `tests/unit/session.test.ts`).
  - **Supported values** (must match the keys in `lib/auth/session.ts`): `aj_admin` (default),
    `operator`, `client_admin@org_mock_1`, `client_viewer@org_mock_1`.
  - **Fallback when omitted:** with Clerk also absent, the session resolves to the default placeholder
    (`aj_admin`); with Clerk present (non-production) an explicit value still wins. Local boot needs no value.

### Provider credential encryption (ADR-0020)
- `RESPONSEOS_PROVIDER_KEY` — **server-only**, read by `lib/providers/encryption/index.ts`.
  - **Server-only; never prefix with `NEXT_PUBLIC_`.**
  - **Format:** base64-encoded **32 bytes** (AES-256-GCM key).
  - **Required only** when live encrypted provider credentials are used (v0.3+).
  - **Optional / keyless for local mock-first dev.** When absent, empty, or not exactly 32 bytes,
    `readKey()` returns `null` and the encryption module stays in **mock mode** — a redacted sentinel
    is stored and deterministic mock credentials are returned (ADR-0020 §6). Missing key ≠ error.

### Storage (Cloudflare R2)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` — call recordings + quote photos.

### Telephony / AI Voice / Email / Billing / Workflows / CRM / Observability
- **Telephony (Twilio):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.
- **AI Voice:** `RETELL_API_KEY`, `VAPI_API_KEY`, `BLAND_API_KEY`.
- **Email (Resend):** `RESEND_API_KEY`, `EMAIL_FROM`.
- **Billing (Stripe):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- **Workflows (n8n):** `N8N_WEBHOOK_SECRET`, `N8N_BASE_URL`.
- **CRM:** `GHL_API_KEY` (HighLevel), `HUBSPOT_ACCESS_TOKEN`.
- **Observability:** `SENTRY_DSN`, `POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`.

> All provider-group vars are **optional until v0.3** — their adapters fall back to mock when absent
> (ADR-0001). Provider integrations are not wired yet.

## Required / optional matrix

`—` = not needed · `opt` = optional · `req` = required · `mock` = optional, mock fallback when absent ·
`never` = must not be set.

| Variable | Local Dev | CI/Test | Preview / Staging | Production | Required? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | opt | `test` | `production` | `production` | opt | framework-set in most envs |
| `NEXT_PUBLIC_APP_URL` | opt | opt | req | req | opt locally | base browser URL; staging host per Path A runbook |
| `DATABASE_URL` | mock | req (integration) | req | req | mock-first | unit tests run keyless; integration needs Postgres |
| `DIRECT_URL` | mock | req (integration) | req | req | mock-first | Prisma migrations only |
| `CLERK_SECRET_KEY` | mock | — | req (Path A) | req (live auth) | mock-first | absent → dev-session + pass-through proxy |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | mock | — | req (Path A) | req (live auth) | mock-first | client-side |
| `CLERK_WEBHOOK_SECRET` | mock | — | req (Path A) | req (clerk webhook) | mock-first | absent → 503 fail-closed |
| `AJ_DIGITAL_CLERK_ORG_ID` | opt | opt | req (control org) | req (control org) | opt | cross-tenant control org |
| **`RESPONSEOS_DEV_SESSION`** | opt | set by tests | **never** (hosted) | **never** | opt | dev/test override; hard-fails in production |
| **`RESPONSEOS_REQUIRE_AUTH`** | — | — | req (any hosted surface) | req | opt | absent → mock-first fallback; set → session + proxy fail closed (ADR-0039) |
| **`RESPONSEOS_PROVIDER_KEY`** | mock | mock | opt (Path A) | req (live creds, v0.3+) | mock-first | base64 32-byte AES; absent → encryption mock mode |
| R2 / Twilio / Retell / Vapi / Bland / Resend / Stripe / n8n / GHL / HubSpot | mock | mock | mock (Path A) | req (when live) | mock-first | provider adapters mock until authorized |
| `SENTRY_DSN` / `POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_KEY` | opt | opt | opt | opt | opt | observability; see staging runbook §6 |

Path A staging checklist (operator): [`ops/RESPONSEOS_STAGING_HOSTING_RUNBOOK.md`](./ops/RESPONSEOS_STAGING_HOSTING_RUNBOOK.md).

## Mock-first / keyless boot rules

1. **The app boots with no env file.** Unit tests, `npm run build`, and local `npm run dev` all run
   keyless; mock fixtures back every screen (ADR-0001).
2. **Provider adapters fall back to mock** when their env vars are missing — they read env at
   construction, log once if empty, and expose the mock implementation.
3. **`RESPONSEOS_PROVIDER_KEY` absent → encryption mock mode** (redacted sentinel; deterministic mock
   credentials). Never an error.
4. **`RESPONSEOS_DEV_SESSION` absent → default placeholder session** (`aj_admin`) when Clerk is also
   absent. Setting it in production is a hard fail by design.
5. **CI integration** is the only lane that needs a real connection — a throwaway Postgres 16 service
   container with a `DATABASE_URL` to it. No vendor secrets are required for CI.

## Secret handling rules

- **Server-only secrets are never prefixed with `NEXT_PUBLIC_`.** Anything `NEXT_PUBLIC_*` is bundled
  to the client and must be treated as public.
- **`RESPONSEOS_PROVIDER_KEY` is server-only** and must never be exposed to the client.
- **Tenant-specific keys** (e.g. a per-workspace HighLevel key) live **encrypted in the database**, not
  in `.env` — decrypted at request time via the `RESPONSEOS_PROVIDER_KEY`-backed module (ADR-0020).
- **Never commit real secrets.** `.env.example` = placeholders; `.env.local` = gitignored; real values
  in the platform env store.

## Relationship to ADR-0020

`RESPONSEOS_PROVIDER_KEY` is the env-managed key contract from **ADR-0020** (provider credential
encryption: app-layer AES-256-GCM, opaque `Bytes` ciphertext, env-managed key, mock fallback when the
key is absent). This doc only documents the variable; the encryption posture, algorithm, and
mock-fallback behavior are specified in ADR-0020. The v0.2 posture is a **single global env-managed
key**; per-tenant KMS-backed keys are HIPAA-lane / future work (ADR-0004, ADR-0020 §"Future work").

## Secret-store scope (explicit)

- **Doppler is explicitly out of scope** for now. It must not be introduced unless a future superseding
  ADR approves it.
- **AWS Secrets Manager is the documented future target only** — *if/when* secret-store wiring is
  implemented later (see [Future work](#future-work)). It is **not** wired today; Vercel env is the
  current store.

## Future work

- **Env-schema hardening / centralized validation.** **TODO:** a lightweight centralized env helper
  (e.g. `lib/env.ts`) that *parses and warns* (never hard-fails for optional/mockable values, never
  makes local boot require secrets). **Intentionally deferred** from this PR to keep it
  documentation-first and non-breaking — no runtime behavior change. To be added as its own small PR.
- **Secret-store ADR decision.** Choose the production secret store (Vercel env vs AWS Secrets Manager
  vs other) via a superseding ADR before live-secret deployment. Doppler excluded unless an ADR approves it.
- **Key rotation runbook.** Procedure for rotating `RESPONSEOS_PROVIDER_KEY` (the ADR-0020 envelope
  `version` byte supports it) and vendor/webhook/DB credentials. Long-lived keys rotate quarterly;
  webhook secrets rotate with provider config changes.
- **Platform secret migration path.** Moving from env-managed keys to a KMS/secret-store-backed key
  source without a schema change (ADR-0020's `Bytes` column shape is unchanged; only the key-fetch
  contract changes).
- **Ongoing drift detection.** Keep `.env.example` ↔ runtime `process.env.*` usage ↔ this spec in sync
  (this PR resolved the `RESPONSEOS_PROVIDER_KEY` / `RESPONSEOS_DEV_SESSION` drift); add a check to
  catch future drift.
