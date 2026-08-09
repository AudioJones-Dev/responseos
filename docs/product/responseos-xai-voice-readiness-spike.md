# ResponseOS xAI Voice Readiness Spike

**Status:** Planning artifact. **Documentation only.** No provider adapter, schema change, env var, secret, provider-account configuration, deployment, or live xAI wiring is authorized by this document.
**Date:** 2026-07-13
**Source reviewed:** xAI docs overview, Voice API, Voice Agent API, SIP phone calls, pricing, rate limits, cost tracking, and API security docs as of 2026-07-13.
**Related:** [`responseos-v0.3-provider-readiness.md`](./responseos-v0.3-provider-readiness.md), [`responseos-v0.3-live-call-demo-implementation-brief.md`](./responseos-v0.3-live-call-demo-implementation-brief.md), [`../DECISIONS.md#adr-0036--v03-provider-stack-open-decisions-resolved-as-a-planning-baseline-resolves-the-4-open-items-of-the-provider-readiness-spec-closes-the-adr-0032-open-decisions-no-implementation-authorized`](../DECISIONS.md#adr-0036--v03-provider-stack-open-decisions-resolved-as-a-planning-baseline-resolves-the-4-open-items-of-the-provider-readiness-spec-closes-the-adr-0032-open-decisions-no-implementation-authorized), [`../DECISIONS.md#adr-0039--v03-live-call-demo-slice-telnyx-first-sentdm-assisted-inbound-first`](../DECISIONS.md#adr-0039--v03-live-call-demo-slice-telnyx-first-sentdm-assisted-inbound-first), [`../architecture.md#voice-provider-lanes-future`](../architecture.md#voice-provider-lanes-future).

## 1. Problem

xAI now documents a broader API surface than the older Grok Voice assumptions in the ResponseOS architecture notes. The current docs include text generation, OpenAI-compatible access, Voice API, speech-to-text, text-to-speech, real-time speech-to-speech over WebSockets, ephemeral tokens, tool use, a Twilio phone-agent demo, rate-limit tiers, cost tracking, and security / compliance notes.

That makes xAI worth evaluating, but not safe to promote directly into the v0.3 live-call demo path. ResponseOS already has a planning baseline: Telnyx primary carrier, Vapi primary AI voice orchestration, Twilio failover, HubSpot commercial system of record, and event-ledger-first persistence behind the Communications Abstraction Layer. ADR-0039 further scopes the first live-call demo as Telnyx-first, Sent.dm-assisted, inbound-first, with Vapi optional if Telnyx AI Assistant is insufficient.

The risk is architectural churn: treating xAI's new API surface as permission to reopen the v0.3 provider stack before the already scoped Telnyx/Sent.dm/Vapi gates are proven.

## 2. Desired Outcome

Create a bounded readiness spike that answers where xAI belongs in ResponseOS without changing the current implementation plan.

The spike should produce one of three outcomes:

1. **Hold as watchlist:** xAI remains documented as experimental only.
2. **Approve mock-only exploration:** xAI gets a mock-only adapter candidate behind `VoiceAgentProvider` in a later approved PR.
3. **Open a follow-up ADR:** xAI evidence is strong enough to propose a formal provider-stack decision change.

Any outcome must preserve:

- mock-first provider behavior;
- no-secret boot;
- tenant isolation;
- event-ledger-first writes;
- webhook signature validation before mutation;
- v0.4 knowledge / RAG gates;
- no production deploy or live provider configuration without separate approval.

## 3. Current xAI Signals

| Capability | Current docs signal | ResponseOS relevance | Status |
|---|---|---|---|
| Text / Responses API | `https://api.x.ai/v1/responses`, OpenAI-compatible client configuration, and `@ai-sdk/xai` examples are documented. | Possible model-brain candidate for internal tools or future provider abstraction work. | Research only. Not part of v0.3 live call path. |
| Voice Agent API | Real-time speech-to-speech over WebSockets with `grok-voice-latest`, server VAD, output audio deltas, tool use, and `grok-voice-think-fast-1.0` as the current versioned voice model are documented. | Possible future `VoiceAgentProvider` candidate for non-regulated demos or operator copilot flows. | Experimental. Needs latency, fallback, transcript, and persistence testing. |
| Telephony path | xAI documents WebSocket, WebRTC, LiveKit, and SIP paths, plus Twilio/Telnyx SIP setup examples. | xAI may sit behind or beside a carrier, but ResponseOS carrier ownership still belongs to Telnyx/Twilio unless a later ADR changes it. | Carrier baseline unchanged; SIP capability is a spike input. |
| STT / TTS | STT batch/streaming and TTS endpoints are documented, with telephony-friendly output formats noted. | Could support future transcription or voice-rendering experiments. | Research only. Current v0.3 stack still prioritizes Telnyx/Vapi path. |
| Ephemeral tokens | xAI documents secure client-side connection support for browser/mobile voice agents. | Useful for website/app demos, less relevant to server-owned phone calls. | Candidate for non-regulated app/website assistant spike. |
| Cost tracking | REST responses include `usage.cost_in_usd_ticks`; docs note that the Vercel AI SDK does not currently surface it. | Useful for `UsageMeteringAdapter` if xAI is ever added. | Spike must verify voice-session cost observability. |
| Rate limits | Text/image/video tiers are published; docs say Voice and Imagine limit increases require contacting sales. Voice docs also expose session-specific limits, including 100 concurrent sessions in the Voice Agent API reference and a 120-minute max session duration. | Public demo reliability can be estimated, but actual account limits still need console/vendor confirmation. | Must test or confirm before live traffic. |
| Security / compliance | xAI docs state SOC 2 Type 2; BAA requires questionnaire and follow-up. | Not enough for HIPAA-ready lane without a signed BAA chain and retention review. | Non-regulated experiments only until legal/compliance review. |

### Evidence Snapshot

| Evidence item | Verified status | ResponseOS implication |
|---|---|---|
| `grok-voice-latest` currently points to `grok-voice-think-fast-1.0`; docs recommend pinning a versioned model in production. | Verified in xAI Voice Agent docs. | Any future adapter should pin the exact model in non-mock environments. |
| Voice Agent API supports WebSocket sessions and SIP call sessions, with the SIP session bound by a `call_id` from an incoming-call webhook. | Verified in xAI Voice Agent / SIP docs. | xAI could be tested as a phone-agent runtime, but it must still pass ADR-0009 signature and ledger-idempotency gates. |
| SIP phone-call docs describe webhook creation with a webhook signing secret returned during number/route setup. | Verified in xAI SIP docs. | Signature verification may be feasible, but must be implemented and tested before any mutation. |
| SIP docs include Telnyx and Twilio setup examples. | Verified in xAI SIP docs. | xAI can be evaluated behind the existing Telnyx/Twilio carrier boundary instead of replacing the carrier layer. |
| SIP call control includes transfer via `refer`, DTMF events, and ending active calls. | Verified in xAI SIP/API docs. | Escalation/handoff is plausible, but exact failure and audit behavior still need test evidence. |
| Voice pricing lists Realtime at `$0.05/min`, Realtime text input per message, TTS per character, and STT per hour. | Verified in xAI pricing docs. | Usage metering can be modeled, but exact per-session voice cost events still need validation. |
| `cost_in_usd_ticks` is documented for inference responses and streaming chunks, with a note that the Vercel AI SDK does not surface it. | Verified in xAI cost-tracking docs. | Prefer REST/OpenAI SDK evidence for metering; do not assume `@ai-sdk/xai` exposes billing fields. |
| Security FAQ describes enterprise Zero Data Retention, SOC 2 Type 2, and BAA inquiry path. | Verified in xAI security docs. | Non-regulated demo only until ZDR/BAA/retention are contractually confirmed. |
| Voice docs contain both 50-session and 100-session references in different contexts. | Partially verified; needs vendor/account confirmation for the exact selected mode. | Treat concurrency as an open operational gate, not a solved capacity claim. |

## 4. Recommended Placement

xAI should stay in the **experimental voice layer** described in `architecture.md`.

Recommended safe placements:

- website or app voice assistant demo;
- internal operator copilot;
- sales qualification pilot using synthetic or demo-only data;
- future `VoiceAgentProvider` implementation candidate;
- future model-brain candidate for non-phone workflows;
- cost-metering research source because xAI exposes per-request cost ticks.

Do not place xAI in:

- the primary v0.3 live-call demo path;
- the carrier layer;
- HIPAA-ready tenant workflows;
- client data workflows;
- webhook-triggered business mutation paths;
- knowledge ingestion, vector search, RAG, or per-tenant memory activation.

## 5. Fit Against Current ResponseOS Architecture

| ResponseOS layer | Current canon | xAI fit |
|---|---|---|
| Carrier provider | Telnyx primary, Twilio failover | No. xAI is not the carrier baseline. |
| Voice agent provider | Vapi primary, Retell secondary | Maybe later, behind `VoiceAgentProvider`, after spike evidence. |
| Model brain | OpenAI preferred inside Vapi where configurable | Maybe later for non-regulated or fallback model tests; not v0.3 baseline. |
| Messaging provider | Sent.dm-assisted for live-call demo | No direct replacement in this spike. |
| Usage metering | Future adapter boundary | Potentially useful if xAI cost ticks are available for the selected API mode. |
| Knowledge layer | v0.4-gated | No. xAI Files / Collections / RAG-style features stay out of scope. |

## 6. Scope

In scope for this readiness spike:

- verify current xAI docs and pricing;
- validate the exact real-time voice connection model;
- test a local mock-only proof of shape, if separately approved;
- map xAI events to a candidate `VoiceAgentProvider` contract;
- document transcript, audio, and cost fields needed for the event ledger;
- identify whether xAI emits enough session metadata for idempotency, audit, replay, and usage metering;
- confirm whether a server-owned phone call can be integrated cleanly without bypassing Telnyx/Twilio carrier controls;
- confirm security posture, retention posture, BAA path, audit logs, and data handling;
- define failure modes, kill switch needs, and fallback routing.

Out of scope:

- real xAI API calls from this repo;
- API key creation or storage;
- `.env.example` additions;
- Doppler changes;
- provider SDK installation;
- schema migrations;
- production deploys;
- public demo traffic;
- client data;
- HIPAA-ready use;
- replacing Telnyx, Vapi, Sent.dm, HubSpot, or the current v0.3 implementation brief.

## 7. Readiness Questions

Before xAI can move beyond experimental research, answer these questions with test evidence or vendor documentation:

1. **Telephony control:** Is xAI only the speech-to-speech agent behind Twilio/Telnyx, or can it provide carrier-grade call control directly?
2. **Webhook model:** What callbacks exist for session started, session ended, tool call, transcript ready, recording ready, error, timeout, and billing usage?
3. **Signature verification:** Does the SIP webhook signing secret cover every inbound event that can cause a ResponseOS mutation, and what is the exact verification algorithm?
4. **Idempotency:** Which provider-stable IDs can be used as ledger dedupe keys?
5. **Transcript handling:** Are transcripts available in real time, after session end, both, or only client-side?
6. **Recording handling:** Are recordings stored by xAI, passed through, or excluded? What retention controls exist?
7. **Cost telemetry:** Does Voice API return cost fields equivalent to REST `cost_in_usd_ticks`, and at what granularity?
8. **Concurrency:** Which session limit applies to the selected integration mode, and what are burst behavior, queue behavior, and public demo failure modes?
9. **Fallback:** Can a live call fail over cleanly to Vapi/Retell/Telnyx AI Assistant without breaking the caller experience?
10. **Escalation:** Can the agent hand off to a human or external workflow with deterministic state?
11. **Tool safety:** Can web search, X search, code execution, or remote tools be disabled per tenant/use case?
12. **Compliance:** Is there a signed BAA path, retention policy, deletion/export path, audit-log access, and regional data control?

## 8. Minimal Safe Spike Sequence

Only after explicit approval for a research spike:

1. **Docs-only inventory:** capture current xAI endpoint, model, cost, rate-limit, security, and telephony claims in this file or a follow-up note.
2. **Contract mapping:** draft a candidate `XaiVoiceAgentProvider` shape against the existing provider abstraction without committing code.
3. **Mock transcript fixture:** create synthetic demo-only examples of session start, response audio delta, transcript final, tool-call event, error, and session end.
4. **Event-ledger mapping:** map those synthetic events to ResponseOS ledger fields and identify missing fields.
5. **No-secret local prototype:** only if approved, test local shape with fake credentials and no network call.
6. **Vendor verification:** confirm webhook signatures, concurrency, retention, BAA path, and pricing for the exact voice mode.
7. **Decision checkpoint:** choose hold, mock-only adapter candidate, or follow-up ADR.

## 9. Acceptance Criteria

The spike is complete when:

- xAI's role is explicitly classified as hold, mock-only exploration, or ADR candidate;
- every architecture gate in `architecture.md` has a status: verified, partially verified, blocked, or not applicable;
- the carrier boundary remains Telnyx/Twilio unless a later ADR changes it;
- the live-call demo brief remains valid and unmodified unless a later ADR changes it;
- no code, schema, env, secret, or deploy work has occurred under this planning artifact;
- the recommended next task is small enough to become a scoped GitHub issue or draft PR brief.

## 10. Issue-Ready Task Brief

**Title:** xAI Voice Agent readiness spike, docs-only evidence classification

**Owner:** Codex

**Status:** Ready for issue creation. No implementation authorized.

**Problem:** xAI's current Voice Agent and SIP docs appear stronger than the older ResponseOS Grok Voice assumptions, but ResponseOS must not reopen the v0.3 Telnyx/Vapi/Sent.dm path without evidence.

**Task:** Produce a docs-only readiness classification that verifies xAI's telephony, webhook signature, transcript, cost, concurrency, retention, fallback, and handoff behavior against ResponseOS's provider gates.

**Acceptance criteria:**

- Each `architecture.md` xAI gate is marked verified, partially verified, blocked, or not applicable.
- The spike identifies the exact xAI integration mode being evaluated: direct WebSocket, WebRTC, SIP with Telnyx/Twilio, or website/app voice.
- The spike confirms whether xAI can satisfy ADR-0009 before any event-ledger mutation.
- The spike maps xAI session/call IDs to ResponseOS ledger dedupe requirements.
- The spike states whether the next safe action is hold, mock-only adapter candidate, or follow-up ADR.
- No provider code, env var, schema migration, secret, deploy, or live API call is included.

**Out of scope:** live xAI calls, account setup, API keys, `.env.example`, Doppler, SDK install, schema, provider adapter, production demo, client data, HIPAA-ready use.

**Recommended label:** `planning`, `integrations`, `v0.3`, `provider-readiness`, `docs`.

## 11. Recommendation

Proceed with **issue creation or draft PR packaging** for the docs-only readiness classification.

The current best placement remains: **experimental `VoiceAgentProvider` candidate for non-regulated demo and operator-assist use cases, not the primary v0.3 live-call path.**

This keeps ResponseOS aligned with the existing Communications Abstraction Layer while allowing xAI to be evaluated without reopening the provider stack prematurely.

## 12. Source Links

- xAI overview: <https://docs.x.ai/overview>
- xAI Voice API overview: <https://docs.x.ai/developers/model-capabilities/audio/voice>
- xAI Voice Agent API: <https://docs.x.ai/developers/model-capabilities/audio/voice-agent>
- xAI SIP phone calls: <https://docs.x.ai/developers/model-capabilities/audio/voice-agent/sip>
- xAI pricing: <https://docs.x.ai/developers/pricing>
- xAI rate limits: <https://docs.x.ai/developers/rate-limits>
- xAI cost tracking: <https://docs.x.ai/developers/cost-tracking>
- xAI API security FAQ: <https://docs.x.ai/developers/faq/security>
