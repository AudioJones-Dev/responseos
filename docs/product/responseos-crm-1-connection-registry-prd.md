# CRM-1 — Connection and Provider Registry PRD

**Status:** Proposed planning artifact. **This document authorizes nothing.**

**Added:** 2026-08-23

**Owner:** Audio / AJ Digital LLC

**Planning owner:** Codex

**Depends on:** ADR-0050 (accepted CRM interoperability doctrine), ADR-0001, ADR-0002, ADR-0009, ADR-0019, ADR-0020, ADR-0027, ADR-0033, ADR-0043, ADR-0047

**Current master inspected:** `3710a5b0a112104cd4dd8e10fb0e70cd6ffe5f82`

> **Gate statement.** Merging this PRD accepts a planning baseline only. It does not authorize a Prisma change, migration, CRM runtime change, provider-adapter change, API route, environment variable, credential operation, HubSpot configuration, workflow change, deployment, external request, or provider mutation. Every CRM-1 implementation slice requires a new exact-scope authorization after this PRD is accepted.

## 1. Problem

ADR-0050 defines a future provider-independent `CrmConnection` and Provider Registry, but the repository currently has two narrower and disconnected substrates:

1. `ProviderConnection` stores account-scoped provider metadata and encrypted credential material for several provider categories.
2. `lib/providers/crm` exposes a call-centric `CrmProvider` with exactly `"mock" | "hubspot"` provider IDs and a global environment-driven factory.

Implementing CRM-1 without an approved boundary would create material risks:

- a second credential or connection source of truth alongside `ProviderConnection`;
- a false claim that the existing global HubSpot seam is tenant-scoped, generalized, or production-ready;
- premature multi-connection behavior despite the current unique `(account_id, provider)` constraint;
- provider capability assumptions based on provider name or token presence;
- accidental expansion into CRM-2 entity mapping, CRM-3 inbound sync, or CRM-4 mutation governance;
- live-provider activation through what should be a mock-safe architecture slice.

CRM-1 therefore needs an implementation-ready contract and phased authorization plan before runtime work begins.

## 2. Desired outcome

Define the smallest future implementation path that:

- gives CRM orchestration a provider-independent, account-scoped connection contract;
- provides an explicit registry for source-proven CRM adapters;
- preserves `ProviderConnection` as the only current durable credential substrate;
- makes capability gaps explicit;
- keeps mock and zero-CRM operation deterministic;
- wraps the existing narrow CRM seam without changing its business behavior;
- creates no mapping, inbound-sync, agentic-mutation, or multi-CRM behavior;
- leaves live provider activation behind the existing v0.3, security, credential, and operator gates.

## 3. Success criteria

This planning phase is complete when:

1. Current implementation and future contracts are unmistakably separated.
2. The relationship between `ProviderConnection` and conceptual `CrmConnection` has one recommended design.
3. The Provider Registry's ownership and non-ownership boundaries are explicit.
4. Mock, zero-connection, unavailable-capability, and connection-error behavior are specified.
5. Tenant identity comes only from the authenticated server context.
6. No duplicate secret store, plaintext credential path, or portable secret reference is proposed.
7. CRM-2 through CRM-6 remain excluded and separately gated.
8. Candidate implementation slices, validations, stop conditions, and rollback are reviewable independently.
9. Platform doctrine §21 is answered.
10. The PRD itself changes documentation only and makes no external request or mutation.

## 4. Verified current repository state

The following claims were verified against the master SHA listed above. Planning documents do not override source.

### 4.1 Implemented today

