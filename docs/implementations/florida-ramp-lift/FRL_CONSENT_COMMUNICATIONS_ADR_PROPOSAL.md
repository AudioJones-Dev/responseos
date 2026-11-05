# PROPOSED FRL Decision Record — Consent-Gated Mobile-Line Intelligence

**Status:** PROPOSED / NOT ACCEPTED / DOCUMENTED_ONLY — 2026-11-05.
**Identifier:** FRL-COMMS-001 (local proposal, **not** an accepted numbered ResponseOS ADR).
**Decision authority:** Operator and applicable FRL client approver; formal acceptance requires a later canonical ADR update in `docs/DECISIONS.md` and any program-control approval.
**Related specification:** [FRL_CONSENT_COMMUNICATIONS_IMPLEMENTATION_SPEC.md](./FRL_CONSENT_COMMUNICATIONS_IMPLEMENTATION_SPEC.md).

## Context

FRL founder uses an existing mobile-carrier main line and requires inbound plus outbound call intelligence, but recording/transcription must happen only after required participants explicitly consent. Resulting authorized context should support HubSpot CRM and operational memory, and eventually approved AI phone/email flows. Calls dialed natively through the mobile carrier do not automatically traverse Telnyx. Existing ResponseOS provider, webhook, CRM, and phased knowledge architecture should not be duplicated.

## Proposed decisions (not binding until accepted)

1. Keep the existing mobile number during the pilot. Route **eligible inbound** traffic by carrier-supported forwarding to a Telnyx test DID, bridge to a separate non-looping founder endpoint. Use an authenticated FRL dialer for **instrumented outbound** calls. Native-dialer calls are visibly out of scope, not assumed captured.
2. Require a no-content-capture server-side DTMF consent gate before enabling recording, streaming, speech recognition, transcription, or content analysis. Founder consent is separate. Decline, ambiguity, technical failure and timeout default to no capture. Revocation stops capture. Consent records are auditable with source, leg, scope and timestamp. Legal review is a prerequisite.
3. Keep Telnyx behind provider interfaces and signature-verified, idempotent webhook event ingestion; always derive account scope from server-trusted mapping. No live Telnyx access as a consequence of this proposal.
4. HubSpot owns commercial CRM records. ResponseOS owns internal event/evidence and proposed mutation state. Auto-log verified safe call activity where separately approved; require human review for ambiguous identities and consequential changes to deals, terms, schedules, invoices and communication.
5. Separate authorized episodic evidence from source-linked operational facts and reviewed procedural knowledge. v0.3 may implement bounded capture with separate authorization; semantic retrieval and agent-memory use remain **v0.4+ gated** until accepted.
6. No self-modification of live AI prompts or policies based on caller utterances. Learn through candidate improvements, labeled evaluation, approval, and versioned release. FRL email access remains exclusively `flrampandlift@gmail.com`, and no email is sent without explicit approval.
7. Implement in ResponseOS if the operator separately authorizes relevant v0.3 development. FRL operational repositories remain consumers and governance records; frozen source repo receives no runtime edits. A dedicated private FRL service is a fallback only after a specific ownership decision.

## Alternatives considered

- **Port the mobile number immediately:** better unified routing if fully verified, but migration, continuity and rollback risks too high for a first pilot.
- **Forward to the same mobile number:** rejected for forwarding-loop risk.
- **Record/transcribe everything and rely on post-processing permission checks:** rejected; content capture itself must be consent-gated.
- **Treat transcription as automatically permitted when recording is declined:** rejected absent separate legally reviewed, explicit consent scope.
- **New independent full communications platform:** duplication of ResponseOS tenant, events and CRM substrate; not preferred.
- **Build business memory into HubSpot alone:** CRM timeline cannot by itself provide provenance, versioned procedural knowledge, conflict resolution and independent correction history.

## Consequences and tradeoffs

Pros: retained number; reversible pilot; auditable consent; deduplicated evidence; lower architectural duplication; CRM governance. Costs: two calling paths initially, founder behavior change for outbound, carrier-specific forwarding caveats, callback/leg races, extra operational complexity and privacy controls. Some ordinary native mobile calls remain uncovered. This must be communicated accurately.

## Gatekeepers and open questions

Operator authorization of v0.3 slice; FRL client approval; counsel-approved disclosure and jurisdiction policy; carrier and independent founder endpoint; Telnyx verified caller ID; HubSpot permissions and authoritative mapping; lifecycle of evidence/retention; live deployment budget/kill switch; independently approved v0.4+ memory retrieval; readiness tests and rollback owner.

## Required ratification work

Upon approval, add a numbered ADR to `docs/DECISIONS.md` without colliding with concurrent/open-branch ADR numbers, update `docs/ROADMAP.md` for authorized scope, and update progress dashboard and changelog as appropriate. This planning PR alone makes none of these decisions effective. Do not merge as proof of approval or activate providers based on this file.

## Architecture checklist / review prompts

- Layer: communications ingestion + consent, evidence capture, CRM adapter, future memory; provider-independent except Telnyx edge.
- Build vs buy: buy telephony/STT, build consent state/authority, event ledger, evidence mapping and field-specific governance.
- Data authority: HubSpot for commercial records, FRL operational system for jobs, ResponseOS for call evidence and derived proposals.
- Tenant isolation: server-derived account only, protected every call, persisted fact and retrieval.
- Evidence: source-linked timestamps, status, validation, correction and consent window.
- Fail-safe: no content capture without verified consent, no risky mutation without permission.
- Claims: DOCUMENTED_ONLY; no implication of deployed call routing, memory, legal compliance, or CRM writes.
- Timing: planning now, implementation only after explicit scoped authorizations; independent live and v0.4 gates.
