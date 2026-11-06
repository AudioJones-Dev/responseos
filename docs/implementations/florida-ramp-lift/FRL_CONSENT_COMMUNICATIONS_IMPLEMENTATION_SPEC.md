# Florida Ramp & Lift — Consent-Gated Communications Intelligence Implementation Specification

**Status:** PROPOSED / DOCUMENTED_ONLY. Planning only; not implementation or provider authorization.
**Date:** 2026-11-05
**Tenant:** Florida Ramp & Lift (FRL).
**Source authority:** ResponseOS ratified ADRs in `docs/DECISIONS.md`, `AGENTS.md`, `docs/ROADMAP.md`, and FRL program governance supersede this proposal. This file authorizes no schema migration, vendor activation, customer-content processing, phone routing change, CRM write, public claim, or deployment.
**Companion:** `FRL_CONSENT_COMMUNICATIONS_ADR_PROPOSAL.md`.

## 1. Objective and non-goals

Propose a consent-gated, evidence-first communications pipeline for the founder's **existing mobile-carrier number**, supporting inbound and outbound calls that traverse a controlled Telnyx path; authorized call transcription and semantic extraction; bounded HubSpot synchronization; operational memory; and retrieval for future phone and email agents.

Not in scope: porting the existing mobile number, intercepting native carrier calls, recording/transcribing declined or pending-consent calls, silently rewriting production agent prompts, autonomous invoicing/price/schedule modifications, live integrations, changing provider accounts, or using non-FRL email accounts. FRL email scope is strictly `flrampandlift@gmail.com`. No outbound emails without explicit approval.

## 2. Verified vs. proposed

- **Verified from repository documentation:** ResponseOS has a Postgres/Prisma event/transcript substrate, mock provider pattern, gated HubSpot finalized-call sync seam, and existing Telnyx-primary architectural decisions. This is not a claim that Telnyx is live or that full business memory is shipped.
- **Proposed:** FRL-specific call routing, consent machine, memory facts/retrieval, inbound/outbound integration, and agent context.
- **Unknown / blocking:** current carrier and forwarding features; founder endpoint; number-ownership/verified outbound caller ID; permitted caller-ID preservation; legal script and all-party consent procedure; actual Telnyx plan capabilities and webhook payloads; whether founder's mobile number can be used for both public identity and forwarded call delivery without looping; permission to activate v0.3; HubSpot field authority and object mappings; operational job source of truth.
- **Non-negotiable:** production live provider and v0.4+ knowledge gates remain closed until separate approvals.

## 3. Call routing and legs

### Inbound

`External caller -> existing mobile carrier number -> conditional or unconditional forwarding (carrier-dependent) -> Telnyx DID -> no-capture disclosure / DTMF gate -> bridge to independent founder endpoint`.

**Loop prevention:** The founder termination MUST NOT be the same forwarded mobile number. Use a separately identified SIP/WebRTC endpoint or un-forwarded secondary line. Before enabling forwarding, prove the calling party remains connected, caller ID and leg identifiers are preserved adequately, voicemail/failed-forward fallback is safe, and no loop occurs. Carrier forwarding may omit calls answered directly on the handset; do not label as full inbound coverage until tested.

### Outbound

`Founder FRL dialer (authenticated) -> Telnyx origination -> consent disclosure to remote party -> permitted bridge / media capture only on accept`.

Calls initiated through the native carrier dialer **bypass** this controlled path and MUST be marked `not_instrumented`, not silently counted as captured. Outbound caller ID for the retained mobile number requires provider-supported verification and delivery testing; never assume spoofing or PSTN presentation works automatically. Verify founder consent independently before enabling content capture. Test connected-leg topology, callbacks and revocation before call capture.

### Consent-free content barrier

Pre-consent speech prompts are played using non-recording Call Control; collect deterministic DTMF input (1=yes, 2=no) in the first pilot. Do NOT enable STT, voice AI/NLU, media streaming, ambient audio upload, or recording to interpret consent. No response or ambiguous input => not consented. If the technical configuration cannot guarantee no content capture, fail closed and route without capture or stop pilot.

## 4. Consent state machine (per call and participant/leg)

States: `PENDING_DISCLOSURE -> AWAITING_CHOICE -> ACCEPTED | DECLINED | TIMED_OUT | FAILED`; `ACCEPTED -> REVOKED` when any required participant withdraws. The founder's valid consent must be separately established. A participant joining mid-call requires a renewed gate before their voice is captured. An accepted flag does not extend consent to unrelated future calls.

Invariants:
1. `recording_enabled || transcription_enabled || media_stream_enabled` implies verified required-party consents for the active legs, disclosure version, and precise capture purpose.
2. No transcript segments or model-derived content memories for `DECLINED`, `TIMED_OUT`, `REVOKED` after revocation, or `FAILED`. Permitted routing metadata may be retained only under the separately approved policy.
3. The backend is the authority on state; model outputs, caller text, or externally supplied `consent=true` cannot authorize capture.
4. Revoke stops capture promptly; audit actual stop-command acknowledgments. Quarantine and review any content captured outside the authorized interval.
5. If a callback/stream races with consent, reject or quarantine by leg ID and server-validated capture interval.