| Surface | Source-proven state |
|---|---|
| Canonical substrate | `Account`, `Contact`, `Call`, `LeadEvent`, `LeadQualification`, `Appointment`, and `QuoteRequest` begin a provider-independent relationship and operational model. They are not a complete CRM. |
| CRM operation governance | `CrmSyncOperation` is a durable, call-centric operation record with unique `operation_key`, retry counters/timing, redacted errors, review status, and separately stored provider contact/activity/task IDs. |
| CRM provider IDs | `CrmProviderId` is exactly `"mock" | "hubspot"`. |
| CRM provider interface | `CrmProvider` supports contact lookup/create/upsert, event recording, call activity/task lookup/create, and contact association. It is narrow and call-centric. |
| Mock adapter | `MockCrmProvider` is deterministic and requires no connection or secret. |
| HubSpot seam | `HubSpotCrmProvider` contains bounded HTTP methods for HubSpot contacts, calls, tasks, and associations. It is selected only when both `RESPONSEOS_LIVE_HUBSPOT_ENABLED=true` and `HUBSPOT_ACCESS_TOKEN` are present; otherwise resolution returns mock. |
| Generic provider connection | `ProviderConnection` stores `account_id`, provider enum, opaque encrypted credentials, optional encrypted OAuth refresh token, status, scopes, connecting actor, verification time, and timestamps. |
| Provider connection cardinality | Prisma enforces one `ProviderConnection` per `(account_id, provider)`. Multiple HubSpot portals for one ResponseOS account are not supported. |
| Safe connection reads | `lib/data/providerConnections.ts` derives tenant scope from the session and deliberately excludes encrypted credential columns from public projections. |
| Credential encryption | ADR-0020 and `lib/providers/encryption` provide the v0.2 AES-256-GCM/mock-sentinel substrate. ADR-0020 explicitly states that its env-managed key posture is not acceptable for live tenant traffic without a follow-up production-key decision. |
| Shared provider resolver | `resolveProvider` is mock-first and environment-presence based. Most current provider factories omit live factories. CRM currently uses its own explicit HubSpot flag-plus-token resolver. |
| Tests | Current unit/integration tests cover mock resolution, explicit HubSpot selection conditions, CRM operation idempotency, ambiguity-to-review behavior, provider-connection reads, and tenant isolation. |

### 4.2 Gaps and non-implementation

The following do not exist today:

- a generalized `CrmConnection` domain contract or Prisma model;
- a CRM Provider Registry;
- tenant-scoped CRM provider resolution from `ProviderConnection`;
- a write/provisioning accessor for `ProviderConnection`;
- a provider account/portal identity field;
- a CRM sync-mode field;
- advertised-versus-verified capability negotiation;
- multiple connections for the same account/provider;
- generic connection health orchestration;
- a production-approved credential key posture;
- generalized entity/field mapping, mutation intents, conflict handling, inbound cursors, or generic CRM operations;
- Salesforce, GoHighLevel, Zoho, Twenty, Pipedrive, or ServiceTitan adapters;
- autonomous agent CRM writes.

### 4.3 Important mismatch to resolve

`mock` is a current `CrmProviderId`, but it is not a `ProviderConnectionProvider`. This is correct: mock is a no-connection runtime adapter, not an external account connection. The future registry must not require a fake durable credential row to use standalone/mock mode.

The current HubSpot factory is process-global and environment-driven. A token proves only that a value is configured; it does not establish the authenticated ResponseOS account, external portal identity, allowed capabilities, connection health, or authority to mutate. CRM-1 must not describe that factory as a generalized connection resolver.

## 5. Decision recommendation

### 5.1 Preserve one durable connection and credential authority

`ProviderConnection` SHALL remain the only current durable store for provider connection record identity, lifecycle metadata, encrypted credentials, and encrypted OAuth refresh tokens.

CRM-1 SHOULD NOT introduce a second secret-bearing `CrmConnection` table. Duplicate credential columns, duplicated connection status, or competing verification timestamps would create ambiguous authority and migration risk.

### 5.2 Introduce `CrmConnection` first as a domain projection

The first CRM-1 runtime slice SHOULD define `CrmConnection` as an internal TypeScript/domain contract composed from:

- safe, tenant-scoped `ProviderConnection` metadata;
- CRM-specific registry metadata;
- runtime capability evaluation;
- explicit connection availability and health evidence.

Conceptual shape only:

```text
CrmConnection
  id                         <- ProviderConnection.id
  accountId                  <- server-scoped ProviderConnection.account_id
  provider                   <- CRM registry provider ID
  state                      <- normalized from ProviderConnection.status
  providerAccountIdentity    <- unavailable until separately persisted/verified
  syncMode                   <- conservative default until separately persisted
  advertisedCapabilities     <- registry/adapter declaration
  verifiedCapabilities       <- connection-specific evidence, initially empty unless proven
  lastVerifiedAt             <- ProviderConnection.last_verified_at
```

