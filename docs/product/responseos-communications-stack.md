# ResponseOS — Communications Stack (CTO Architecture Recommendation)

> **Status:** Roadmap + PRD addendum (documentation-only). Encodes the CTO-level communications
> architecture decision from the ResponseOS Communications Stack Report.
> **Owner:** AJ Digital LLC.
> **Scope:** Strategy / architecture direction. **Nothing here is implemented** — no runtime code,
> dependencies, API integrations, migrations, env vars, or credentials. Live provider wiring is
> **v0.3-gated** (ADR-0001, ADR-0019).
>
> ⚠️ **This decision reverses parts of the just-ratified canon (ADR-0024, ADR-0027) and diverges
> from `RESPONSEOS_BUILD_SOURCE.md`.** Under ADR-0011 a prose doc does **not** supersede an ADR, so
> the conflicting items below are marked **"pending ratifying ADR."** See
> [§9 Relationship to existing ADRs & canon](#9-relationship-to-existing-adrs--canon).

**Milestone mapping:** the report's "MVP / Phase 1 / Phase 2 / Phase 3" maps onto the repo's version
table ([`../ROADMAP.md`](../ROADMAP.md)) as: **MVP / Phase 1 ≈ v0.3** (first live providers) → **Phase 2
(Scale) ≈ v0.3 → v0.5** → **Phase 3 (Enterprise) ≈ v0.6+ / HIPAA-ready lane**.

---

## 1. CTO Architecture Decision: Communications Stack

**ResponseOS will use Telnyx as the primary communications infrastructure provider, Vapi as the
primary AI voice orchestration layer, Twilio as a secondary/failover provider, Retell AI as a
secondary AI runtime roadmap option, and Sendblue as an optional premium iMessage channel for
US-based clients.**

ResponseOS is **not** being built as a Twilio-only, GoHighLevel-only, or single-vendor
communications platform. Carriers and AI runtimes are interchangeable inputs behind an internal
abstraction (§2); no single vendor is load-bearing for the product.

> Status vs canon: **Telnyx-primary** and **Vapi-primary** reverse ADR-0024 (Twilio default edge;
> Vapi/Retell *optional*) and diverge from `RESPONSEOS_BUILD_SOURCE.md` (Twilio edge, Grok Voice
> primary). Treat as the directed go-forward decision **pending a superseding ADR** (§9).

---

## 2. Product Requirement: Communications Abstraction Layer

**Requirement.** ResponseOS must wrap carrier, SMS, AI voice, and webhook providers behind an
internal abstraction layer so that Telnyx, Twilio, Vapi, Retell, Sendblue, or future providers can be
swapped or routed **without client-facing product changes**. The abstraction layer is the platform's
primary infrastructure moat — provider-specific logic must never leak above the adapter boundary.

Conceptual provider interfaces (document only — **do not implement yet**):

| Interface | Responsibility |
|---|---|
| `CarrierProvider` | Numbers, SIP, inbound/outbound voice routing (Telnyx primary, Twilio fallback) |
| `SmsProvider` | A2P SMS send/receive, delivery status |
| `VoiceAgentProvider` | AI receptionist orchestration (Vapi primary, Retell secondary) |
| `MessagingChannelProvider` | Premium channels — iMessage/RCS (Sendblue), future channels |
| `WebhookEventAdapter` | Normalize provider webhooks → the ResponseOS event ledger (ADR-0002) |
| `UsageMeteringAdapter` | Per-client usage capture (minutes, messages, AI runtime) for billing/limits |

This **extends** the existing provider-adapter doctrine (ADR-0001: every provider behind
`lib/providers/*`, mock-first) and the provider-abstraction chokepoint principle (ADR-0012/0024).

---

## 3. MVP Communications Stack

The first live-provider milestone (≈ v0.3) ships:

- Telnyx inbound/outbound voice
- Telnyx A2P SMS
- Vapi AI receptionist orchestration
- HubSpot CRM event sync (§5)
- Cal.com or GHL calendar tool-calling
- Webhook relay from telephony events into the ResponseOS event bus / ledger
- Per-client number assignment
- Per-client usage tracking
- Basic missed-call text-back
- Basic lead qualification transcript and summary

**Twilio is maintained as a secondary/failover provider but is *not* the default infrastructure
path for MVP.** (This is the reversal of ADR-0024's Twilio-default telephony edge — §9.)

---

## 4. Phase 1 Business Memory Baseline

Business Memory moves **earlier** — a lightweight version exists in MVP / Phase 1 (v0.3), not as a
late Phase 2/3-only feature.

**ResponseOS should capture every AI receptionist interaction as structured business memory,
including:**

- call transcript
- call summary
- lead / contact identity
- intent
- qualification status
- appointment request
- follow-up requirement
- source channel
- CRM sync status
- next recommended action

**Clarification.** The Phase 1 version does **not** need advanced vector search or full client memory
automation. It establishes the **data-capture foundation** so Business Memory can evolve into a
deeper ResponseOS differentiator.

> **Gate-preserving distinction (important).** Phase-1 Business Memory = **operational capture into
> the internal event ledger / structured records** (ADR-0002; builds on the already-shipped call-
> intelligence substrate, conversations/transcripts/qa-logs). It is **not** the v0.4-gated per-tenant
> *knowledge / RAG / vector-grounding* layer, which still requires the full v0.4 controls (tenant
> isolation, source ownership, audit, retention, PII minimization, deletion/export) per
> [`../ROADMAP.md`](../ROADMAP.md) and ADR-0016/ADR-0029. **No v0.4 gate is relaxed** — only the
> structured-capture foundation is pulled earlier. See §9.

---

## 5. HubSpot as Commercial System of Record

**HubSpot should be treated as the default commercial system of record for ResponseOS MVP unless a
client specifically requires GHL, Salesforce, or another CRM.**

ResponseOS should treat **calls, SMS events, AI summaries, lead qualification outcomes, appointment
requests, and follow-up status** as commercial activity that must sync into HubSpot.

**GHL remains a supported client integration path, but ResponseOS should not depend on GHL LC Phone
as core infrastructure.**

> Two distinct "systems of record" (consistent with ADR-0002): the **internal** SoR is the canonical
> ResponseOS event ledger (ROI/audit/replay recompute from it — unchanged). HubSpot is the **default
> external commercial/CRM SoR**, overridable per client. This **re-elevates** HubSpot from the
> "recommended, no mandated default" position ADR-0027 set — pending a re-amending ADR (§9).

---

## 6. Vendor Role Table

| Vendor | Role | Roadmap Status |
|---|---|---|
| **Telnyx** | Primary carrier for voice, SMS, SIP, numbers, A2P | MVP default |
| **Vapi** | Primary AI voice orchestration layer | MVP default |
| **Twilio** | Secondary carrier and compatibility fallback | MVP fallback |
| **Retell AI** | Secondary AI voice runtime / redundancy option | Phase 2 |
| **Sendblue** | Premium iMessage / RCS / SMS add-on for US clients | Phase 2 add-on |
| **HubSpot** | Default CRM / commercial system of record | MVP default |
| **GoHighLevel** | Optional client CRM / calendar integration | Supported integration, not infrastructure core |
| **Cal.com** | Scheduling API option | MVP or Phase 1 |

---

## 7. Communications Stack Non-Goals

- Do **not** build ResponseOS directly on GoHighLevel LC Phone.
- Do **not** make Twilio the only supported carrier.
- Do **not** expose Telnyx, Twilio, Vapi, or Retell directly as client-facing architecture.
- Do **not** build provider-specific logic throughout the application (it lives behind the abstraction layer, §2).
- Do **not** make Sendblue / iMessage required for MVP.
- Do **not** implement outbound AI campaigns until inbound AI receptionist, missed-call text-back, and CRM sync are stable.

---

## 8. Communications Roadmap Phasing

### Phase 1 — MVP (≈ v0.3)
- Telnyx primary voice and SMS
- Vapi primary AI receptionist
- HubSpot CRM sync
- Basic scheduling integration
- Missed-call text-back
- Per-client number assignment
- Per-client usage tracking
- Basic Business Memory capture (§4)
- Twilio account maintained for failover

### Phase 2 — Scale (≈ v0.3 → v0.5)
- Retell AI as secondary AI runtime
- Sendblue iMessage channel as premium add-on
- Advanced usage metering
- Multi-location support
- Deeper Business Memory retrieval *(per-tenant knowledge / retrieval remains v0.4-gated, §4/§9)*
- Revenue attribution dashboard
- Provider-routing configuration

### Phase 3 — Enterprise (≈ v0.6+ / HIPAA-ready lane)
- Volume carrier contract negotiation
- Dedicated SIP trunk strategy
- HIPAA / compliance-ready verticals
- Multi-carrier failover
- Enterprise reporting
- Advanced AI voice outbound campaigns

---

## 9. Relationship to existing ADRs & canon

> This doc records a **directed CTO decision** that conflicts with parts of the ratified ADR set.
> Under ADR-0011 the ADRs remain canonical until superseded, so each conflicting item below needs a
> **ratifying ADR** before it is canon. **This doc does not write those ADRs** — it surfaces what they
> must say (mirroring the GTM §24 → ADR-0021–0030 flow).

| # | This decision | Existing canon | Required action |
|---|---|---|---|
| 1 | **Telnyx primary carrier**, Twilio failover | ADR-0024 (Twilio default edge); ADR-0012 (Twilio edge); `RESPONSEOS_BUILD_SOURCE.md` (Twilio) | **Supersede ADR-0024** (telephony default) — new ADR |
| 2 | **Vapi primary AI voice orchestration** | ADR-0024 (Vapi/Retell *optional*; OpenAI default brain) | **Amend/supersede ADR-0024** — new ADR. *Open:* does the LLM brain under Vapi remain OpenAI? (§10) |
| 3 | **Telnyx + Vapi stack** generally | `RESPONSEOS_BUILD_SOURCE.md` go-forward stack: Twilio edge, **Grok Voice primary**, Node.js voice gateway, Redis (ADR-0012/0013/0014) | Update `BUILD_SOURCE` + supersede ADR-0012; clarify how the Node.js gateway/Redis (ADR-0013/0014) relate to a Vapi-orchestrated path |
| 4 | **HubSpot default commercial SoR** (client-overridable) | ADR-0027 (demoted HubSpot to "recommended, no mandated default"); ADR-0015 (original "HubSpot default") | **Re-amend ADR-0027** — new ADR. Internal ledger SoR (ADR-0002) unchanged |
| 5 | **Business Memory baseline in Phase 1/v0.3** | ADR-0029 + ROADMAP gate per-tenant knowledge to **v0.4** | **Extend ADR-0029** to allow Phase-1 *operational capture* (ledger), explicitly **not** relaxing the v0.4 *knowledge/RAG* gates |
| 6 | **No GHL LC Phone dependency**; GHL = optional connector | Consistent with ADR-0007 (GHL/QuoteIQ are connectors, not SoR) | No conflict — reaffirms existing doctrine |

**Overlaps (already aligned):** provider abstraction / mock-first (ADR-0001), event ledger as internal
SoR (ADR-0002), webhook signature validation before mutation (ADR-0009), live-wiring gated to v0.3
(ADR-0019), Telnyx already a "sanctioned alternative" telephony provider (ADR-0024).

---

## 10. Open decisions

1. **Ratify the superseding ADRs?** Items 1–5 above each need an ADR before they are canon. Recommended next step (operator's call), mirroring the GTM §24 → ADR ratification.
2. **LLM brain under Vapi.** Does ResponseOS keep OpenAI as the reasoning/transcription model *inside* the Vapi-orchestrated agent (compatible with ADR-0024's model layer), or does Vapi own model selection? Affects how much of ADR-0024 survives.
3. **Node.js voice gateway / Redis (ADR-0013/0014).** Are these retained behind a Vapi-orchestrated path, or does Vapi subsume the realtime gateway? Determines whether ADR-0013/0014 are superseded or kept.
4. **A2P 10DLC / number registration ownership** (Telnyx) — platform-owned vs per-client. (v0.3 readiness; not decided here.)
5. **Sendblue compliance / Apple ToS posture** for iMessage — verify before promising the Phase-2 add-on.
6. **Cal.com vs GHL calendar** as the default scheduling tool-call surface for MVP.

---

*Communications-stack architecture addendum — documentation only. No live providers, no secrets, no
deploy. Live wiring is v0.3-gated (ADR-0001, ADR-0019).*
