# ADR-0038 — Communications Abstraction Layer (CAL) provider architecture

**Status:** Proposed (2026-06-03) — **docs only; authorizes no code.** Must be **Accepted** before Slice 1 CAL implementation begins. Acceptance does **not** authorize code changes; implementation authorization is a separate, explicit, written gate (see [`../product/responseos-v0.3-authorization-brief.md`](../product/responseos-v0.3-authorization-brief.md), [`../product/responseos-v0.3-slice1-cal-brief.md`](../product/responseos-v0.3-slice1-cal-brief.md)).
**Governing canon:** ADR-0001 (mock-first), ADR-0019 (v0.3 gate), ADR-0020 (credential encryption), ADR-0031/0032/0033/0036/0037 (provider baseline). Indexed from [`../DECISIONS.md`](../DECISIONS.md).
**Scope note:** This is the first ADR to live as a standalone file under `docs/adr/`. `docs/DECISIONS.md` remains the canonical ADR index and carries a pointer entry for ADR-0038.

---

## 1. Decision summary

ResponseOS integrates third-party communications, CRM, and scheduling vendors whose APIs, SDKs, and lifecycles differ and change. The **Communications Abstraction Layer (CAL)** is the internal boundary that lets the application depend on **stable internal contracts** instead of vendor SDKs.

**Why CAL exists / what it solves:**
- **Vendor portability** — swap Telnyx↔Twilio or Vapi↔Retell as a config change, not a rewrite (ADR-0031/0032).
- **Testability without external services** — every domain has a deterministic mock, so CI runs offline (ADR-0001).
- **Reduced lock-in & blast radius** — vendor-specific code is confined to one adapter file per provider.
- **Predictable onboarding** — a new provider follows one standard contract instead of bespoke wiring.

**Why provider abstraction is required:** the product's defensible IP is the RECOVER orchestration, the event ledger, and ROI attribution — *not* the bought communications primitives. Binding application logic to a vendor SDK would couple that IP to a vendor's lifecycle and make the mock-first / gate-closed posture (ADR-0001/0019) impossible to hold.

## 2. Architectural principles

1. **Application code must never depend directly on vendor SDKs.** Only an adapter inside its domain folder may import a vendor SDK. App, data, and UI layers depend only on CAL interfaces.
2. **All providers must be replaceable.** Every provider in a domain implements the same interface; nothing above the adapter boundary may branch on a specific vendor.
3. **Mock providers must always exist.** Each domain ships a deterministic mock; the system is fully operable with mocks alone.
4. **Live integrations are optional.** The app boots and runs with zero live providers configured (ADR-0001). Live wiring is additive and v0.3-gated (ADR-0019).
5. **Environment absence resolves safely.** When a provider's credentials are absent, the resolver returns that provider's **mock** — never an error, never a half-configured live client.
6. **Tenant isolation remains provider-independent.** Tenancy (`account_id` from session) is an application-layer property; provider adapters never own, derive, or bypass it.
7. **Provider onboarding must follow a standard contract** (§8). No bespoke integration paths.

## 3. Canonical CAL domains

The approved CAL domains and their responsibility boundaries:

### Carrier domain
- **Examples:** Telnyx (primary), Twilio (failover).
- **Responsibilities:** phone numbers (provisioning/lookup), voice transport/routing, SMS transport/routing at the carrier level, SIP, media streams.
- **Non-responsibilities:** AI reasoning, agent orchestration, conversation logic.

### Voice domain
- **Examples:** OpenAI Realtime, Vapi, Retell, Bland.
- **Responsibilities:** speech, conversation turns, transcripts, audio sessions.
- **Non-responsibilities:** CRM ownership, scheduling ownership, carrier/number ownership.
- **Layering note (see §4):** the *Voice domain* covers the speech/transcript/session contract (the existing `lib/providers/voice/` `VoiceProvider`); the *Voice Agent layer* (Vapi primary, Retell secondary — ADR-0032) is the **orchestration** that **composes** a voice provider plus an LLM brain (OpenAI preferred in-Vapi, ADR-0036). The voice-agent orchestrator is not a second copy of the voice provider.

### CRM domain
- **Examples:** HubSpot (default, ADR-0033), GoHighLevel, Salesforce.
- **Responsibilities:** contacts, opportunities/deals, activities.
- **Non-responsibilities:** internal system-of-record (that is the ResponseOS event ledger, ADR-0002); ROI/attribution recompute.

### Scheduling domain
- **Examples:** Calendly (MVP baseline, ADR-0037), Google Calendar, Microsoft 365, Cal.com (deferred).
- **Responsibilities:** availability, bookings, calendar events; Google Calendar compatibility is required (ADR-0037).

### SMS domain
- **Responsibilities:** outbound messaging, inbound messaging, delivery/status tracking, conversation threading at the application level.
- **Boundary with Carrier:** the Carrier domain owns SMS *transport*; the SMS domain owns messaging *semantics* and may delegate transport to the configured carrier. (See §11 open question.)

## 4. Canonical architecture

Preferred composition hierarchy (top = closest to the network edge):

```
Carrier Provider        (Telnyx primary / Twilio failover — numbers, transport)
        ↓
Voice Provider          (speech / transcript / audio session contract)
        ↓
Voice Agent Layer       (Vapi primary / Retell secondary — orchestration, composes a Voice Provider + LLM brain)
        ↓
ResponseOS Application Layer   (RECOVER orchestration, event ledger, tenancy, ROI)
```