Audit schema proposal:
`consent_event(id, account_id, call_id, call_leg_id, participant_role, disclosure_version, choice, method, event_at, effective_from, effective_until, provider_event_id, policy_version)`; unique dedupe keys, no raw pre-consent speech. Caller numbers and tokens are sensitive operational data and do not belong in Git.

Draft disclosure (LEGAL REVIEW REQUIRED): "Thank you for calling Florida Ramp & Lift. With everyone's permission, we would like to record and transcribe this call to document your request and improve service follow-up. Press 1 to agree or 2 to continue without recording or transcription." Consider separate notification/consent for AI-driven participation; script is not a legal conclusion. Florida and other applicable jurisdictions, interstate calls, and withdrawal require legal review.

## 5. Telnyx boundary and webhook reliability

Provider-specific behavior stays behind ResponseOS adapters; no real SDK/API credential or live provider activation in this planning PR. Proposed interfaces:
- `TelephonyProvider`: normalize call initiated/answered/bridged/ended events; start/stop authorized capture; bridge/transfer/hangup; handle errors; initiate authenticated outbound requests.
- `ConsentPromptProvider`: play disclosure and gather DTMF without transcription or recording.
- `TranscriptAdapter`: emit timestamped, direction/leg-scoped final segments **only after** capture authorization.

Proposed contracts (routes are NOT implemented):
- `POST /api/webhooks/telnyx/voice` — raw-body verification before parsing/mutation; provider-event ID dedupe; timestamp/replay protection; stable account resolution server-side, never via caller-supplied account ID.
- `POST /internal/calls/:id/consent` — authenticated state transitions, per-leg state + capture-window guard.
- `POST /internal/calls/:id/finalize` — queue finalized analysis, source links, reconciliation.
- `POST /internal/intelligence/extract`; `POST /internal/crm/sync`; `POST /internal/agents/context` — internal service boundaries, not public unauthenticated endpoints.

Verify signature using official Telnyx raw-body signature/timestamp specification at implementation time. Return webhook receipt promptly; enqueue processing with retry/backoff and a dead-letter workflow. Correlate provider event ID, call ID, leg ID, direction, time, tenant, and internal conversation ID. Duplicate events must yield the same state. Event ordering must not trigger capture before consent. Provider outage => fail closed on content capture and route according to a documented manual fallback. Observe consent-state metrics, provider errors, missed legs, transcript gaps, and daily spend ceilings.

## 6. Processing, CRM and operational actions

Consent-gated authorized final segments -> immutable evidence reference -> extraction -> entity resolution -> evidence validation -> proposed mutations -> bounded executor -> outcome ledger.

Candidate extraction types: `caller_intent`, `relationship`, `job_reference`, `service_request`, `urgency`, `quote_request`, `commitment`, `requested_schedule_change`, `complaint`, `action_owner`, `due_date`, `uncertainty`. Every claim includes source call/segment offsets, confidence (uncalibrated unless separately measured), event time, extraction version, and `proposed|verified|rejected|superseded` status. Do not let conversational instructions control the processor.

HubSpot remains the client commercial source of truth. Link using normalized E.164 and other verified identifiers; never merge on name similarity alone. Reuse existing ResponseOS finalized-call CRM adapter and operation ledger where compatible; reconcile with ADR-0047 and ADR-0050. Sync:
- approved activity/call summary -> eligible automatically once consent and correct association are proven;
- deduped contact creation, follow-up task -> rule-based bounded automation with review for uncertain identity, missing task owner, or ambiguous due date;
- deal stage, price, negotiated terms, invoice, job scheduling, contractor assignments, and external communications -> approval required.
- Store external HubSpot object ID, revision/version or update timestamp, last sync status, idempotency key, failures, and correction pathway. No automatic overwriting of newer human edits.

FRL contractor portal is the field/job system integration destination only after the authoritative job record and permissions are documented. Do not assume its database and ResponseOS database are interchangeable.

## 7. Business memory and retrieval

Three separable layers:
1. **Source evidence (episodic):** consent metadata, call timeline, authorized transcript segments and optional recordings in encrypted object storage, with TTL and deletion controls.
2. **Structured business facts (entity/operational):** append-only, source-linked assertions, conflicts, supersession, entity references, authority, event time, ingestion time, verification, and role access.
3. **Procedural knowledge:** reviewed FAQs, SOPs, qualifying questions, exception handling and approved agent instructions. Never automatically promote caller utterances to operating policy.

The relational event/fact store remains authoritative; semantic vectors are derived retrieval indexes, not authority. Business memory retrieval is separately gated under v0.4+; phase-1 v0.3 capture alone is not a shipped queryable knowledge layer. Multi-tenant isolation derives `accountId` from trusted session or server-side provider connection mapping, never request input. Apply FRL-only access policies and redact irrelevant sensitive content.

Agent context packet (future): `customer_verified_identity`, `current_jobs`, `open_commitments`, `recent_supported_events`, `approved_response_rules`, `prohibited_actions`, `citations`, `freshness`, `permissions`. Serve minimum necessary facts with source provenance. Email-agent access is strictly restricted to `flrampandlift@gmail.com`; drafting is distinct from sending, and sending requires explicit approval.

