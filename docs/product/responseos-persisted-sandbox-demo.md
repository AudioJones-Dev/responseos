# ResponseOS Persisted Sandbox Demo

**Status:** `PARTIALLY_SHIPPED` — implemented locally for review; no deployment or live-provider activation
**Owner:** AJ Digital LLC
**Tenant:** `org_responseos_demo` (`sandbox`)

## Problem

The prospect walkthrough was a static storyboard. It could explain the intended lifecycle but could not prove that ResponseOS can persist and tenant-scope the supporting records.

## Desired outcome

Provide a resettable, database-backed, fictional scenario that demonstrates call, transcript, qualification, workflow, appointment, audit evidence, and an illustrative outcome without implying live provider activity or verified revenue.

## Success criteria

- The public walkthrough reads only the fixed sandbox tenant and call.
- Every record uses fictional `.example` data and reserved `+1555` numbers.
- The UI discloses persisted simulation, disabled provider effects, and unverified revenue.
- Missing database configuration produces a prominent static-fallback disclosure.
- Reset is deterministic, transaction-scoped, production-disabled, and unable to target another tenant.
- Tenant-scoped callers cannot use the internal lifecycle reader to cross account boundaries.

## Scope

- Dedicated `sandbox` account and deterministic lifecycle fixtures.
- Server-only lifecycle read returning the canonical `Result<T>` envelope.
- Existing walkthrough routes rendered from a cached server-side view model.
- Operator-only `npm run demo:reset` command guarded by `RESPONSEOS_DEMO_RESET=true`.
- Unit and Postgres integration coverage.

## Out of scope

- Telnyx, Vapi, HubSpot, calendar, SMS, or other provider mutations.
- Runtime AI extraction, autonomous decisions, live calls, real contacts, or verified revenue.
- Production deployment, paid-pilot readiness, billing, or CRM source-of-truth changes.

## Public interfaces

- `getDemoCallLifecycle({ accountId, callId })` — session-scoped internal read.
- `getPublicDemoCallLifecycle()` — no client parameters; reads only the compile-time sandbox identifiers.
- `resetResponseOsDemoSandbox(prisma)` — fixed-scope transactional reset used by the guarded CLI.

## Architecture review — doctrine §21

1. Layer: demo presentation plus existing operational evidence/data layer.
2. Delivery: built locally with existing Postgres/Prisma substrate; all providers deferred.
3. Pilot path: improves sales proof without advancing the live-provider gate.
4. Evidence: persists transcript, workflow, audit, and outcome classification.
5. Verified outcomes: preserves the distinction by fixing `verified: false` and verified revenue at zero.
6. Proprietary learning: none claimed; the fixture is deterministic demonstration data.
7. Buy/build: uses existing internal data access; no commodity vendor capability is rebuilt.
8. Duplication: no CRM, FSM, telecom, or workflow-provider behavior is implemented.
9. Lock-in: no new vendor or dependency.
10. Isolation: fixed public scope plus session-scoped internal access and cross-tenant tests.
11. Attribution: the source is labeled `persisted simulated call fixture`.
12. Claims: every surface says simulated, no live providers, and no verified revenue.
13. Human approval: deployment and any external mutation remain separate gates.
14. Compliance: fictional data only; no recording URL or raw artifact reference.
15. Necessity: required now as controlled GTM proof; live-provider work remains later.

## Operator reset

Set a non-production database URL and run:

```powershell
$env:RESPONSEOS_DEMO_RESET = "true"
npm run demo:reset
```

The command has no tenant argument and refuses `NODE_ENV=production` or `VERCEL_ENV=production`.
