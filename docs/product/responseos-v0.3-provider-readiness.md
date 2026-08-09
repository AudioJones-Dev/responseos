# v0.3 Provider Stack Readiness Spec

**Status:** Planning artifact. **Documentation only.** No provider adapters, schema changes, env vars, secrets, provider-account configuration, deployment, or v0.3 wiring are authorized by this document.
**Added:** 2026-06-02
**Inputs:** [`../research/communications-stack/`](../research/communications-stack/) (research snapshot, #71), [`DECISIONS.md`](../DECISIONS.md) ADR-0031–ADR-0034, [`./responseos-communications-stack.md`](./responseos-communications-stack.md), [`./RESPONSEOS_BUILD_SOURCE.md`](./RESPONSEOS_BUILD_SOURCE.md), [`../ROADMAP.md`](../ROADMAP.md), [`../SECURITY.md`](../SECURITY.md), `prisma/schema.prisma`, `lib/providers/*`.

> This spec describes *where the build is* and *what must be decided/done* before v0.3 provider work could begin. It is the next reviewable planning artifact after the research report landed. It does **not** authorize implementation. The provider stack below is a **planning baseline**, not an implementation green-light, and is **not final** until the open decisions in §4 are reconciled and scope is approved in writing.

---

## 1. Planning baseline (ADR-ratified direction — not yet implementation-authorized)

Per ADR-0031–ADR-0033, all behind the **Communications Abstraction Layer (CAL)** (ADR-0001; comms doc §2):

| Layer | Baseline | Secondary / failover | Source |
|---|---|---|---|
| Carrier (voice + A2P SMS, SIP, numbers) | **Telnyx (primary)** | **Twilio (failover)** | ADR-0031 |
| AI voice orchestration | **Vapi (primary)** | **Retell AI (secondary)** | ADR-0032 |
| LLM brain / model layer | **OPEN** (see §4) | — | ADR-0032 §3 |
| External commercial CRM system of record | **HubSpot (default, client-overridable)** | GHL / Salesforce / other (per client) | ADR-0033 |
| Internal system of record | **ResponseOS event ledger** (unchanged) | — | ADR-0002 |
| Business Memory (Phase-1) | Operational capture into the ledger | — | ADR-0034 |

Mock-first (ADR-0001) holds; live wiring is v0.3-gated (ADR-0001, ADR-0019).

## 2. Repo-backed baseline (what the code, schema, and env actually contain today)

| Capability | Schema enum (`prisma/schema.prisma`) | Adapter (`lib/providers/`) | Env (`.env.example`) |
|---|---|---|---|
| Carrier / voice transport | `CallProvider`: twilio, retell, vapi, bland, manual | `twilio/` (`.gitkeep` stub) | `TWILIO_*` |
| AI orchestration | (via `CallProvider` / `ProviderConnectionProvider`) | `vapi/`, `retell/`, `bland/` (stubs) | `VAPI_API_KEY`, `RETELL_API_KEY`, `BLAND_API_KEY` |
| SMS / A2P | `SmsProvider`: twilio, manual | (under `twilio/`) | `TWILIO_*` |
| CRM SoR | `ProviderConnectionProvider`: **hubspot** (GHL is *not* in this enum — it's a `CalendarProvider` value + connector stub) | `hubspot/`, `ghl/` (stubs) | `HUBSPOT_ACCESS_TOKEN`, `GHL_API_KEY` |
| Scheduling | `CalendarProvider`: google, calcom, ghl, manual | (none) | (none) |
| Billing | `ProviderConnectionProvider`: stripe | `stripe/` (stub) | `STRIPE_*` |
| Email | — | `resend/` (stub) | `RESEND_API_KEY` |
| Workflow | `WorkflowProvider`: n8n, make, internal | `n8n/` (stub) | `N8N_*` |
| LLM brain | `ProviderConnectionProvider`: grok, openai | (none) | (none) |

**Implemented today:** `lib/providers/voice/` (`index.ts` + `mock.ts` + `types.ts` — the single real, mock-only CAL slice), `lib/providers/encryption/` (AES-256-GCM at the adapter boundary, ADR-0020), and `lib/providers/webhook-helpers.ts` (shared webhook response / signature + mock-ack helpers). `ProviderConnection` stores `credentials_encrypted` (Bytes) under a unique `(account_id, provider)` with tenant scoping. **Every provider-specific adapter is an empty `.gitkeep` stub.** This is correct for mock-first/v0.2 — it means v0.3 starts from near-zero adapter code.

## 3. Research-vs-ADR reconciliation

The research README ([#71](../research/communications-stack/README.md)) is **correctly labeled a snapshot** and explicitly defers to `DECISIONS.md` as canon, so it does **not** itself conflict. `RESPONSEOS_BUILD_SOURCE.md` is **already reconciled** to the ADR-0031/0032 canon (PR #49) — pre-ADR lines are marked superseded and the OpenAI-in-Vapi + gateway/Redis items are flagged open. Summary:

| Capability | ADR canon | Research README (snapshot) | `RESPONSEOS_BUILD_SOURCE.md` (reconciled, #49) |
|---|---|---|---|
| Carrier | Telnyx primary, Twilio failover (ADR-0031) | Telnyx primary, Twilio fallback | Telnyx primary, Twilio fallback ✓ |
| AI orchestration | Vapi primary, Retell secondary (ADR-0032) | "Vapi *or* Retell, deferred" | Vapi primary, Retell secondary ✓ |
| LLM brain | OPEN (ADR-0032 §3) | n/a | OpenAI likely-in-Vapi, marked *open* ✓ |
| CRM SoR | HubSpot default, client-overridable (ADR-0033) | n/a | HubSpot default ✓ |
| iMessage | none | **Sendblue (optional)** | none — new research candidate, no ADR |
| Abstraction | CAL (ADR-0001) | CAL internal | CAL ✓ |

> **The stale provider-stack summary lives in `docs/README.md`** (≈line 7: "Twilio edge · Node.js voice gateway · Grok Voice primary / OpenAI Realtime fallback · … HubSpot CRM SoR · Redis …"), and `SECURITY.md` ("Standard mode runs on Twilio + Retell …", with a webhook-signature table that omits Telnyx/Vapi). Those — **not** `BUILD_SOURCE.md` — are what still needs reconciling to ADR-0031/0032.

## 4. Unresolved decisions (resolve before any configuration)

1. **LLM brain (ADR-0032 §3):** OpenAI inside the Vapi-orchestrated agent **vs** Vapi owning model selection.
2. **Voice gateway / Redis relationship (ADR-0013/0014):** retained behind a Vapi path **vs** subsumed by Vapi.
3. **Telnyx enum/schema representation:** Telnyx is **absent from code/schema/env surfaces** (not in `CallProvider`/`SmsProvider`/`ProviderConnectionProvider`, no `telnyx/` adapter, no `TELNYX_*` env) even though it is **present in docs/ADRs as the primary carrier** (ADR-0031). Decide how the carrier abstraction (`CarrierProvider`) and enum coverage are added.
4. **A2P 10DLC / number-registration ownership** (platform vs per-client) — ADR-0031 open readiness item.
5. **Scheduling provider for v0.3** — `CalendarProvider` enums exist (google, calcom, ghl) but there is no adapter, no env, and no ADR selecting one.
6. **Sendblue / iMessage scope** — research candidate only; in or out of v0.3.
7. **`grok` / xAI reconciliation** — Grok remains in the schema enum / docs as **legacy or open-provider residue** and needs reconciliation against ADR-0031/0032 (it is not the current orchestration/carrier canon, but carries older ADR history rather than being unbacked). The current xAI docs review is captured in [`responseos-xai-voice-readiness-spike.md`](./responseos-xai-voice-readiness-spike.md) and keeps xAI experimental unless a later approved spike or ADR changes that placement.
8. **Stale docs cleanup** — `docs/README.md` (still summarizes "Twilio edge · Grok Voice primary / OpenAI Realtime fallback …") and `SECURITY.md` ("Standard mode runs on Twilio + Retell + Supabase + Vercel" + the webhook table missing Telnyx/Vapi rows) predate ADR-0031/0032 and need updating. (`RESPONSEOS_BUILD_SOURCE.md` is already reconciled — PR #49.)
9. **Per-tenant BAA / retention** sign-off for any regulated (HIPAA-lane) tenant before live traffic (SECURITY.md vendor matrix).

## 5. Current schema / provider-adapter gaps

1. **Telnyx not represented in code/schema/env** (present only in docs/ADRs) — the primary carrier has no enum value, adapter, or env placeholder yet.
2. **All provider-specific adapters are `.gitkeep` stubs** except `voice/` (mock), `encryption/`, and `webhook-helpers.ts`. No `CarrierProvider` / `VoiceAgentProvider` / `CrmProvider` interfaces exist in code — only the `voice/` types.
3. **Webhook-signature coverage incomplete** — `SECURITY.md` lists Twilio, Retell, Stripe, HighLevel, n8n, Clerk but **not Telnyx or Vapi**. ADR-0009 requires signature validation *before any business mutation*; that path is unimplemented (v0.3 wires).
4. **Schema enum drift** — `grok`/`openai` present (LLM-brain open), `telnyx`/`sendblue` absent; no dedicated `CarrierProvider` enum despite ADR-0031 referencing one.
5. **No LLM-brain env placeholders** (`OPENAI_*` / `GROK_*`).

## 6. Minimal safe implementation sequence (only after explicit written approval; mock-first per ADR-0001)

1. **Docs reconciliation (docs-only):** update `docs/README.md` (stack summary) and `SECURITY.md` (webhook table + standard-mode line) — `RESPONSEOS_BUILD_SOURCE.md` is already reconciled (#49); record the resolved §4 decisions (LLM brain, gateway/Redis) as a new ADR.
2. **CAL interfaces in code (mock-only):** define `CarrierProvider`, `VoiceAgentProvider`, `SmsProvider`, `CrmProvider` mirroring the existing `voice/` pattern; env-absent → mock fallback.
3. **Schema alignment (migration, gated):** add `telnyx` to carrier/SMS/connection enums; resolve `grok`/`sendblue`. No new knowledge/RAG/vector tables under this provider-readiness slice; any new v0.3 schema must be separately scoped and approved.
4. **Mock adapters** for Telnyx/Vapi/HubSpot behind the CAL returning deterministic data; persist into the existing ledger / `conversations` / `call_transcripts` substrate (Phase-1 Business Memory capture, ADR-0034).
5. **Webhook ingress with signature validation first** (ADR-0009): validate → reject-on-bad → *then* mutate; mock mode validates and no-ops.
6. **Env placeholders only** (`TELNYX_*`, `OPENAI_*`/`GROK_*`, etc.) — **no real secrets**.
7. **Live cutover, one provider at a time, flag-gated, non-prod first** — only after BAA / registration / observability / rollback are in place and explicitly authorized.

## 7. Provider-readiness checklist (per provider, before live)

- [ ] Account ownership + plan tier confirmed (platform vs per-client)
- [ ] Credentials issued; stored via `ProviderConnection.credentials_encrypted` (AES-256-GCM, ADR-0020) — never in repo
- [ ] Env var names added as placeholders; secrets injected at deploy only
- [ ] Webhook signature secret + validation implemented (ADR-0009) and added to the `SECURITY.md` table
- [ ] Schema enum coverage for the provider
- [ ] CAL interface + mock adapter merged before any live adapter
- [ ] A2P 10DLC / number registration (Telnyx/Twilio); number provisioning
- [ ] Failover routing configured + tested (Telnyx↔Twilio, Vapi↔Retell)
- [ ] BAA / retention posture per tenant tier (HIPAA lane) signed off
- [ ] Observability, kill-switch / rollback, non-prod validation
- [ ] Per-tenant isolation verified on all new write paths (extend the #69/#70 tenant matrix)

## 8. Authorization status

**No live provider integration, secrets work, environment/account configuration, deployment, or v0.3 code is authorized.** The ADR baseline in §1 is a *planning* baseline only. The provider stack is **not final** until the §4 decisions are reconciled and scope is approved in writing.