The safe domain projection carries `connectionId` for audit attribution. Credential resolution remains an adapter-boundary operation keyed from that server-owned connection context; no secret value or separate credential locator is materialized in the safe projection. Provider credentials and secret-manager references must not appear in portable client packages, public API responses, logs, audit evidence, or agent tool arguments.

### 5.3 Do not add schema in the first CRM-1 implementation slice

The first runtime slice SHOULD use existing safe metadata and expose unknown/unverified values explicitly. It must not invent provider account identity or capabilities.

If a later CRM-1 slice proves that durable provider account identity, sync mode, or capability evidence is required, that slice needs:

- an exact schema proposal;
- a decision on extending `ProviderConnection` versus a one-to-one CRM metadata table;
- tenant and uniqueness analysis;
- migration and rollback plans;
- credential-boundary review;
- separate operator authorization.

The preferred decision rule is:

> Extend the generic substrate only for provider-agnostic metadata. Add a CRM-specific one-to-one metadata record only for genuinely CRM-specific state. Never duplicate credentials or make two records authoritative for connection lifecycle.

### 5.4 Keep current cardinality in CRM-1

CRM-1 SHOULD preserve the implemented one-connection-per-`(account_id, provider)` rule. Multiple connections, routing priorities, connection labels, fan-out, and field/domain authority across CRMs remain future multi-CRM work. Relaxing the unique constraint is not required to establish a registry and would pull routing policy into CRM-1 prematurely.

### 5.5 Use a static, code-owned Provider Registry

The first Provider Registry SHOULD be a compile-time registry, not a database-configurable plugin marketplace.

It contains only source-proven entries:

| Registry entry | Current adapter status | Connection requirement |
|---|---|---|
| `mock` | Implemented deterministic adapter | None; always available for standalone/mock operation |
| `hubspot` | Implemented bounded call-centric HTTP seam; not generalized or production-proven | Future tenant-scoped connection; current live selection remains separately gated |

Salesforce, GHL, Zoho, Twenty, Pipedrive, ServiceTitan, and other providers MUST NOT receive registry entries until their adapter work is separately selected and authorized. Documentation examples are not registry support.

The registry owns:

- canonical provider ID;
- adapter factory reference;
- declared adapter capabilities;
- whether an external connection is required;
- adapter contract/version identity;
- safe display metadata if needed internally;
- explicit unsupported-operation errors.

The registry does not own:

- credentials or secret resolution;
- tenant identity;
- provider account identity evidence;
- canonical business meaning;
- entity/field mappings;
- authority or approval policy;
- mutation permission;
- provider activation;
- dynamic third-party code loading.

### 5.6 Separate advertised and verified capabilities

CRM-1 SHOULD distinguish:

- **advertised capability:** the operation a compiled adapter claims it can translate;
- **verified capability:** connection-specific evidence that the external account, scopes, product tier, and current health allow it.

An operation is available only when required advertised and verified capability checks pass under the applicable policy. In the mock-only first slice, mock capabilities may be deterministic test fixtures. A live HubSpot connection must not be treated as verified merely because the adapter is registered or a token exists.

Initial capability vocabulary is inherited from ADR-0050:

```text
contacts.read
contacts.write
accounts.read
accounts.write
opportunities.read
opportunities.write
activities.append
tasks.write
appointments.read
appointments.write
webhooks.receive
incremental_sync
custom_fields.read
custom_fields.write
```

Only capabilities supported by the current narrow adapter contract may be advertised in the first implementation. Unsupported or unverified capabilities fail explicitly; they never silently no-op or downgrade.

### 5.7 Resolve connections from server-owned tenant context

A future CRM resolver accepts an authenticated server context or an already derived `accountId`. It must never trust an account ID supplied by a browser, webhook payload, agent tool argument, or provider payload.

Target resolution sequence:

```text
Authenticated server context
    -> tenant-scoped safe ProviderConnection lookup
    -> CRM provider registry lookup
    -> state and capability evaluation
    -> mock / unavailable / review outcome
    -> adapter construction only after separate secret authorization
```

