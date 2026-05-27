# ResponseOS — Module Boundaries (`lib/*`)

**Owner:** AJ Digital LLC / Audio Jones  
**Status:** Canonical (planning) — no implementation authorized by this document  
**Last updated:** 2026-05-27 (UTC)  
**Read first:** [`../product/RESPONSEOS_EXEC_0B1_PROMPT.md`](../product/RESPONSEOS_EXEC_0B1_PROMPT.md) · [`../product/RESPONSEOS_EXEC_0A_PREFLIGHT.md`](../product/RESPONSEOS_EXEC_0A_PREFLIGHT.md) · [`../product/RESPONSEOS_IMPLEMENTATION_PLAN.md`](../product/RESPONSEOS_IMPLEMENTATION_PLAN.md)  
**Governing ADRs:** ADR-0001, ADR-0002, ADR-0011, ADR-0012, ADR-0013

## 1) Purpose & scope

This document is **EX0B-1 only** from the Implementation Plan (§5 Exec 0B, §12 EX0B-1): a documentation-only module-boundary map for the current `lib/*` tree. It defines ownership boundaries and obligations so EX0B-2/EX0B-3/EX0B-4 and Exec 1 can proceed without ambiguity.

This document does **not** authorize runtime code, schema changes, provider integrations, env contract expansion, or scaffolding. It names planned homes for later tasks without creating any files.

## 2) Exec 0A confirmation

The merged Exec 0A preflight (`RESPONSEOS_EXEC_0A_PREFLIGHT.md`) concluded **SAFE TO PROCEED** into Exec 0B and validated the critical path `A1 → A2 → B1 → B3/B4 → T1 → T2a → T3`.

Current repo inspection for EX0B-1 shows the expected preconditions still hold: `lib/providers/voice/` is absent, no explicit typed config loader contract artifact exists under `lib/config/`, and no canonical ledger-writer module exists yet under `lib/`.

## 3) Module-boundary map (current `lib/*`)

| Area | Responsibility (owns) | Does NOT own | Provider integration + mock fallback obligation | Tenant-scope obligation |
|---|---|---|---|---|
| `lib/auth/` | Session and role derivation for server-side authorization (`organizationId` from authenticated session). | Data persistence logic, provider adapters, and request validation schemas. | No direct provider adapter ownership. | Must remain source of truth for session-derived tenant scope; never trust client-supplied tenant identifiers. |
| `lib/automations/` | Reserved area for automation-domain code organization (currently placeholder-only). | Realtime voice gateway behavior, provider adapters, and data-layer tenancy enforcement. | No provider integration in current state. | Any future reads/writes here must flow through session-derived tenant scope. |
| `lib/config/` | Configuration boundary namespace for typed env/runtime config (currently placeholder-only). | Provider business logic, data access, and ledger writes. | Where provider-related env is resolved, it must preserve ADR-0001 mock fallback defaults when vars are missing. | Config must not introduce tenant scope from client input; tenant context remains session-derived upstream. |
| `lib/data/` | Tenant-scoped data-access layer over Prisma and domain repositories. | Auth/session derivation, provider transport logic, and UI concerns. | No direct live-provider ownership; may consume normalized provider results from adapters/routes only. | Every read/write is filtered by session-derived `organizationId`; no cross-tenant access from caller input. |
| `lib/db/` | Prisma client bootstrap and DB access primitive. | Domain-specific query policy, auth logic, and provider behavior. | No provider integration. | Tenant isolation is enforced by calling layers (`lib/data/*`) that must scope all access. |
| `lib/mock/` | Deterministic mock fixtures used by app behavior, seed parity, and tests. | Live vendor calls, schema migration logic, and auth/session resolution. | Mock source of truth for provider fallback behavior across adapters. | Fixture data must remain tenant-safe and compatible with scoped access patterns. |
| `lib/notifications/` | Reserved namespace for notification-domain modules (currently placeholder-only). | Realtime gateway control plane and core data-layer ownership. | Any eventual provider usage (email/SMS/etc.) must remain adapter-bound and mock-first by default. | Notification dispatch must be tenant-scoped and session-authorized via upstream layers. |
| `lib/providers/` | Provider adapter boundary + helper utilities (`webhook-helpers.ts`) for external services. | Business decision logic above adapters, tenant policy ownership, and core domain persistence strategy. | **All provider stubs must remain mock-first** and fall back safely when env vars are absent (ADR-0001). | Provider-originated data mutations must remain tenant-scoped through validated/session-linked context before persistence. |
| `lib/providers/bland/` | Bland adapter stub namespace. | Canonical voice policy logic and ledger ownership. | Must resolve to deterministic mock behavior with zero keys. | Any future writes must map to session-derived tenant scope via core layers. |
| `lib/providers/ghl/` | GoHighLevel adapter stub namespace. | CRM-neutral domain model ownership and orchestration policy. | Must resolve to deterministic mock behavior with zero keys. | Must not permit cross-tenant CRM mutation paths. |
| `lib/providers/hubspot/` | HubSpot adapter stub namespace. | Internal event-ledger canonical truth and core business logic. | Must resolve to deterministic mock behavior with zero keys. | Tenant connection/use must stay strictly scoped per session-derived org/account context. |
| `lib/providers/n8n/` | n8n adapter stub namespace (async integration boundary). | Realtime audio loop logic and session-state ownership. | Must resolve to deterministic mock behavior with zero keys. | Workflow invocation must remain tenant-scoped and idempotency-safe. |
| `lib/providers/resend/` | Resend/email adapter stub namespace. | Notification policy ownership and non-provider business rules. | Must resolve to deterministic mock behavior with zero keys. | Delivery actions must be authorized and tenant-scoped through upstream layers. |
| `lib/providers/retell/` | Retell adapter stub namespace. | Gateway policy engine logic and tenant-state persistence. | Must resolve to deterministic mock behavior with zero keys. | Any future session/call linkage must preserve strict tenant boundaries. |
| `lib/providers/stripe/` | Stripe/billing adapter stub namespace. | Pricing policy and revenue business rules above adapter. | Must resolve to deterministic mock behavior with zero keys. | Webhook/event handling must map to validated tenant context before mutation. |
| `lib/providers/twilio/` | Twilio telephony adapter stub namespace. | Cross-provider orchestration policy and core data ownership. | Must resolve to deterministic mock behavior with zero keys. | Call/message events must remain tenant-scoped via validated context before writes. |
| `lib/providers/vapi/` | Vapi adapter stub namespace. | Canonical provider abstraction contract ownership above adapter boundary. | Must resolve to deterministic mock behavior with zero keys. | Any future mapping to sessions/events must preserve tenant scoping. |
| `lib/providers/webhook-helpers.ts` | Shared webhook utility helpers for provider ingress boundaries. | Domain mutation logic and adapter-specific business behavior. | Supports provider boundary hygiene; does not bypass mock-first policy. | Must support signature/tenant-safe ingress patterns before downstream mutation. |
| `lib/revenue/` | Pure revenue/ROI calculation utilities. | Provider IO, session auth, and persistence/query responsibilities. | No provider integration. | Inputs consumed here must already be tenant-scoped by calling layers. |
| `lib/scoring/` | Pure lead qualification/scoring logic utilities. | Provider IO, auth/session resolution, and DB access. | No provider integration. | Inputs consumed here must already be tenant-scoped by calling layers. |
| `lib/validation/` | Zod/API/domain input validation schemas at system boundaries. | Auth session derivation, provider transport logic, and persistence ownership. | No provider integration. | Validation should enforce boundary correctness; tenant authority still derives from session, not client-supplied IDs. |
| `lib/serverOnlyGuard.ts` | Server-only import/runtime guardrail for server-constrained modules. | Feature business logic, persistence, or provider integration behavior. | No provider integration. | Indirectly protects tenant/security posture by preventing client misuse of server-only modules. |

