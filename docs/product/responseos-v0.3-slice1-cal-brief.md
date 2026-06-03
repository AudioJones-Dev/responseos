# v0.3 Slice 1 — Mock-First CAL Scaffolding: Implementation-Ready Brief

**Status:** Implementation-ready **plan / PR brief. Not implemented.** This document proposes the exact shape of the first mock-first Communications Abstraction Layer (CAL) slice so the operator can approve or hold. **It authorizes nothing** — building this slice requires a separate explicit written go (per [`responseos-v0.3-authorization-brief.md`](./responseos-v0.3-authorization-brief.md)).
**Added:** 2026-06-03
**Governing canon:** ADR-0001 (mock-first), ADR-0019 (v0.3 gate), ADR-0031/0032/0033/0036/0037 (provider baseline). Mirrors the existing `lib/providers/voice/` pattern.

---

## 1. Goal of this slice

Establish the **CAL provider interfaces + deterministic mock adapters** in code — the contract layer the v0.3 communications work will later implement against — **with zero live surface**. No network, no secrets, no schema, no routes. It is the smallest unit that advances v0.3 architecture while keeping the gate fully closed.

## 2. Exact files likely touched

**New (additive only):**
- `lib/providers/carrier/{types.ts, mock.ts, index.ts}` — `CarrierProvider` (Telnyx primary / Twilio failover)
- `lib/providers/voiceAgent/{types.ts, mock.ts, index.ts}` — `VoiceAgentProvider` (Vapi primary / Retell secondary)
- `lib/providers/sms/{types.ts, mock.ts, index.ts}` — `SmsProvider` (Telnyx / Twilio)
- `lib/providers/crm/{types.ts, mock.ts, index.ts}` — `CrmProvider` (HubSpot default)
- `lib/providers/scheduling/{types.ts, mock.ts, index.ts}` — `SchedulingProvider` (Calendly MVP / Cal.com deferred)
- `lib/providers/resolve.ts` — env-absent → mock resolver functions
- `tests/unit/providers-cal.test.ts` — resolver + mock determinism + capability tests

**Modified:**
- `docs/CHANGELOG.md` — one entry.

**Explicitly NOT touched:** `prisma/schema.prisma` (and no migration), `app/**` (no routes/UI), `.env*` (no new vars), `middleware`/`proxy.ts`/auth, `lib/data/**` (no accessor changes), `package.json` (no new dependency), the existing `lib/providers/voice/**` (reused, not modified).

## 3. Interfaces / contracts (proposed)

Mirror the `lib/providers/voice/types.ts` style: a thin capability `describe()` plus 1–2 operations per provider that return deterministic data. Starting shapes (to be refined in the PR, kept minimal):

```ts
// carrier/types.ts
export type CarrierName = "telnyx" | "twilio"
export interface CarrierCapabilities { voice: boolean; sms: boolean; sip: boolean; role: "primary" | "failover" }
export interface CarrierNumber { e164: string; accountId: string; capabilities: ("voice" | "sms")[] }
export interface CarrierProvider {
  readonly name: CarrierName
  describe(): CarrierCapabilities
  listNumbers(accountId: string): Promise<CarrierNumber[]>
}

// voiceAgent/types.ts — reuses SessionContext/ProviderSession from lib/providers/voice
export type VoiceAgentName = "vapi" | "retell"
export interface VoiceAgentCapabilities { orchestration: boolean; llmBrain: "openai" | "provider-owned"; role: "primary" | "secondary" }
export interface VoiceAgentProvider {
  readonly name: VoiceAgentName
  describe(): VoiceAgentCapabilities
  createSession(ctx: SessionContext): Promise<ProviderSession> // delegates to the existing VoiceProvider contract
}

// sms/types.ts
export type SmsProviderName = "telnyx" | "twilio"
export interface OutboundSms { accountId: string; to: string; from: string; body: string }
export interface SmsSendResult { providerMessageId: string; status: "queued"; mock: true }
export interface SmsProvider {
  readonly name: SmsProviderName
  describe(): { sms: boolean; role: "primary" | "failover" }
  sendMessage(msg: OutboundSms): Promise<SmsSendResult>
}

// crm/types.ts
export type CrmName = "hubspot" | "ghl"
export interface CrmContactInput { accountId: string; email?: string; phone?: string; name?: string }
export interface CrmSyncResult { externalId: string; status: "synced"; mock: true }
export interface CrmProvider {
  readonly name: CrmName
  describe(): { systemOfRecord: boolean; default: boolean }
  upsertContact(input: CrmContactInput): Promise<CrmSyncResult>
}

// scheduling/types.ts
export type SchedulingName = "calendly" | "calcom"
export interface BookingLinkInput { accountId: string; eventType: string }
export interface BookingLink { url: string; provider: SchedulingName; mock: true }
export interface SchedulingProvider {
  readonly name: SchedulingName
  describe(): { booking: boolean; googleCalendarCompatible: boolean; role: "mvp" | "deferred" }
  getBookingLink(input: BookingLinkInput): Promise<BookingLink>
}
```

