# Mike's supervised FRL demonstration

Status: local implementation under review; independent review and live activation remain pending. No live demonstration has passed. Owner: Audio. Implementers: Claude (reused closure candidate `e55c100`), Codex (reconciliation and review/consent changes). Reconciled base: `a9747cc` (includes PR #175 and ADR-0055).

## Approved task

### Ratified recovery boundary (2026-09-15; repository implementation in review)

An expired lease is not evidence of provider failure. After durable intent for a contact, call, task or association, an unknown outcome stops automatic execution for reconciliation. An empty HubSpot search never authorizes a second create. The operator inspects readback, leaves unresolved, adopts a verified result with independent evidence the original worker cannot resume, or abandons local execution. No force retry is provided. Abandonment does not undo HubSpot effects. Every resolution preserves the original frozen review, actor, generation, effect, evidence and reason.

New email waits for durable success of all required CRM effects. Accepted email remains accepted. False-positive blocking after intent but before HTTP is an accepted safety tradeoff. This is bounded recovery, not exactly-once delivery or universal deduplication. No provider activation is included.

Recovery rehearsal: interrupt a provider create after acceptance, retry dispatch and confirm no second create and no email; inspect CRM evidence; an empty/unavailable/ambiguous readback must remain blocked. For adoption, independently terminate/drain the earlier invocation and document how it cannot resume, verify the exact destination and original review attribution, then adopt the fresh matching result. Dispatch the original review to finish remaining effects and allow its email. Existing accepted email must not resend. If any evidence is missing, leave unresolved or abandon locally. Merely waiting 15 minutes is not evidence that a worker stopped. Legacy operations without a provable original binding remain blocked.

HubSpot readback uses the provider-reported portal from `/account-info/v3/details`; missing scope/read access blocks execution rather than assuming a destination. Contact reconciliation requires exact phone and approved sanitized caller name; call/task reconciliation uses the original review/hash correlation. Associations require the exact HubSpot-defined call-to-contact (194) or task-to-contact (204) relationship. No repeatability guarantee is inferred from PUT. See [account information](https://developers.hubspot.com/docs/api-reference/legacy/account/account-information/guide), [search limitations](https://developers.hubspot.com/docs/api-reference/latest/crm/search-the-crm), and [association types](https://developers.hubspot.com/docs/api-reference/legacy/crm/associations/associate-records/guide).

Doctrine §21 amendment answers: (1) execution/recovery layer; (2) built around existing adapters; (3) closes the supervised demo blocker; (4) preserves transactional evidence; (5) requires durable acknowledgments; (6) records operational failure evidence without claiming learning; (7) provider idempotency is integrated only when established; (8) no CRM/workflow engine duplication; (9) provider-specific semantics stay in adapters; (10) account-scoped CAS and server-derived review identity; (11) original review/hash binding reduces ambiguity; (12) exactly-once claims prohibited; (13) bounded existing operator reconciliation; (14) no new content capture or weakened consent; (15) required for this PR's safety boundary.

Problem: the merged baseline does not connect approved FRL context, a real call, operator-reviewed evidence, test CRM records, and an email Mike receives.

Target outcome: an isolated inbound demonstration that will cover every FRL intake path, using real approved business facts and clearly fictional customer/project scenarios. It is pending independent review and live activation. Audio approves the follow-up before CRM or email effects. Invite Mike only after two consecutive internal live rehearsals pass.

Success: Mike can choose a scenario and ask unscripted questions; the agent uses supported facts, handles unknowns honestly, and creates follow-up Mike considers useful. This establishes demonstration evidence, not autonomous readiness, production readiness, revenue recovery, or a guaranteed sale.

Scope: supervised tenant configuration, pinned business knowledge, per-call consent evidence, canonical call capture, operator review, bounded HubSpot contact/call/qualified task, operational email, failure visibility, and rehearsal tests. Out of scope: recording, real customer histories, production traffic, scheduling, outbound calls, public release, separate CRM Notes/Tickets/Deals/Companies, general RAG, and a new agent platform.

## Implementation and provenance

Reuse candidate runtime, configuration, normalization, HubSpot and Resend work from `e55c100` selectively on a branch from current master. The original closure worktree's uncommitted `supervisedTenant.ts` change is preserved and is not included. Candidate documentation and environment scripts were not imported as authority. Original candidate claims about recording and immediate external effects are superseded by this task.

- Add `business.knowledge` to the typed operator configuration: approved facts with source references, plus explicitly fictional scenario records. Store assertion provenance with a hash covering values, not only field names. No real FRL operational values are committed.
- Pin the approved snapshot on `CallCaptureSession` at assistant initialization. Missing context or recipient prevents readiness. Updating configuration does not change an existing call's context.
- Keep recording disabled. Append `CallConsentEvent` records for the transcript artifact. The authenticated operator records witnessed grant/refusal/withdrawal at current server time; entries cannot be backdated or edited. This endpoint records evidence; it does not control Telnyx capture.
- Require verified provider capture controls and interval provenance in the signed preflight. Content events require `capture_started_at` and `capture_ended_at` covering their entire cumulative content. Missing or unauthorized intervals are metadata-only before ledger storage and normalization. This transport contract is **not verified against a live provider**. A prompt instruction or operator consent row is not proof that capture stopped at the provider.
- Finalized calls create versioned `CallReview` drafts. Authenticated operators edit the structured payload and preview the exact email before approving. Approval freezes the payload and records the reviewer. Stale or duplicate decisions fail closed.
- A separate dispatch action uses the approved content. Ordinary personalized prospect demos retain their CRM prohibition. Qualified-only task eligibility is retained; PR #175's unratified outcome allowlist is not adopted.
- CRM and email statuses are independent. Provider acceptance is not inbox receipt. Retries reuse the frozen payload and email idempotency key; old ambiguous deliveries require reconciliation. No background scheduler or unattended retry is claimed.

### Approved availability wording repair - 2026-09-15 (local implementation)

The v4 supervised template and dynamic context distinguish 24/7 AI answering (including holidays) from human availability. Transfer is an attempt; callback is a request with no completion or timing promise. Refusal remains non-capturing: the witnessing operator handles any callback request manually and must not rely on a transcript-based review or email being created for a refused call. Shared policy is unchanged; commissioning must supply an approved tenant disclosure without a human-availability promise.

Provider configuration must later match `supervised-receptionist.v4` and its computed checksum, followed by fresh evidence-backed attestation after provider verification. No provider update or attestation has occurred as part of this repair. CRM recovery remains frozen. Local validation passed: 34 focused tests, 823 unit tests, 198 PostgreSQL integration tests, lint, typecheck and production build. Owner diff approval and focused independent review remain pending before commissioning.

### Commissioning qualification assignment - 2026-09-15 (implementation in review)

The dedicated number can enter a temporary `qualification` assignment only after the supervised tenant has a disabled exact `SUPERVISED_PILOT` profile and complete approved operating snapshot. This state resolves the real FRL context for signed Telnyx initialization and call events, pins `CallCaptureSession`, and exercises the existing consent, retention, normalization, and review-evidence path. It does not create or validate final provider attestation and it does not open the live-communications execution gate.

The provider context reports `SUPERVISED_QUALIFICATION`; CRM, scheduling, payment, outbound, and provider memory are disabled. The tenant profile stays disabled. Normal configuration and activation stop until the operator ends qualification. CRM and email authorization also checks the call's assignment interval, so evidence collected during qualification cannot be dispatched later after normal activation. Ending qualification preserves the historical interval for delayed events, clears number exclusivity, and returns the number to local inventory availability. Provider routing changes and controlled calls remain separately authorized commissioning work.

## Interfaces

Updates to an enabled supervised profile require explicit reactivation with the complete approved configuration and fresh number preflight. Omitting activation cannot change an active tenant's policy. The call webhook records only metadata and rejects normalization when the supervised runtime is incomplete, degraded or outside `SUPERVISED_PILOT`. Existing notification retries use their stored recipient and message even if the latest configuration was revoked; the live email provider gate remains required for previously live attempts. These controls are repository behavior, not proof of provider activation or delivery.

Late evidence cannot create a superseding review while a dispatch is claimed. The webhook retains the event and marks processing as failed for a retry after dispatch releases its claim; replay is not an unattended scheduler. A later revision following provider effects requires reconciliation. Revoking the execution gate during CRM dispatch prevents the subsequent email effect. G-12 still stops new transcript persistence after withdrawal, including delayed content from an earlier capture interval; previously retained evidence is not deleted by this check.

Activation requires transcription to be enabled because this workflow requires a consented transcript for review. Capture intervals ending in the future are rejected. Consent event time is sampled by the server after acquiring the capture lock, so a waiting transaction cannot backdate a withdrawal into content already retained under that lock. Normalization and webhook processing status commit together. Uncorrelated events retain metadata only; a later signed redelivery can be retried after correlation is available. No automatic replay of discarded content is claimed. Migration 0014 checks duplicate quote-request lead links before any schema change and stops for operator reconciliation without deleting rows. Provider-accepted email status is preserved if subsequent audit logging fails.

- Existing `POST /api/admin/supervised-tenants` accepts typed configuration entries including `business.knowledge`; use `dryRun` before an authorized apply.
- `POST /api/admin/supervised-tenants/qualification` starts or ends the effects-disabled qualification assignment. Start requires the configured account slug, provider number/resource identity, provider assistant identity, and an approval record reference. End requires the account slug, number, and operator reason. Both actions are operator-only; neither changes provider routing or issues attestation.
- `POST /api/admin/call-capture/:id/consent`: `{action: grant|refuse|withdraw, disclosureRef, evidenceRef, jurisdictionBasis, eventKey}`; all four strings are required and `jurisdictionBasis` is the ADR-0055 jurisdiction basis the operator attests. Actor, tenant, artifact, source channel (`call`) and event time are server-owned. `:id` is an initialized capture session, not a caller-selected tenant.
- `POST /api/admin/call-reviews/:id`: approve with expected revision and structured payload; reject with expected revision; dispatch an already approved revision. Only authenticated cross-tenant operators may operate this console, consistent with the existing operator role.
- `/admin/demo-operations` shows review, transcript, email preview and delivery state. Full transcript remains authenticated and is never exported to CRM or email.
- Additive migrations 0014 (reused runtime), 0015 (capture/consent/review), and 0016 (explicit qualification assignment status). Existing rows retain their assignment state; new supervised calls require approval. Existing prospect-demo behavior is preserved.

Review repairs also enforce these limits:

- Configuration input is checked before service dispatch. Duplicate weekdays/dates and inherited object keys are rejected. Activation renders the complete context and rejects overflow without truncation. Dry runs return a null final snapshot hash; apply returns the persisted snapshot hash.
- Changing an active dedicated number is blocked until the existing assignment is explicitly released. This demonstration does not silently perform provider release or number replacement.
- Signed webhook rows preserve indexed call aliases. A numberless event can recover its target and original initialized capture identity from those aliases; ambiguous targets are refused. An event still awaiting correlation returns HTTP 503 and retains metadata only. [Telnyx documents retrying 5xx voice webhook responses](https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-webhooks). Recovery still depends on redelivery arriving while consent permits retention; provider retry exhaustion needs operator reconciliation.
- The console selects the latest review per call before limiting calls, and reads current consent separately for each displayed capture.
- Live CRM dispatch rejects existing mock operations, including mock successes. Supervised retries must use the original approved review's dispatch action; the legacy CRM retry endpoint rejects them. This retains the reviewed payload and current execution-gate checks without inferring a newer approval.
- A notification accepted by the provider but not persisted successfully receives a reconciliation code and retained provider message ID when the recovery write succeeds. Operator retry repairs that state without another send. If even recovery persistence fails, delivery remains uncertain and requires reconciliation.

## Architecture checklist (§21)

1. Layers: communications capture, operational memory, follow-up.
2. Build policy/evidence/review; integrate existing provider adapters; defer fulfillment.
3. Directly closes Mike's call-to-follow-up journey.
4. Preserve call, source, consent, review and delivery evidence.
5. Prove communication outcomes only; no revenue claim.
6. Collect operator corrections as evidence, not automatic model training.
7. Buy voice, transcription, CRM and email.
8. Do not duplicate telecom, CRM or scheduling products.
9. Canonical records and provider interfaces bound vendor dependence.
10. Derive tenant from authenticated operator-selected server resources or verified number assignment.
11. Do not label estimated value as recovered revenue.
12. No unsupported live, autonomous, compliance or conversion claim.
13. Add explicit per-call approval before external follow-up.
14. Consent and recipient handling require verified activation evidence; retain no audio.
15. Required for the requested demonstration; broader platform work excluded.

## Open operational gates

### Local validation — 2026-09-13

Branch `feat/mike-live-demo`, worktree `C:/dev/responseos-mike-live-demo`, [draft PR #177](https://github.com/AudioJones-Dev/responseos/pull/177). The validation below covers the implementation committed as `9458513`; it is local test evidence, not independent review or CI evidence.

- Node 24.18.0 / npm 11.16.0: lint, typecheck, 687 unit tests across 60 files, and production build passed.
- PostgreSQL 16.15 on loopback with synthetic databases: all 15 migrations applied; Prisma schema diff reported no difference; all 180 integration tests across 15 files passed. The production build also passed with the synthetic preview database configured.
- Browser verification: fictional call transcript, structured fields and exact email preview rendered; approval froze edits and changed status to approved while CRM/email remained pending. No dispatch or live provider call occurred.
- Fixed issues found during validation: configuration snapshot idempotence now ignores assertion timestamps while comparing fact values; preflight errors expose the safe actionable reason; integration role fixtures use the actual restricted development-session key.
- Independent review, hosted authentication, provider-side consent capture, live CRM effects, inbox receipt and rehearsal timing remain unverified.

### Remaining activation work

1. Independently review current code, including reused Claude work; mixed authorship requires CodeRabbit under repository policy. Human merge only.
2. Verify real provider event shapes, consent start/stop controls, and cumulative-content bounds. If unavailable, keep activation blocked and revise the transport explicitly; never fabricate evidence or silently weaken consent.
3. Obtain approved FRL fact pack, disclosure wording, callback expectations, recipient and demonstration number through the operator configuration path.
4. Operator separately authorizes isolated resources, credentials, provider activation, deployment and live sends. Configure hosted auth and kill switches; no public number release.
5. Validate local and CI gates, live HubSpot mappings, email receipt, failure drills and rollback.

## Rehearsal acceptance

### Qualification call procedure and 2026-09-16 failure evidence

The first affirmative-consent qualification call is preserved as failed evidence under Telnyx conversation `79548a1d-0c57-48ea-8a27-7f986126eed8`, ResponseOS capture `cmu3v1t0j0001la041fvi4hkm`, and qualification assignment `cmu3fbff80006l50439xvc2p2`. Recording and business effects stayed off, but the call cannot support consent or capture verification: the operator did not append a `CallConsentEvent`, the dynamic-variables response took 1,536 ms against a 1,500 ms provider timeout, the configured TeXML application delivered signed form callbacks to the JSON AI-event endpoint, and no provider event supplied the required capture interval. This evidence is historical and must not be edited, deleted, replayed, or reclassified as a passing run.

The current Telnyx no-code/TeXML callback channel and the JSON Call Control AI-event channel are separate contracts. `/api/webhooks/telnyx/calls` accepts signed `application/json` AI events only. TeXML `completed`, `conversation_ended`, and `analyzed` callbacks are not consent evidence and do not manufacture `capture_started_at`, `capture_ended_at`, message-history delivery, or final insights. A dedicated TeXML adapter is deferred until the selected provider mode can satisfy the capture contract; accepting form content now would make an unsupported interval appear valid.

Before every qualification call, the authenticated operator keeps `/admin/demo-operations` open and confirms that the new `CallCaptureSession` belongs to the active qualification assignment. After the approved disclosure, the operator identifies that exact session, witnesses the response, and immediately appends `grant`, `refuse`, or `withdraw` with the approved disclosure, evidence, and jurisdiction references. A grant does not itself start provider capture; refusal and withdrawal do not themselves stop it. The provider-side start/stop mechanism and signed interval evidence must already be verified before another call is authorized.

The next affirmative-consent retest remains blocked until the chosen Telnyx mode proves all of the following without weakening ADR-0055: provider processing may occur only as separately approved, persisted transcript content begins after the witnessed grant, persisted content stops after withdrawal, signed events carry trustworthy boundaries, and required message history and final insights reach ResponseOS while the approved privacy setting is in force. If the no-code assistant cannot supply those controls, commissioning requires an architecture decision for a pre-intake consent gate or another provider mode; receipt timestamps and cumulative transcript text are not substitutes.

### Call Control qualification replacement — 2026-09-16

The owner rejected the direct TeXML/no-code path and authorized a Voice API Call Control qualification increment. The call is answered without recording, AI, transcription, gather-AI, streaming or media fork. ResponseOS plays the complete approved disclosure, waits for its signed completion event, then opens a one-digit DTMF gather. Press 1 or 2 only creates provider input evidence; Audio must select the matching active capture in `/admin/demo-operations` and record grant/refusal. Grant commits the consent event and durable start intent before Telnyx receives an idempotent `ai_assistant_start`. Refusal and ambiguity never start the assistant.

The start boundary is qualified only after the authenticated command response supplies the conversation ID/provider response time and a signed cumulative-history event arrives with the current capture generation and an occurrence time inside the verified capture interval. Withdrawal commits the operator event and admission fence before the idempotent stop command leaves ResponseOS. Later protected content is rejected even if signed. A hangup time is provisional and cannot authorize terminal history; ResponseOS waits for the signed conversation-end boundary. Normal completion then waits for both terminal events and a five-second terminal/history quiet window before freezing; the terminal delivery remains retryable during settlement, so cumulative history delivered out of order can reconcile without reopening a withdrawal fence. A signed cumulative revision from within the capture interval that still arrives after the first freeze produces a new immutable transcript and superseding review rather than being discarded. This receipt window is a completeness barrier, never a consent or capture-boundary timestamp. Recording and Telnyx retention remain off. The canonical final result comes from a frozen, hashed ResponseOS transcript revision and a separately labelled post-call interpretation; Telnyx Insight Groups are not required.

Before Scenario A retest, deploy the exact reviewed SHA, apply migration 0017, configure the FRL Voice API application to the dedicated Call Control endpoint, verify recording/retention/CRM/email remain off, and keep the authenticated operator console open. Hosted initialization timing must be measured; repository instrumentation exposes resolution, capture, render and total durations without caller content. The p95 target remains below 1,000 ms and no request may reach the 1,500 ms provider deadline. This source change does not supply hosted measurements, provider routing, attestation or activation.

Cover VPL, vehicle lift, ceiling lift and ramp inquiries; new/existing sales; new/existing service; project coordination; administration; homeowner, builder/GC and commercial roles. Verify fictional history access only with the scenario reference. Test unknown geography, price and compatibility; interruption; unsupported requests; consent refusal, silence and withdrawal; absent configuration; duplicate and out-of-order events; stale approval; CRM ambiguity/failure; email failure and retry.

Record exact build SHA, snapshot version, provider call ID, consent evidence, review revision, CRM identifiers, email provider identifier and human-confirmed inbox receipt for each run. Target review availability within two minutes of hangup and inbox receipt within two minutes of approval/dispatch. These are unverified acceptance targets. Two consecutive complete runs with no critical failure precede the invitation.

## Operator presentation

Allow 20–30 minutes: explain real facts versus fictional scenarios and the approval boundary; let Mike choose a caller/product; accept unscripted questions; inspect transcript and analysis; approve and dispatch; inspect CRM and inbox together; repeat with a service/project call. Capture corrections and objections before proposing the operational pilot.

### Repair validation — 2026-09-13

After reconciling master at `a9747cc`: `npm run lint`, `npm run typecheck`, `npm test` (710 tests), `npm run test:integration` (192 tests), `npm run build` with the isolated database, and `npm audit --audit-level=high` passed. Prisma migration diff, all 15 migrations and seed passed against synthetic Postgres 16 on loopback. Configuration validation passed. No provider effect, live call, deployment or client-data mutation was exercised. Independent CodeRabbit review and GitHub CI of the published repair remain separate gates.