Learning loop: aggregate *authorized* call patterns -> evaluate against labeled samples -> proposed prompt/call-flow modification -> test in staging -> human approval -> versioned rollout. Never continuously self-edit live policies or prompts from unreviewed transcripts.

## 8. Acceptance plan and tests

- **Consent:** yes/no/no-input/repeat/timeout/withdrawal/multi-party/crossed event order; prove zero content captured or model-processed when not authorized.
- **Carrier:** conditional/all forwarding, independent founder endpoint, loop prevention, voicemail, missed/busy calls, mobile carrier disconnects, native outbound bypass, verified caller ID, caller-id/call-leg mapping.
- **Webhook:** invalid signature => no mutation; replay/duplicate => one logical event; dropped/out-of-order events; provider outage/retry; tenant-spoof attempts => rejected.
- **Transcription:** segment sequencing, overlap, delayed final segments, no pre-consent leakage, speaker ambiguity, call end cleanup.
- **CRM:** same phone multiple contacts, existing customer + job vs net-new lead, ambiguous contact, idempotent retries, concurrent operator edits, failed partial sync, approvals.
- **Memory:** hallucination/supersession, contradictory source, stale facts, revoked access, cross-tenant isolation, deletion/retention, agent prompt-injection resistance.
- **Agent flows:** safe fallbacks, handoff, email draft only, outbound no-send/no-dial without explicit approval.
- **Validation:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:integration` for code-bearing PRs, with CI green before merge.

Proposed pilot quality gates (not current performance): zero consent violations, zero unauthorized writes, >=99.9% logical event reconciliation, >=98% contact association precision on labeled calls, >=95% commitment extraction precision on labeled consented calls. Measure p50/p95 processing delay and set a tested SLO; do not claim "real-time" without measurements.

## 9. Delivery phases and individual authorization boundaries

**P0 — Plan/approve:** approve this ADR, identify carrier and founder endpoint, select responseos ownership, legal recording/disclosure policy, HubSpot/field authority, source of numbers, retention, operator roles, vendor/security constraints.
**P1 — Mocks/contracts:** Telnyx adapter interfaces, consent state machine with synthetic events, tests and dashboard tracking; no providers or migrations.
**P2 — Signed ingest skeleton:** Telnyx webhook signature and replay tests, queue/dedup ledger; provider access remains off.
**P3 — Inbound controlled pilot:** independent endpoint, no-capture DTMF gate, call bridge, opt-in capture and refusal fallback on a **test number**, only after P3 authorization.
**P4 — Outbound controlled dialer:** authenticated FRL dialer, caller-ID verification, disclosure flow, native-dialer bypass visibility, budget/abuse limits, only after approval.
**P5 — Structured capture/HubSpot:** extraction, reviewed bounded sync, deletion and audit, source-linked memory facts, each separately approved.
**P6 — Knowledge retrieval and AI agents:** separate v0.4+ authorization; evaluated retrieval and human-gated communication.
**P7 — Production:** documented legal acceptance, signed event path, end-to-end tests, cutover owner, rollback, monitoring, spend caps, no-secret leakage, explicitly approved deployment.

Each phase requires a separate implementation PR. This planning specification does not advance v0.3/v0.4, fund provider spending, provision infrastructure, or authorize production operation.

## 10. Open decisions / failure modes

1. What mobile carrier, forwarding plan, main line and independent destination can be safely used?
2. Are founder-initiated native dialer calls allowed to remain uncaptured, or must all business outbound calls move to FRL dialer?
3. Can verified business-number caller ID be presented reliably through Telnyx in this account?
4. What exact legal-reviewed script, purpose, retention, withdrawal, and multi-party policy applies? Who approves?
5. What is the production HubSpot portal/account, private-app scope, field mapping and write authority?
6. What system holds authoritative job/scheduling state, and what approvals must precede writes?
7. Does ResponseOS v0.3 authorization cover this FRL-only slice? What independently approves v0.4 retrieval?
8. Is selective recording needed or is authorized live transcription without retained recordings sufficient?
9. What operational RTO and manual fallback cover Telnyx outages/failed consent gates?
10. What precisely measures pilot quality, cost/call and final go/no-go acceptance?

## 11. Existing authority / references

- `AGENTS.md`: feature branch + draft PR + review, mock-first, tenant isolation.
- `docs/DECISIONS.md`: ratified Telnyx provider, webhook/event and CRM boundary ADRs.
- `docs/ROADMAP.md`: v0.3 live provider and v0.4+ knowledge gating.
- `docs/product/responseos-v0.3-live-call-demo-implementation-brief.md`: prior contracts-first sequence for a **demo**; FRL main-line scope is not equivalent to the demo approval.
- `docs/strategy/responseos-platform-doctrine-v1.md`: evidence/claims and layered design, proposed doctrine status.
- `AudioJones-Dev/florida-ramp-and-lift-ops`: frozen conceptual reference only.
- `AudioJones-Dev/florida-ramp-lift-program-control`: FRL scope and change governance.