## 4) Provider mock-fallback coverage

Current `lib/providers/*` stubs observed: `bland`, `ghl`, `hubspot`, `n8n`, `resend`, `retell`, `stripe`, `twilio`, `vapi` (+ `webhook-helpers.ts`).

| Provider area | Mock-first fallback required (ADR-0001) |
|---|---|
| `lib/providers/bland/` | Yes — deterministic mock behavior with zero keys. |
| `lib/providers/ghl/` | Yes — deterministic mock behavior with zero keys. |
| `lib/providers/hubspot/` | Yes — deterministic mock behavior with zero keys. |
| `lib/providers/n8n/` | Yes — deterministic mock behavior with zero keys. |
| `lib/providers/resend/` | Yes — deterministic mock behavior with zero keys. |
| `lib/providers/retell/` | Yes — deterministic mock behavior with zero keys. |
| `lib/providers/stripe/` | Yes — deterministic mock behavior with zero keys. |
| `lib/providers/twilio/` | Yes — deterministic mock behavior with zero keys. |
| `lib/providers/vapi/` | Yes — deterministic mock behavior with zero keys. |

## 5) Planned but absent today (reserved homes only)

Expected by plan and intentionally **not created** in EX0B-1:

- `lib/providers/voice/` — present: `VoiceProvider` interface + deterministic mock implementation (**EX0B-2**).
- Typed config loader under `lib/config/` — canonical env/config contract module (**EX0B-3**).
- Event-ledger writer canonical home: `lib/ledger/` (proposed path) for idempotent ledger write module (**EX1-T2a**).

These reservations preserve mock-first, tenant-aware architecture, event-ledger-first discipline, provider abstraction boundaries, and the modular monolith with a single sanctioned voice-gateway split.

## 6) Files this task touches + validation gates

EX0B-1 touches exactly these files:

1. `docs/architecture/RESPONSEOS_MODULE_BOUNDARIES.md` (new)
2. `docs/README.md` (index update)
3. `docs/CHANGELOG.md` (newest-first entry)

Validation gates for this docs-only task:

- Local: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- CI: `validate` must remain green; `integration` is unaffected by docs-only scope (no code/schema/dependency change).

## 7) Stop condition

EX0B-1 ends here. Do **not** begin EX0B-2, EX0B-3, EX0B-4, or Exec 1 from this task; await human review.