No CRM-1 planning or registry merge authorizes decryption or adapter construction with live credentials.

### 5.8 Preserve standalone and mock behavior

Zero connected external CRMs is a valid operating mode. The absence of a `ProviderConnection` must not prevent ResponseOS from booting, preserving its event ledger, serving authorized CRM-independent workflows, or running deterministic tests.

The resolver must distinguish:

- `mock`: explicit deterministic adapter, no durable connection required;
- `not_connected`: no external CRM connection exists;
- `unavailable`: a connection exists but state/health/capability is insufficient;
- `review_required`: identity or configuration is ambiguous;
- `ready`: all required evidence is present for an independently authorized operation.

Only `mock` is guaranteed in the first mock-only slice. `ready` does not itself grant write authority.

## 6. Proposed target contracts

All contracts in this section are `TARGET / NOT YET IMPLEMENTED`.

### 6.1 Registry descriptor

```text
CrmProviderDescriptor
  providerId
  adapterContractVersion
  requiresConnection
  advertisedCapabilities
  createAdapter(context)
```

The creation context is server-owned and opaque to business workflows. Concrete SDKs or provider HTTP semantics remain inside the adapter boundary.

### 6.2 Connection view

```text
CrmConnectionView
  connectionId
  accountId
  providerId
  state
  syncMode
  providerAccountIdentity
  advertisedCapabilities
  verifiedCapabilities
  lastVerifiedAt
```

The public/safe view contains no ciphertext, token, authorization header, refresh token, encryption key, or credential locator.

### 6.3 Explicit failure

Conceptual connection/registry failures should use stable internal codes such as:

```text
crm_provider_not_registered
crm_connection_not_found
crm_connection_unavailable
crm_capability_unsupported
crm_capability_unverified
crm_connection_ambiguous
crm_live_activation_not_authorized
```

Errors must be redacted and attributable without leaking provider responses or credentials.

## 7. Scope

### 7.1 This PRD PR — documentation only

- Record current implementation truth.
- Recommend the `ProviderConnection`/`CrmConnection` relationship.
- Define the static registry boundary and capability posture.
- Define future implementation slices, acceptance criteria, risks, and gates.
- Align ADR-0050 status, roadmap, changelog, and progress dashboard.

### 7.2 Candidate CRM-1A implementation slice — future and separately gated

- Add provider-independent TypeScript connection and registry contracts.
- Add a static registry containing only `mock` and the existing source-proven `hubspot` seam.
- Preserve the existing narrow `CrmProvider` behavior while wrapping provider discovery behind the registry.
- Add deterministic unit tests for registry uniqueness, mock availability, unsupported provider/capability failure, and zero-connection behavior.
- Add no schema, migration, env, credential, API, external request, or live behavior.

### 7.3 Candidate CRM-1B connection projection slice — future and separately gated

- Add an internal, read-only CRM connection service over safe `ProviderConnection` metadata.
- Derive tenant scope only from authenticated server context.
- Normalize connection state without returning credential fields.
- Keep all live adapter construction disabled.
- Add tenant-isolation and unknown/unverified capability tests.

### 7.4 Candidate CRM-1C metadata persistence slice — optional, future, separately gated

Only if CRM-1A/1B prove a durable gap:

- decide the minimum provider-account identity, sync-mode, or capability-evidence persistence;
- approve a schema ADR and migration plan;
- keep credentials exclusively in `ProviderConnection`;
- preserve current cardinality unless a separate multi-connection decision is approved.

CRM-1C is not implied by acceptance of CRM-1A or CRM-1B.

## 8. Out of scope

- Prisma/schema/migration work in this PRD PR;
- live HubSpot or any external CRM call;
- credential creation, storage mutation, decryption, rotation, or configuration;
- production key management or amendment of ADR-0020;
- provider-account provisioning or OAuth;
- API/UI connection management;
- changing `CrmSyncOperation`;
- entity or field mapping;
- inbound CRM webhooks, cursors, or reconciliation;
- mutation intents, agent execution classes, or approval engines;
- autonomous agent writes;
- Salesforce, GHL, Zoho, Twenty, Pipedrive, ServiceTitan, or another adapter;
- multi-connection or multi-CRM routing;
- workflow, staging, Vercel, Neon, Clerk, Telnyx, Vapi, Twilio, or Production changes;
- product completion percentage changes or public interoperability claims.

