# ResponseOS — v0.3 Readiness Gates

**Owner:** AJ Digital LLC / Audio Jones
**Status:** Canonical evidence checklist
**Date:** 2026-08-18
**Canon:** ADR-0001 · ADR-0009 · ADR-0019 · ADR-0031–0039 · ADR-0045 · [`responseos-v0.3-founding-pilot-scope.md`](../product/responseos-v0.3-founding-pilot-scope.md)

These are two different gates. A mock-only staging deployment can clear Gate Set A without clearing Gate Set B. Live phone, SMS, CRM, scheduling, billing, or provider-webhook mutations require the matching staged authorization and Gate Set B evidence.

## Gate Set A — Mock-only authenticated staging

Clears a non-production staging surface for private operator testing. It authorizes no live provider traffic and no prospect access.

| # | Gate | Evidence |
|---|---|---|
| A1 | Written Stage C authorization | Recorded operator instruction naming Stage B reconciliation and secure staging only |
| A2 | Dedicated staging target selected | `audiojones/responseos-staging-mock`; workflow fails closed on name/team/project mismatch |
| A3 | GitHub `staging` Environment has reviewer and branch protection | GitHub Environment settings |
| A4 | `RESPONSEOS_REQUIRE_AUTH=1` and same-instance development Clerk variables are present | Value-redacting Preview metadata preflight + human verification of write-only private key/webhook/org provenance |
| A5 | `RESPONSEOS_DEV_SESSION` and all live-provider credentials are absent | Value-redacting workflow preflight |
| A6 | GitHub migration URLs and Vercel Preview runtime URLs are proven to resolve to canonical Neon project `patient-snow-16014934`, branch `br-mute-boat-a6ylen11`, endpoint `ep-young-morning-a6oeu9vv`, database `neondb`, with pooled runtime/direct migration roles before migration | Credential-free URL-derived identity + Vercel Sensitive-variable revision attestation + live Neon control-plane metadata |
| A7 | Migration deploy is mandatory; no skip or pooled-URL fallback | `.github/workflows/deploy-staging.yml` |
| A8 | Project/build use Node 24.x and exact reviewed SHA | Fail-closed project metadata + workflow log + `/api/health` |
| A9 | Public `/demo` responds while anonymous protected routes do not return application content | Post-deploy smoke |
| A10 | Clerk webhook invalid-signature path produces no mutation | Route test + staging delivery evidence |
| A11 | Tenant user resolves only the mapped staging account | Integration suite + authenticated staging smoke |
| A12 | Rollback to the previous staging artifact is recorded and exercised | Staging runbook evidence |

**Current state:** PR #126 is merged and post-merge CI is green. The dedicated Vercel project, GitHub staging Environment, Node 24.x, core Preview variable names, protected-smoke bypass, and private Clerk same-development-instance provenance are verified. A staging Environment secret named `NEON_API_KEY` exists, but its value, validity, and project scope remain unverified until the protected preflight succeeds. PR #128 contains the unmerged configuration-only verification controls and shared staging concurrency lock. A current Vercel database revision attestation, staging deployment/migration, authenticated tenant smoke, and rollback exercise remain uncleared.

The public `/audit` form is not a Gate Set A prospect-capture path until canonical persistence/idempotency and durable host-level abuse controls are implemented and verified. Do not make `/api/audit-requests` public merely to make the form submit.

## Gate Set B — Live provider staging/pilot

Required before any live phone, SMS, CRM, scheduling, billing, or provider-webhook business mutation.

| # | Gate | Evidence |
|---|---|---|
| B1 | Separate written authorization for the exact provider stage | Founding-pilot staged authorization record |
| B2 | Gate Set A is fully cleared | Completed Gate Set A evidence packet |
| B3 | Provider contracts, enums, and deterministic mocks are merged | Source, migration, unit/integration tests |
| B4 | Every live webhook verifies signature and freshness before parsing or mutation | Invalid/stale/replay tests with no-mutation proof |
| B5 | Live adapter is behind its factory and falls back to mock when configuration is absent | Factory and contract tests |
| B6 | Provider event IDs and canonical call/message identities are concurrency-safe and idempotent | Migration and integration tests |
| B7 | Provider-to-tenant resolution is server-owned and isolation-tested | Tenant matrix + live-path tests |
| B8 | Production credential posture decision is accepted before production storage | ADR + secret-store evidence |
| B9 | Minimum error tracking, alerting, retry/dead-letter behavior, kill switch, and spend controls are exercised | Staging failure drill |
| B10 | One outside-number rehearsal and human go/no-go are recorded | Evidence packet and operator approval |

**Forbidden until Gate Set B clears:** live Telnyx, Twilio, Vapi, Retell, HubSpot, Calendly, Stripe, or other provider traffic; real client data; production aliases; distributing a demo phone number; claims of production-ready communications or CRM sync.

## Related runbooks

- [`RESPONSEOS_STAGING_HOSTING_RUNBOOK.md`](./RESPONSEOS_STAGING_HOSTING_RUNBOOK.md) — Gate Set A provisioning, deploy, smoke, and rollback.
- [`RESPONSEOS_DEPLOYMENT_PLAN.md`](./RESPONSEOS_DEPLOYMENT_PLAN.md) — target topology and release process.
- [`responseos-v0.3-provider-readiness.md`](../product/responseos-v0.3-provider-readiness.md) — provider planning baseline.
- [`responseos-v0.3-live-call-demo-slice.md`](../product/responseos-v0.3-live-call-demo-slice.md) — bounded live-call scope; planning only.
