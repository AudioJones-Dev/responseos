# v0.3 Implementation Authorization Brief (decision checkpoint)

**Status:** Decision-support brief. **This document authorizes nothing.** It exists so the operator can make a controlled yes/no on a single **mock-first** v0.3 slice without opening the live-integration gate. Live provider work begins only with a separate, explicit, written authorization referencing this brief.
**Added:** 2026-06-02
**Governing canon:** ADR-0001 (mock-first), ADR-0019 (v0.3 gate), ADR-0031/0032/0033/0036/0037 (provider baseline), and [`responseos-v0.3-provider-readiness.md`](./responseos-v0.3-provider-readiness.md).

---

## 1. Exact first slice (proposed)

**CAL interface scaffolding + mock adapters (Phase 0 — no live providers).**

Define the Communications Abstraction Layer provider interfaces in TypeScript with **deterministic mock implementations only**, mirroring the existing `lib/providers/voice/` pattern (`index.ts` + `types.ts` + `mock.ts`):

- `CarrierProvider` (Telnyx primary / Twilio failover — interface only)
- `VoiceAgentProvider` (Vapi primary / Retell secondary — interface only)
- `SmsProvider`
- `CrmProvider` (HubSpot default)
- `SchedulingProvider` (Calendly MVP / Cal.com deferred)

Plus a **provider resolver** that returns the mock implementation whenever the corresponding env var is absent (it always is in this slice). No live API client is constructed, imported, or called.

> This is the smallest unit that advances v0.3 architecture (the CAL contract) while touching **zero** live surface. Everything else — schema enum additions (e.g. `telnyx`), webhook signature wiring, real adapters — is a **later, separately-authorized** slice.

## 2. Files / surfaces expected to change

- **New:** `lib/providers/{carrier,voiceAgent,sms,crm,scheduling}/{index.ts,types.ts,mock.ts}` (mirroring `lib/providers/voice/`).
- **New (optional):** a small `lib/providers/resolve.ts` helper (env-absent → mock).
- **New:** `tests/unit/providers-*.test.ts` — assert each interface resolves to its mock and returns deterministic data.
- **Maybe:** `docs/CHANGELOG.md` entry; an ADR note if the interface shape is a decision.
- **Not touched:** `prisma/schema.prisma`, `app/**` routes, `.env*`, `middleware`/auth, any data accessor.

## 3. What remains mock-only

- Every provider adapter returns deterministic fixture data (no network).
- Provider resolution falls back to mock when env vars are missing (they are).
- Existing app behavior (operator console, client portal, demo) is unchanged and still runs without secrets.

## 4. What remains forbidden in this slice

- No live API keys, secrets, or `.env` values; no real provider accounts.
- No real network calls to Telnyx / Vapi / Twilio / Retell / HubSpot / Calendly / OpenAI.
- No schema changes or migrations (the `CallProvider` / `CalendarProvider` enums stay as-is).
- No webhook → business-mutation wiring; no signature-validation activation.
- No telephony, SMS, or live calls; no CRM/scheduling sync.
- No deploys; no v0.4 knowledge / RAG / vector work; no relaxing any gate.

## 5. Validation gates (all must pass)

```
npm run lint && npm run typecheck && npm test && npm run build && npm run test:integration
```

Plus: the app still **boots and runs with no env/secrets**; mock-parity and tenant-isolation suites unaffected; **no new required env var** introduced.

## 6. Rollback / stop conditions

- **Stop and re-scope** if the slice needs: a real secret/account, a schema change, a webhook mutation path, or any live network call.
- **Stop** if any validation gate goes red and isn't a known transient (e.g. Docker-pull flake → re-run, don't merge red).
- **Rollback** is a single revert of the slice branch; nothing merges to `master` without explicit approval, and the change is additive (new files) so revert is clean.
- Scope creep beyond "interfaces + mocks + tests" → halt and return to this checkpoint.

## 7. Authorization statement

**No live secrets, accounts, or deploys are included in this slice.** Approving this slice authorizes **only** the mock-first CAL interface + mock-adapter scaffolding in §1–§2 under the gates in §5. It does **not** authorize any live provider integration, schema change, env/secret work, account setup, or deployment — each of those requires its own explicit, written authorization. ADR-0001 (mock-first) and ADR-0019 (v0.3 gate) remain in force.