## 9. Constraints and invariants

1. ResponseOS remains functional with zero CRM connections.
2. `ProviderConnection` remains the only current credential substrate.
3. Credentials and credential locators never enter public connection views, logs, audit evidence, portable packages, or agent arguments.
4. Tenant scope is server-derived for every connection read.
5. Provider-native account and entity IDs never become canonical ResponseOS IDs.
6. Registry membership does not imply configured, healthy, verified, authorized, or production-ready status.
7. Token presence does not establish tenant identity, capability, or write authority.
8. Capability gaps fail explicitly.
9. No business workflow imports a concrete CRM SDK.
10. Mock does not require a fake durable connection.
11. The current one-connection-per-account/provider constraint remains unchanged in CRM-1 unless separately decided.
12. External writes remain governed by the current bounded orchestration or future CRM-4 mutation-intent doctrine; the registry never grants mutation authority.
13. CRM-2+ entities and behavior are not pulled forward.
14. No merge in CRM-1 activates a provider by implication.

## 10. Acceptance criteria for future implementation authorization

Before any CRM-1 runtime PR is authorized, its task spec must state:

- exact slice (`CRM-1A`, `CRM-1B`, or a separately justified variant);
- exact files and contracts expected to change;
- whether Prisma is touched; default is no;
- current and target behavior for mock, missing connection, disconnected/error/expired connection, and unsupported capability;
- tenant-isolation method and negative tests;
- secret-read/decryption impact; default is none;
- network impact; default is no external calls;
- compatibility with the existing call-centric sync seam;
- rollback method;
- explicit exclusions for CRM-2+ and live activation;
- exact validation commands;
- stop conditions.

The implementation is acceptable only if:

- the app and test suite run with zero credentials;
- registry provider IDs are unique and statically reviewable;
- only source-proven providers are registered;
- unsupported capabilities return explicit failures;
- public/safe connection shapes exclude encrypted fields and secret references;
- cross-tenant connection resolution is denied;
- no existing live flag is broadened;
- no external request occurs in tests or default operation;
- no product claim changes from planned to shipped without source proof;
- the exact-head PR is green and separately approved.

## 11. Validation plan

### This documentation PR

```text
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration
```

Additionally:

- parse `dashboard/dashboard-data.json` as JSON;
- inspect the changed-file list and confirm it is documentation/dashboard only;
- inspect the diff for secret-like values and provider activation language;
- verify current master and exact PR head before review/merge.

### Future CRM-1 runtime slices

In addition to repository gates, add focused tests for registry uniqueness, provider/capability errors, zero-connection mock behavior, safe projection, and tenant isolation. No test may depend on a real provider credential or network call.

## 12. Rollback and stop conditions

This PRD is reversible through a documentation-only revert.

Future implementation must stop and return for re-scope if it requires:

- a live provider account, credential, external request, or HubSpot configuration;
- a schema/migration not named in the authorized slice;
- relaxing `(account_id, provider)` uniqueness;
- a second credential store;
- accepting tenant identity from client input;
- mapping, inbound sync, agentic mutation, multi-CRM routing, or another CRM-2+ concern;
- a concrete provider import above the adapter boundary;
- treating provider success as authoritative business truth;
- weakening mock fallback or staging/live-demo gates.

## 13. Risks and tradeoffs

| Risk or tradeoff | Response |
|---|---|
| A domain projection may feel less explicit than a new `CrmConnection` table. | It avoids duplicated credentials/state and lets actual persistence gaps be proven before migration. |
| Preserving one connection per account/provider limits future multi-portal clients. | That behavior does not exist today; routing and authority complexity belongs to a later explicit decision. |
| A static registry requires code changes to add providers. | That is desirable while adapters are security-sensitive and source-proven support is narrow. Dynamic plugins are unnecessary and riskier. |
| Advertised and verified capabilities add conceptual complexity. | Conflating them would let adapter code or token presence overstate an account's actual permissions. |
| The existing global HubSpot seam does not fit tenant-scoped resolution. | Preserve it as bounded current behavior; transition only in a separately authorized, credential-reviewed slice. |
| ADR-0020's key posture blocks live tenant credential use. | CRM-1A/1B can remain mock/read-only. Live activation requires a separate production-key decision and v0.3 authorization. |
| Registry work may be strategically interesting but not on the immediate demo critical path. | Keep slices small and do not start implementation until the operator prioritizes and authorizes one. |

