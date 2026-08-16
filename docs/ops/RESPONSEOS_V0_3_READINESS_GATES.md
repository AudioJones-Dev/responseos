# ResponseOS — v0.3 Readiness Gates

**Owner:** AJ Digital LLC / Audio Jones
**Status:** Canonical checklist. Defines the phrase “v0.3 readiness gates” cited in `AGENTS.md`, `ROADMAP.md`, and deploy docs.
**Date:** 2026-08-06
**Canon:** ADR-0019 · ADR-0031–0037 · ADR-0039 · ADR-0046

> These gates are **two lists**. Conflating them is what blocked honest go-live language. A mock-safe hosted demo may clear **Gate Set A** without clearing **Gate Set B**. Live providers and paying-pilot phone/CRM traffic require **Gate Set B** plus written authorization (ADR-0046).

---

## Gate Set A — Mock-safe demo deploy

Clears a **production-facing, mock-safe hosted demo** (ADR-0019). No live Telnyx/Vapi/HubSpot/Calendly traffic.

| # | Gate | Evidence |
|---|---|---|
| A1 | Founder authorizes the demo carve-out | ADR-0046 + ROADMAP carve-out |
| A2 | `RESPONSEOS_REQUIRE_AUTH=1` on the hosted env | Host env checklist |
| A3 | Clerk keys present (`CLERK_SECRET_KEY`, publishable key) | Host env; no basic-auth shim |
| A4 | Public allowlist includes marketing + demo + `/api/audit-requests` + `/api/health` | `lib/auth/route-protection.ts` |
| A5 | Fail-closed verified: anonymous `/admin` and `/client/*` redirect | Live smoke (BUILD_STATUS §3e pattern) |
| A6 | Neon (or Postgres) provisioned; `migrate deploy` + seed run once | Host runbook |
| A7 | `vercel.json` keeps `master` auto-deploy **disabled** unless separately authorized | `vercel.json` |
| A8 | Version identity coherent (`package.json` ≡ `/api/health`) | Health probe |
| A9 | Demo walkthrough smoke tests green | `tests/unit/demo-walkthrough.smoke.test.ts` |
| A10 | No live provider secrets required for the demo to boot | Mock-first ADR-0001 |
| A11 | Public `/audit` persistence records an idempotent canonical intake event before deriving an assessment | Accepted intake-ledger ADR + migration + DB integration tests |
| A12 | Durable public abuse control is enabled and verified at the host/edge | Host configuration evidence + 429 smoke; no in-memory limiter claim |

**Go-live verb:** promote a **preview/demo** deployment with Gate Set A checked. This is **not** live-provider production.

Gate A11 and A12 are currently **blocking operator requirements**. The schema has
no generic `Event` model, and `WebhookEvent` is reserved for signed vendor
callbacks. A durable rate limit also requires an approved host/edge control; an
in-memory process counter is not production protection. PR #107, its preview,
and green CI do not clear either gate.

---

## Gate Set B — Live pilot (v0.3 production slice)

Required before any live phone, SMS, CRM sync, or provider webhook mutation.

| # | Gate | Evidence |
|---|---|---|
| B1 | Written v0.3 live-integration authorization | Separate written auth referencing ADR-0046 / authorization brief |
| B2 | CAL interfaces + mock adapters merged | `lib/providers/{carrier,voiceAgent,sms,crm,scheduling}` |
| B3 | Provider enums include Telnyx + Calendly (and match ADR baseline) | Prisma migration + docs |
| B4 | Webhook signature validation per ADR-0009 for every live provider before mutation | Route tests |
| B5 | Live adapters behind factory with **mock fallback when env absent** | Factory + unit tests |
| B6 | Production key posture ADR (KMS/Vault or equivalent) accepted | New ADR |
| B7 | Observability minimum (error tracking) wired for the pilot env | Sentry or equivalent |
| B8 | First pilot tenant provisioned; tenant-isolation suite green against live path | Integration tests |
| B9 | Rollback + runbook exercised on staging | Ops runbook |
| B10 | Human go/no-go recorded | Issue/PR comment or ops log |

**Forbidden until B clears:** live Telnyx/Twilio/Vapi/Retell/HubSpot/Calendly/Stripe traffic; storing real provider credentials for production tenants; representing the product as live-telephony production.

---

## Relationship to older checklists

- [`RESPONSEOS_DEPLOYMENT_PLAN.md`](./RESPONSEOS_DEPLOYMENT_PLAN.md) — target topology; defers to **this** doc for gate definitions. Voice gateway + Redis remain **deferred** for the first live slice (ADR-0036).
- [`responseos-v0.3-provider-readiness.md`](../product/responseos-v0.3-provider-readiness.md) — planning baseline; Gate Set B consumes it.
- [`responseos-v0.3-authorization-brief.md`](../product/responseos-v0.3-authorization-brief.md) — mock-only CAL slice may proceed under ADR-0046 without clearing Gate Set B.
