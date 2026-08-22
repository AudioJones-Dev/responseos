# Env Spec

## Purpose

This document is the **environment-variable contract** for ResponseOS: what each variable is, whether
it is required or optional, which environments need it, and what the app does when it is absent. The
template lives in [`.env.example`](../.env.example) at the repo root (checked in, **placeholder values
only**). Copy it to `.env.local` (gitignored) and fill in real values for local dev.

> **Hard rule:** **never commit real secrets.** `.env.example` is placeholders only; `.env.local` is
> gitignored and must never be committed. Real values live in the platform's env store (Vercel env
> today; see [Future work](#future-work) for the secret-store decision) — not in this repo.

**Mock-first invariant (ADR-0001):** the app **boots and runs with zero secrets**. A provider key can
select a live path only when its factory also supplies an explicitly authorized `createLive`
implementation. The current CAL factories omit `createLive`, so they remain mock even when their
placeholder keys are present. **Local development never requires a secret.**

## Variable groups

### App
- `NEXT_PUBLIC_APP_URL` — base URL the browser sees (e.g. `http://localhost:3000`).
- `NODE_ENV` — `development` / `production` / `test`.
- `RESPONSEOS_BUILD_SHA` — non-secret deployment identity injected by the staging workflow; `/api/health` reports it so the deployed artifact can be matched to the reviewed commit.

### Database (Postgres — Neon default per ADR-0026)
- `DATABASE_URL` — pooled connection string used at runtime.
- `DIRECT_URL` — non-pooled connection string used by Prisma migrations.
- `RESPONSEOS_DATABASE_IDENTITY` — governed-custom-environment-only, non-secret version 2 JSON attestation binding canonical Neon identity and fingerprint, exact Vercel Sensitive DB variable ids/revisions, Vercel project id, and custom environment id/slug. Version 1 or any changed scope/id/revision is rejected for custom-environment certification.

The GitHub `staging` Environment also requires a least-privilege `NEON_API_KEY` for read-only control-plane verification. It is workflow-only, is never passed to Vercel or the application, and must not appear in `.env.example` as an application variable.

### Auth (Clerk)
- `CLERK_SECRET_KEY` — server-side; setting it activates the Clerk session path (`lib/auth/session.ts`) + `proxy.ts` route protection. Absent → placeholder dev-session + pass-through proxy (ADR-0001).
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — client-side.
- `CLERK_WEBHOOK_SECRET` — Svix HMAC for `/api/webhooks/clerk` (ADR-0009). Absent → webhook fails closed (503), no mutation.
- `AJ_DIGITAL_CLERK_ORG_ID` — the AJ Digital cross-tenant control org (members → `Session.account = null`).
- `RESPONSEOS_REQUIRE_AUTH` — **optional locally and required on hosted staging**, read by `lib/auth/auth-required.ts` and consumed by both
  `lib/auth/session.ts` and `proxy.ts` (ADR-0039). Set it (any value other than `0`/`false`) on any
  hosted surface that must authenticate. With it set and `CLERK_SECRET_KEY` absent, the session
  resolves to `null` and the proxy redirects non-public paths to `/`, instead of falling back to the
  privileged cross-tenant `aj_admin` placeholder (gap D2).
  - **Absent → unchanged mock-first behaviour** for local dev, CI, and `next build` (ADR-0001).
  - **Hosted staging contract:** set it alongside the Clerk keys. The manual staging workflow rejects
    the deployment before migration or build when this flag is absent or disabled.
  - **Mock-staging Clerk posture:** the publishable key must be `pk_test_`; the private key must be a
    known `sk_test_` from the same Clerk development instance. Keep the private key and webhook
    secret marked Sensitive in the governed Vercel custom environment. Vercel intentionally does not return Sensitive values
    to `vercel pull`, so the workflow verifies their name/scope/type and the human approval gate
    verifies same-instance provenance before a deployment retry.

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

### Telephony / AI Voice / Email / Billing / Workflows / CRM / Scheduling / Observability
- **Telnyx post-call ingest:** `TELNYX_PUBLIC_KEY` verifies Ed25519 webhooks; `RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED=true`, `RESPONSEOS_DEMO_ACCOUNT_ID`, and `RESPONSEOS_DEMO_PHONE_E164` are all required before ingestion accepts traffic. `TELNYX_API_KEY` alone activates nothing, and `CarrierProvider` remains mock-only because ResponseOS does not control realtime audio in this slice.
- **AI Voice:** `RETELL_API_KEY`, `VAPI_API_KEY`, `BLAND_API_KEY`.
- **Email (Resend):** `RESEND_API_KEY`, `EMAIL_FROM`.
- **Billing (Stripe):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- **Workflows (n8n):** `N8N_WEBHOOK_SECRET`, `N8N_BASE_URL`.
- **CRM:** `GHL_API_KEY` (HighLevel); HubSpot execution requires both `HUBSPOT_ACCESS_TOKEN` and `RESPONSEOS_LIVE_HUBSPOT_ENABLED=true`. Missing configuration or a disabled flag resolves to the deterministic mock adapter.
- **Scheduling:** `CALENDLY_API_KEY`.
- **Observability:** `SENTRY_DSN`, `POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`.

> Provider-group vars remain optional and mock-safe (ADR-0001). Telnyx post-call ingestion and the
> HubSpot adapter are wired only behind their explicit enable flags and complete live-demo
> configuration; every other provider listed here remains mock or unimplemented.

### Demo and GTM controls
- `RESPONSEOS_DEPLOYMENT_LANE` — non-secret lane label. Supported operational values are `mock-staging` and `live-demo`; it never activates providers by itself.
- `RESPONSEOS_DEMO_ACCOUNT_ID` — server-owned tenant receiving signed live-demo call evidence.
- `RESPONSEOS_INBOUND_ACCOUNT_ID` — server-owned tenant receiving public audit requests.
- `RESPONSEOS_PUBLIC_AUDIT_INTAKE_ENABLED` — exact public-path gate for `POST /api/audit-requests`. Keep false until path-scoped WAF rate limiting and bot protection are configured and a real `429` has been observed.
- `RESPONSEOS_AUDIT_NOTIFICATION_WEBHOOK_URL` — optional reference-only notification target. No prospect PII is included; delivery times out after three seconds and cannot roll back a persisted intake.
- `RESPONSEOS_LIVE_CALL_DEMO_PUBLIC` — controls whether `/demo/live-call` and its server-rendered number are visible.
- `RESPONSEOS_DEMO_PHONE_E164` — server-only E.164 demo number rendered only behind the visibility flag and used to reject events for other destinations.
- `RESPONSEOS_DEMO_RESET` — explicit reset-command enable; the command additionally requires `RESPONSEOS_DEPLOYMENT_LANE=mock-staging` and refuses production.
- `RESPONSEOS_PROSPECT_PURGE_ENABLED` — explicit non-production PII purge-command enable.
- `RESPONSEOS_PROSPECT_BOOTSTRAP_ENABLED` — exact activation gate for an already-reviewed, number-assigned personalized bootstrap. It does not acquire or purchase a number and is insufficient without signed Telnyx ingest, a current approved snapshot, and valid provider attestation.
- `RESPONSEOS_PROVIDER_ATTESTATION_PUBLIC_KEY` — Ed25519 public key used only to verify short-lived provider-workflow readback attestations. The signing key and Telnyx API credential never enter the app runtime.
- `RESPONSEOS_PROMOTION_IMPORT_ENABLED` — separate default-deny gate for importing an allowlisted promotion manifest into a new disabled customer tenant. It does not activate the imported tenant and is never required for demo operation.

## Required / optional matrix

`—` = not needed · `opt` = optional · `req` = required · `mock` = optional, mock fallback when absent ·
`never` = must not be set.

| Variable | Local Dev | CI/Test | Preview / Staging | Production | Required? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | opt | `test` | `production` | `production` | opt | framework-set in most envs |
| `NEXT_PUBLIC_APP_URL` | opt | opt | req | req | opt locally | base browser URL; staging host per Path A runbook |
| `DATABASE_URL` | mock | req (integration) | req | req | mock-first | unit tests run keyless; integration needs Postgres |
| `DIRECT_URL` | mock | req (integration) | req | req | mock-first | Prisma migrations only |
| `RESPONSEOS_DATABASE_IDENTITY` | — | — | req (Path A) | — | staging-only | non-secret Vercel revision attestation; missing/stale/conflicting evidence blocks migration |
| `CLERK_SECRET_KEY` | mock | — | req (Path A) | req (live auth) | mock-first | absent → dev-session + pass-through proxy |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | mock | — | req (Path A) | req (live auth) | mock-first | client-side |
| `CLERK_WEBHOOK_SECRET` | mock | — | req (Path A) | req (clerk webhook) | mock-first | absent → 503 fail-closed |
| `AJ_DIGITAL_CLERK_ORG_ID` | opt | opt | req (control org) | req (control org) | opt | cross-tenant control org |
| **`RESPONSEOS_DEV_SESSION`** | opt | set by tests | **never** (hosted) | **never** | opt | dev/test override; hard-fails in production |
| **`RESPONSEOS_REQUIRE_AUTH`** | — | — | req (any hosted surface) | req | opt | absent → mock-first fallback; set → session + proxy fail closed (ADR-0039) |
| **`RESPONSEOS_PROVIDER_KEY`** | mock | mock | opt (Path A) | req (live creds, v0.3+) | mock-first | base64 32-byte AES; absent → encryption mock mode |
| `RESPONSEOS_PROSPECT_BOOTSTRAP_ENABLED` | opt | opt | **never (Path A)** | req (personalized live-demo only) | opt/default-deny | activation gate only; no provider resource mutation |
| `RESPONSEOS_PROVIDER_ATTESTATION_PUBLIC_KEY` | opt | opt | **never (Path A)** | req (personalized live-demo only) | opt/default-deny | verification-only public key; signing key stays outside runtime |
| `RESPONSEOS_PROMOTION_IMPORT_ENABLED` | opt | opt | **never (Path A)** | req (authorized import only) | opt/default-deny | creates a disabled customer draft; never enables it |
| R2 / Telnyx / Twilio / Retell / Vapi / Bland / Stripe / GHL / HubSpot / Calendly | mock | mock | **never (Path A)** | req (when live) | mock-first | staging preflight rejects live-provider/storage credentials; keys alone do not activate a live factory |
| Resend / n8n | mock | mock | mock (Path A) | req (when live) | mock-first | no live behavior in the mock staging slice |
| `SENTRY_DSN` / `POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_KEY` | opt | opt | opt | opt | opt | observability; see staging runbook §6 |

Path A staging checklist (operator): [`ops/RESPONSEOS_STAGING_HOSTING_RUNBOOK.md`](./ops/RESPONSEOS_STAGING_HOSTING_RUNBOOK.md).

## Mock-first / keyless boot rules

1. **The app boots with no env file.** Unit tests, `npm run build`, and local `npm run dev` all run
   keyless; mock fixtures back every screen (ADR-0001).
2. **Provider adapters fall back to mock** when their env vars are missing. The Stage B CAL factories
   also remain mock when keys are present because they do not supply `createLive`.
3. **`RESPONSEOS_PROVIDER_KEY` absent → encryption mock mode** (redacted sentinel; deterministic mock
   credentials). Never an error.
4. **`RESPONSEOS_DEV_SESSION` absent → default placeholder session** (`aj_admin`) when Clerk is also
   absent. Setting it in production is a hard fail by design.
5. **CI integration** is the only lane that needs a real connection — a throwaway Postgres 16 service
   container with a `DATABASE_URL` to it. No vendor secrets are required for CI.
6. **Hosted staging migration** additionally requires canonical Neon identity proof: both GitHub URLs must derive the same endpoint/database, Vercel's non-secret attestation must match those identities and the current Sensitive-variable revisions, and the Neon API must bind that endpoint/database to project `patient-snow-16014934` branch `br-mute-boat-a6ylen11`.

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