**Explicit rules:**
- **`VoiceAgentProvider` MUST NOT duplicate `VoiceProvider` responsibilities.** Voice-agent orchestration **composes** the voice-provider session contract; it does not re-declare session/transcript/turn primitives.
- **Avoid parallel abstractions.** One contract per responsibility. The existing `lib/providers/voice/` `VoiceProvider` is the voice-domain contract; the voice-agent layer reuses it (e.g. `createSession()` delegates to a `VoiceProvider`).
- Application code talks to the **Application Layer** and the CAL interfaces only — never to a vendor SDK, and never to a layer below the one it needs.

## 5. Resolver architecture

A per-domain resolver maps configuration → a provider instance. Three cases, **explicitly distinguished**:

| Case | Condition | Resolution |
|---|---|---|
| **Mock resolution** | No credentials/config present for the domain | → resolve the **mock** provider (safe default, ADR-0001/Principle 5) |
| **Live resolution** | Valid credentials present for a **known** provider | → resolve the **configured live** provider |
| **Failure mode** | Provider name is **unknown/unregistered**, or config is present but invalid/inconsistent | → **fail closed** (throw/refuse to boot that domain). **No silent fallback to mock.** |

**Rationale for the distinction:** absence of credentials is a *valid, expected* state → mock (the system must run without secrets). But an operator who *names a live provider* and mis-spells it or supplies a half-config must **not** be silently downgraded to a mock that fakes success — that would hide a misconfiguration behind green output. Mock-as-fallback applies to **absence**, never to **error**. This refines ADR-0001 (mock fallback on missing env) by adding the fail-closed rule for *misconfiguration*.

## 6. Tenant isolation assumptions

- **Providers never own tenancy.** `account_id` is derived from the session in the application/data layer (per `SECURITY.md`), never from a provider payload or client input.
- **Account ownership remains an application-layer responsibility.** Adapters receive an `accountId` as an input parameter from a trusted caller; they do not resolve or infer it.
- **Provider adapters are stateless.** No per-tenant caching, sessions, or credentials held in the adapter beyond a call; tenant-scoped credentials live in `ProviderConnection.credentials_encrypted` (AES-256-GCM, ADR-0020) and are decrypted only at the adapter boundary.
- **Provider adapters never bypass authorization.** They are invoked by application/data code that has already enforced tenant scope; an adapter is not an authorization boundary and must not be used to reach cross-tenant data.

## 7. Mock-first rules

- **Every provider requires a mock implementation** in its domain (`*/mock.ts`).
- **Fixtures required** — deterministic `FIXED_*` constants (mirroring `MockVoiceProvider`).
- **Deterministic outputs required** — identical inputs yield identical outputs across runs.
- **Tests must run without external services** — no network, file, or process I/O in mocks or their tests; CI is fully offline-capable.

## 8. Future provider onboarding standard

Adding any provider to any domain MUST include:

**Required**
- [ ] A contract interface (or conformance to the existing domain interface)
- [ ] A mock provider implementation
- [ ] Deterministic fixtures
- [ ] Tests (mock determinism, resolver behavior, interface conformance)
- [ ] Resolver registration (known-provider entry)
- [ ] Documentation (domain doc / CHANGELOG; ADR if it is a decision)

**Forbidden**
- Direct SDK usage **outside** the provider's adapter
- Vendor-specific logic in the application/data layer
- Provider-specific branching in the UI

## 9. Decision consequences

**Benefits**
- Vendor portability (config-level swaps)
- Testability (offline, deterministic CI)
- Reduced lock-in and blast radius
- Predictable, standardized integrations
- Lower implementation risk (mock-first, gate-closed)

**Tradeoffs**
- More abstraction layers to navigate
- Additional interfaces to define and maintain
- Onboarding overhead per provider (the §8 checklist)

These tradeoffs are accepted: the cost is bounded per-provider boilerplate, while the benefit is structural protection of the product's IP and the mock-first/gate-closed posture.

## 10. Approval gate

> **This ADR must be Accepted before Slice 1 CAL implementation begins.**
> **Implementation authorization remains separate.** Acceptance of this ADR does **not** authorize code changes, dependencies, schema changes, routes, env vars, or runtime modifications. Building Slice 1 requires a separate, explicit, written authorization (per the Slice 1 brief). ADR-0001 (mock-first) and ADR-0019 (v0.3 gate) remain in force.

## 11. Open questions (to resolve at or after acceptance — none block Slice 1's mock scope)

1. **Voice vs Voice-Agent taxonomy.** Is Vapi modeled as a *voice-agent orchestrator* (composing a separate voice provider) or as a self-contained voice provider? This ADR recommends the orchestrator-composes-voice-provider model (§4); confirm before the voice-agent adapter is built.
2. **Carrier/SMS boundary.** Does the SMS domain delegate transport to the Carrier provider, or does each carrier expose its own SMS adapter? §3 proposes SMS-semantics-over-carrier-transport; confirm the delegation shape.
3. **ADR file convention.** ADR-0038 introduces `docs/adr/` as standalone files while `DECISIONS.md` holds inline ADRs. Decide whether large architecture ADRs live as files (with a `DECISIONS.md` pointer, as done here) and whether to backfill/migrate.
4. **Resolver registry shape.** Simple per-domain `resolve*()` functions vs a central provider registry — recommend functions for Slice 1; revisit if provider count grows.
5. **Scheduling sub-taxonomy.** Calendly (booking-link layer) vs Google/M365 (calendar sync) may warrant a sub-distinction within the Scheduling domain.