## 14. Open decisions requiring operator approval

| ID | Decision | Recommendation | Blocks |
|---|---|---|---|
| CRM1-D1 | Is `CrmConnection` initially a domain projection over `ProviderConnection`, rather than a second secret-bearing table? | **Approve.** Preserve one credential and lifecycle authority. | Any CRM-1 implementation |
| CRM1-D2 | Does the first implementation slice include schema changes? | **No.** Authorize CRM-1A contracts/registry/tests first, if and when prioritized. | CRM-1A scope |
| CRM1-D3 | Is one connection per `(account_id, provider)` preserved? | **Yes for CRM-1.** Defer multi-connection routing. | Connection behavior |
| CRM1-D4 | Is the registry static and limited to `mock` and source-proven `hubspot`? | **Yes.** Do not register future adapters. | Registry contract |
| CRM1-D5 | Are advertised and verified capabilities separate? | **Yes.** Never infer verification from token presence. | Capability contract |
| CRM1-D6 | Should CRM-1A begin now? | **No implicit start.** Requires a new written authorization naming the exact slice. | Runtime work |

Acceptance of this PRD may approve D1–D5 as planning direction. It does not answer D6 or authorize implementation.

## 15. Platform doctrine §21 review

1. **Layer:** CRM-1 spans Communications Capture adapter boundaries, Operational Models connection metadata, and Trust Infrastructure; this PR changes documentation only.
2. **Build, integrate, or defer:** build the provider-independent connection/registry boundary; integrate external CRM APIs behind adapters; defer runtime until separately authorized.
3. **Live pilot path:** connection discipline can support a future pilot, but this PRD does not change or expand the live-demo path.
4. **Evidence:** the target separates declared capability from connection-specific verification and preserves attributable connection state.
5. **Verified outcomes:** a registered adapter or HTTP success is not verified business truth; later readback/reconciliation remains required by ADR-0050.
6. **Proprietary learning:** none is claimed or created by registry plumbing.
7. **Commodity purchase:** external CRM storage/API behavior is integrated; ResponseOS builds only its canonical boundary and governance.
8. **Duplication:** the recommendation avoids rebuilding a CRM and avoids duplicating the existing provider credential substrate.
9. **Vendor lock-in:** provider IDs and factories stay behind a static registry; business logic consumes canonical contracts.
10. **Tenant isolation:** connection lookup is account-scoped from authenticated server context; client-supplied tenant identity is prohibited.
11. **Attribution ambiguity:** explicit connection and capability states reduce ambiguity; unknown identity or capability fails closed.
12. **Claims:** every new contract is labeled target/not implemented; no provider-independence proof or production-readiness claim is created.
13. **Human approval:** this PRD creates a new exact-slice approval gate before runtime and retains all existing provider/write gates.
14. **Compliance exposure:** no secret or external data is touched; future safe views exclude credentials and live key posture remains unresolved.
15. **Required now or interesting:** the PRD is required before CRM-1 can safely proceed. CRM-1 implementation remains a prioritization decision and does not outrank current staging/live-demo gates.

## 16. Explicit authorization boundary

This PRD authorizes no runtime work.

In particular, it does not authorize:

- `CrmConnection` code or schema;
- Provider Registry code;
- Prisma or migration changes;
- HubSpot adapter edits or live writes;
- environment or credential changes;
- connection provisioning or verification;
- API routes, UI, workflows, or agent tools;
- staging, deployment, or Production changes;
- CRM-2, CRM-3, CRM-4, CRM-5, or CRM-6 work.

The next possible human gate after this PRD is accepted is an exact-head authorization for one named, mock-safe CRM-1 implementation slice. No implementation begins automatically.