> **Sub-decision for the PR:** `VoiceAgentProvider` should **compose** (not duplicate) the existing `lib/providers/voice/` `VoiceProvider` session contract — reuse `SessionContext`/`ProviderSession`. No rename of `voice/` in this slice.

## 4. Mock adapter boundaries

- Each `mock.ts` exports a `Mock<X>Provider implements <X>Provider` using `FIXED_*` fixtures, exactly like `MockVoiceProvider`. Deterministic outputs; every result carries `mock: true` where the shape allows.
- Mocks **never import a live SDK** and **never perform network/file/process I/O**.
- `resolve.ts` exposes `resolveCarrier()`, `resolveVoiceAgent()`, `resolveSms()`, `resolveCrm()`, `resolveScheduling()`. Each returns the mock **unless** its env var is present — and **no env var is introduced or read as configured in this slice**, so the resolver always returns the mock. The env-key *names* are referenced only as the future switch point (documented, not added to `.env.example`).

## 5. Tests required (`tests/unit/providers-cal.test.ts`)

- Each `resolve*()` returns the mock implementation when the env var is absent.
- Each mock returns its documented deterministic fixture (stable across calls).
- Each `describe()` reports the expected capabilities/roles (e.g. carrier Telnyx `role: "primary"`, Twilio `role: "failover"`; scheduling Calendly `role: "mvp"`, Cal.com `role: "deferred"`).
- Type-level: each mock satisfies its interface (compile-time, enforced by `tsc`).
- No network: structurally guaranteed (no client constructed); asserted by the absence of any live import.

## 6. Forbidden changes (gate stays closed)

- No `prisma/schema.prisma` change, no migration, no enum edits (`CallProvider`/`CalendarProvider` unchanged).
- No `.env*` changes; no real secrets; no provider accounts.
- No `app/**` routes, no webhook→business-mutation wiring, no signature-validation activation.
- No live network calls to any provider; no live SDK dependency added to `package.json`.
- No `lib/data/**` accessor changes; no auth/middleware changes; no deploy.
- No v0.4 knowledge / RAG / vector work.

## 7. Validation gates

```
npm run lint && npm run typecheck && npm test && npm run build && npm run test:integration
```
Plus: app still boots and runs with **no env/secrets**; **no new required env var**; mock-parity and tenant-isolation suites unaffected (this slice adds no tenant-scoped data paths).

## 8. Rollback / checkpoint criteria

- The slice is **purely additive new files** (+ one CHANGELOG line) → revert is a single clean `git revert`/branch drop; nothing else depends on it.
- **Stop and return to checkpoint** if the slice starts to require: a real secret/account, a schema change, a webhook mutation path, a live SDK dependency, or any network call.
- Red gate that is **not** a known transient (e.g. Docker-Hub pull flake → re-run) → do not merge.
- Scope creep beyond "interfaces + mocks + resolver + tests" → halt.
- Merged only as a **draft → ready → explicit approval** PR, same cadence as the docs PRs.

## 9. Proposed PR brief (for when authorized)

- **Title:** `feat: v0.3 slice 1 — mock-first CAL provider interfaces + mock adapters`
- **Scope:** §2 files only; mock-first; no live surface.
- **Body:** restate §3–§8; explicit "no live secrets/accounts/deploys/schema; v0.3 gate remains closed; ADR-0001/0019 preserved."
- **Draft until** CI green + review clean; **merge only on explicit approval.**

## 10. Authorization statement

This brief is **planning only and authorizes nothing**. No code, dependency, schema, route, or runtime behavior changes here. Building Slice 1 requires a **separate explicit written authorization**. No live secrets, accounts, or deploys are contemplated in Slice 1; ADR-0001 (mock-first) and ADR-0019 (v0.3 gate) remain in force.
