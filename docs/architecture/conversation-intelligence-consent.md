# Conversation Intelligence — consent and capture authorization

Status: **DOCUMENTED_ONLY / Proposed, not ratified**. Authoring agent: Codex. Date: 2026-09-24.
Part of [Conversation Intelligence](./conversation-intelligence-review.md) on `architecture/conversation-intelligence`; not a separate architecture programme. Independent review and owner acceptance are pending. This specification changes no runtime, provider configuration or production behavior.

## A. Architecture delta

Consent is a first-class authorization boundary before recording, transcription (including ephemeral STT), realtime media streaming to processors, or AI conversation analysis. Ordinary carrier media needed to connect two humans is distinct from copying or streaming that media to a capture/analysis service. Disclosure playback and provider DTMF detection need no speech recognition, recording or AI listener.

Effective permission is the intersection of current participant grants, pinned disclosure scope, tenant/capability policy, approved processing destinations, retention policy and capture generation. A grant cannot override the existing recording prohibition. Absent or uncertain permission denies the operation. Check permission before command submission, media admission, job dispatch, each processing stage, and result persistence/publication.

Maintain three separate projections: consent (`pending`, `granted`, `declined`, `withdrawn`), capture execution (idle/start requested/active/stop requested/stopped/unknown), and human call lifecycle. Decline MUST permit unrecorded human continuation without transcription, streaming or AI analysis. Human routing is not conditional on consenting. A busy or unavailable human endpoint is a routing failure, not consent refusal; no automatic recorded voicemail fallback.

Phase 1 is post-call-first, with streaming explicitly disabled. Defining a streaming permission does not authorize implementing a gateway. The same authorization contract will apply if a later phase is approved.

### Distinct permission scopes

| Scope | Proposed rule |
|---|---|
| `recording` | Required before any recorder starts; independently denied by existing execution policy until amended |
| `transcription` | Required before any STT processing or verbatim transcript persistence |
| `automatedAnalysis` | Required before a model receives conversation content, including previously captured content |
| `mediaStreaming` | Separate transport permission plus permissions for each destination's processing purpose; disabled in Phase 1 |
| `retention` | Artifact-specific purpose, expiry and policy version; no indefinite retention implied by recording consent |
| `internalTrainingQualityImprovement` | Separate optional affirmative authorization; false in Phase 1; service consent is not dataset, internal training or vendor model-training consent |

DTMF 1 grants only the explicitly enumerated service scopes in the exact presented disclosure; DTMF 2 declines those scopes. Store each scope separately even if one approved disclosure covers a service bundle. No silent scope expansion. If independent scope selection is later required, design a versioned menu; the initial binary menu must not imply granular choices it did not offer. Operator-leg consent is separately evidenced; a caller's grant cannot authorize another participant.

## B. Revised data model

Conceptual fields below use the requested names. `tenantId` maps to the existing `Account.id` / `account_id`; it is not a second tenant root. Session-derived scope governs operator access; signed provider ingress resolves scope from server-owned historical number assignment and provider connection. Never accept tenant authority from request JSON or `client_state`.

ConsentEvent is ADR-0055's existing canonical domain concept, not a new authority. Extend the shared CallConsentEvent implementation and evaluator after foundation reconciliation. The requested status vocabulary can be a typed projection over canonical action/artifact events; do not replace or reinterpret existing grant/withdrawal history. Pending and declined evidence cannot grant permission. CallEvidenceEvent notifications reference canonical consent IDs only. Audio presentation fields apply to this call-specific contract; other source channels retain channel-appropriate nullable fields. Phone snapshots are transport evidence, never identity proof.

### ConsentEvent (append-only; reconcile to CallConsentEvent)

| Field | Contract |
|---|---|
| `id`, `callId`, `tenantId` | Stable event and existing call/account identity; composite tenant-parent constraints |
| `status` | `pending`, `granted`, `declined`, `withdrawn`; current state is a derived projection |
| `consentMethod` | `dtmf` for initial caller responses; `system` for pending/timeout and `operator_acknowledgment` for the operator leg; never label timeout as a caller DTMF response |
| `disclosureVersion` | Immutable version identifier pinned before presentation; no resolution of `latest` |
| `disclosureAudioAssetId` | Exact immutable audio asset linked to disclosure text/version and content hash |
| `timestamp` | Effective source occurrence time in UTC; also retain `receivedAt` and durable `recordedAt`; uncertainty is explicit |
| `callerNumber`, `calledNumber` | Protected transport metadata snapshot at this interaction, nullable with reason if withheld/unavailable; not verified identity; masked read projections |
| `participantId`, `captureSessionId`, `generation` | Consent subject and execution boundary; grants do not carry to another call or generation |
| `permissions`, `retentionPolicyVersion` | Explicit scope decisions and artifact/purpose-specific retention policy |
| `evidenceMetadata` | Provider event/command IDs, connection/environment/leg, verified source reference, playback attempt/completion ref, DTMF digit when applicable, response window, reason, actor, policy version, causation and correlation IDs; allowlisted metadata only |
| `sourceChannel`, `jurisdictionBasis`, `supersedesEventId` | Preserve ADR-0055 provenance and append-only correction/withdrawal linkage; jurisdiction basis requires owner-approved policy |

Enforce uniqueness for scoped source event IDs; conflicting payloads for one identity are incidents, not last-write-wins. Serialize decisions per tenant/call/generation; store monotonic authorization revision. No provider timestamp alone can reopen a revoked generation. Existing grants cannot be backfilled from transcript presence or per-contact preference.

### Related records

| Entity | Proposed responsibility |
|---|---|
| `ConsentDisclosureVersion` | Immutable text, locale, text hash, enumerated scope wording, retention notice, withdrawal instructions, approval reference and effective/retired dates |
| `ConsentDisclosureAudioAsset` | Asset ID, disclosure version, private object reference, audio hash, format/duration and approval reference; changed audio or text creates a new version |
| `CallDisclosurePresentation` | Tenant/call/participant/generation, exact disclosure and audio asset, playback command ID, started/completed evidence and occurrence/receipt times; failed and interrupted attempts preserved |
| `CallCaptureSession` | Reconcile existing proposal/#177; separate consent and execution projections, authorization revision, participant map, revoked time and pending reconciliation |
| `CaptureCommand` | Narrow durable intent/outbox record: operation, target leg/recording/stream, stable command ID, authorization revision, request/ack/effective times and unknown-outcome state |
| `CallEvidenceEvent` | Append-only domain evidence linking presentation, consent, capture boundaries and processing cancellation; minimized payloads |
| `CallRecording` and processing jobs | Pinned consent/presentation refs, authorized interval, source hash, retention expiry, generation/revision and deletion tombstone checks |

These are logical responsibilities, not a mandate for duplicate tables. Reconcile #177 before choosing physical models; shared event/outbox tables can carry presentation and command records where constraints remain enforceable. Model-output JSON stays observation-only: no consent or authorization fields in the extraction schema.

Disclosure versions/assets may use a Git-versioned immutable manifest plus evidence references, as allowed by the main review; no new disclosure table is required. Permission names above are proposed typed concepts to map to the shared artifact/purpose vocabulary during foundation reconciliation.

## C. Consent state machine

| Current | Input and prerequisites | Next | Effect |
|---|---|---|---|
| none | Call/session initialized | `pending` | All capture/processing permissions off |
| `pending` | Verified completed presentation followed by correlated DTMF 1 in its response window | `granted` | Grant only disclosed scopes; capture still needs every other authorization gate |
| `pending` | Correlated DTMF 2 | `declined` | Human call continues, all protected operations off |
| `pending` | Invalid digit, silence, playback failure or timeout | `pending`, then `declined` at bounded expiry | No grant; reason distinguishes no response from express decline; unrecorded human routing proceeds |
| `granted` | Caller DTMF 2 during active call, or authenticated operator withdrawal on caller request | `withdrawn` | Revoke immediately, fence jobs/results and request all active remote stops |
| `granted` | Participant/topology change | Existing grant remains historical; new generation `pending` | Suspend capture; revalidate every participant before any future start |
| `declined` / `withdrawn` | Late DTMF 1, duplicate start, delayed grant | unchanged | No restart; these states are terminal for Phase 1's call capture |

Proposed active-call withdrawal digit is 2, stated in the pinned disclosure. Human operators must be able to submit withdrawal without an AI listener; no speech recognition is started to detect withdrawal. DTMF delivery and accessibility fallback need qualification before live use. Early DTMF 1 before completed disclosure cannot authorize capture; a decline is honored without requiring playback completion. Equal-time or conflicting grant/withdrawal resolves to denial. Disclosure completion proves provider playback delivery, not caller comprehension.

## D. Event sequence and audit evidence

Proposed canonical facts extend the existing event envelope; provider event names are mapped explicitly, never assumed to equal these domain names.

1. Signed ingress is verified, tenant/call/participant resolved, `call.consent_pending` recorded; no content retained.
2. Pin approved disclosure text/audio hashes. Persist playback intent; record `call.disclosure_started` and `call.disclosure_completed` only from correlated evidence.
3. Open a bounded response window. Verify DTMF source/leg/window; append `call.consent_granted` or `call.consent_declined`. The older draft name `call.consent_refused` maps to declined at an explicit compatibility boundary, not a second state.
4. On decline, maintain/establish the allowed human-only bridge. On grant, verify operator consent, topology, per-scope policy and retention; persist `call.recording_start_requested` with command ID and authorization revision.
5. The future adapter may send Telnyx `record_start` only after rechecking authority. Record acknowledgment separately; append domain `call.recording_started` only with qualified effective-boundary evidence. Do not invent a Telnyx started webhook or infer an exact start timestamp from HTTP acceptance.
6. Normal end persists stop intent and evidence. `call.recording_available` is availability only. Admit artifacts only when their entire interval and all participants are authorized; missing or uncertain bounds deny admission.
7. Withdrawal appends `call.consent_withdrawn`, increments authorization revision, closes local admission, cancels queued jobs and invalidates downstream work. Persist stop intents for every active recorder, stream and transcription session; issue cancellation for active AI work. No delayed result may be committed, published or dispatched after revocation.
8. Record each stop request, acknowledgment and effective stop independently. Emit aggregate `call.capture_stopped` only when every active protected service is confirmed stopped. Otherwise record `call.capture_stop_unconfirmed` and reconcile; never report success from a local flag.

| Audit assertion | Required evidence |
|---|---|
| Disclosure played/version | Correlated playback completion, participant/leg, exact text/audio hashes and pinned version |
| Consent response/time | Verified digit or authenticated operator action, scope, source occurrence/receipt/recorded times, presentation reference |
| Recording start timestamp | Effective provider-qualified boundary plus command and consent references; nullable/unknown until proven |
| Recording stop timestamp | Effective provider-qualified stop boundary for each recording; request time is a separate field |
| Withdrawal timestamp | Source occurrence time, local revocation time and receipt time; expose delivery delay |
| Streaming/STT/AI cessation | Each active session's stop/cancel evidence, local admission closure and result-fence evidence |
| Historical reconstruction | Tenant/call/generation, ordered immutable events, policy and disclosure versions, minimized tombstones after content deletion |

Telnyx documents `record_stop`, command deduplication scoped to the call, and an expected `call.recording.saved` webhook. That is not, by itself, proof of an exact effective stop boundary. Provider proof must resolve that gap before activation. [Telnyx recording stop](https://developers.telnyx.com/api-reference/call-commands/recording-stop) (checked 2026-09-24).

## E. Failure, recovery and privacy

“Immediately stop” means no application grace period: locally deny new media/processing at withdrawal acceptance and submit stop/cancel operations without waiting for post-call processing. Remote stopping and already in-flight processing cannot honestly be promised instantaneous. Qualify source-to-receipt delay and receipt-to-confirmed-stop latency before live use; approved limits remain unset and block activation. If a provider cannot meet the required stop/cancellation contract, do not enable it.

| Failure | Required recovery |
|---|---|
| Missing/tampered disclosure, playback interruption or early grant | Deny capture; approved bounded replay or human-only continuation; never infer playback from command success |
| Duplicate, stale or reordered consent | Scoped dedupe and serialized state transition; withdrawal wins; late grants cannot reopen the generation |
| Withdrawal races start | Fence before dispatch; revoke locally; reconcile any start already in flight and send a correlated compensating stop; never rely only on a pre-HTTP DB check |
| DB outage or crash | No new start; close local admission; active remote sessions require a qualified independent stop/watchdog path; on recovery reconcile durable intents before accepting work |
| Remote stop/cancel timeout | Retry only with stable scoped command identity and provider-supported semantics; unknown outcome remains unknown; alert and execute approved capture-path isolation runbook |
| Cannot isolate capture from human bridge | Live topology is unqualified. Preserve human continuity when capture can be isolated; emergency termination is last resort for uncontrolled capture, never the ordinary response to decline |
| Late content/result after withdrawal | Reject content, keep minimal incident metadata; cancel/delete under policy; no further analysis, publication or business effect, even for previously authorized audio |
| Late withdrawal occurrence predates receipt | Reassess affected artifacts against source time; quarantine uncertain intervals and derived results, stop further use; record already-completed effects honestly |
| Worker retry, restored backup or deleted object | Recheck authorization revision, expiry and tombstones on read and write; never resurrect expired/revoked evidence |

Historical authorized capture is not automatically erased by withdrawal, and prior processing cannot be undone. All further processing stops; disposition follows the approved withdrawal/retention policy. Policy must specify TTLs for audio, transcripts, derived facts, disclosure assets, consent evidence, provider copies, traces, exports and backups; deletion propagation, legal-hold authority, restricted access and completion evidence. No arbitrary retention duration or jurisdictional compliance conclusion is asserted here.

Keep exact disclosure assets while referenced audit records require them; retiring an asset prevents new presentation without rewriting history. Immutable means no semantic rewrites, not endless PII retention. Protect phone fields, minimize metadata, use role-scoped masked projections, audit access and delete/redact PII under policy while retaining permitted non-content tombstones. Real content in fixtures, logs, traces or model-training datasets is outside Phase 1.

## F. ADR additions

- **CI-A amendment:** authorization gates all capture/processing; explicit DTMF states; mandatory human continuation after decline; permission intersection does not amend recording restrictions by implication.
- **CI-E proposal:** immutable disclosure and ConsentEvent contract, per-scope authority, playback-to-response evidence and historical reproducibility, extending ADR-0055.
- **CI-F proposal:** withdrawal fences every consumer, separates intent from confirmed cessation, requires provider stop qualification and approved retention/deletion semantics.

See [proposed ADR packet](./conversation-intelligence-adrs.md). Temporary identifiers avoid concurrent ADR-number collisions. Architecture acceptance and a future narrowly scoped recording exception are distinct decisions.

## G. Exact implementation files/modules

These are proposed paths, not implemented modules. Existing #177 foundations must be reconciled first.

| Phase | Files | Responsibility |
|---|---|---|
| 1A | `lib/conversationIntelligence/capture/contracts.ts`, `consent.ts`, `disclosures.ts`, `authorization.ts`, `state.ts`, `service.ts`, `events.ts` | Typed states/scopes, immutable disclosure resolution, permission intersection, serialized transitions, withdrawal and audit contracts |
| 1A | `lib/conversationIntelligence/jobs.ts` | Durable intent, cancellation and authorization revision checks at dispatch/result commit |
| 1A | `lib/data/callConsentEvents.ts`, `callDisclosurePresentations.ts`, `callRecordings.ts`, `callParticipants.ts` | Scoped accessors/projections; reconcile consent accessor naming with adopted foundation |
| 1A | `lib/providers/callCapture/types.ts`, `mock.ts`, `index.ts` | Mock playback/DTMF/bridge/start/stop contracts; synthetic delayed/failed acknowledgments |
| 1A | `app/api/webhooks/telnyx/human-calls/route.ts` | Disabled-by-default isolated ingress with signed synthetic fixtures; never legacy CRM dispatch |
| 1A | `prisma/schema.prisma`, next available `prisma/migrations/<sequence>_conversation_intelligence_consent_capture/migration.sql`, `prisma/seed.ts` | Approved shared entities, tenant-parent constraints, dedupe, projections and synthetic seed; choose actual sequence only after baseline reconciliation |
| 1A | `tests/unit/conversation-intelligence-consent.test.ts`, `conversation-intelligence-capture.test.ts`, `tests/integration/conversation-intelligence-capture.integration.test.ts`, `tests/factories/callConsentEvents.ts`, `callRecordings.ts`, `callParticipants.ts` | State/permission tests, transaction/race/replay tests, cross-tenant denial and no-effect regression |
| 1B, separately authorized | `lib/providers/callCapture/telnyx.ts`, `lib/conversationIntelligence/artifacts.ts` | Real commands, qualified boundaries and private artifact admission; no implementation now |
| Each approved phase | `docs/data-schema.md`, `docs/api-spec.md`, `docs/SECURITY.md`, `docs/architecture/RESPONSEOS_EVENT_SCHEMA.md`, `docs/ROADMAP.md`, `dashboard/dashboard-data.json` | Reconcile implemented contracts and truthful status; changelog on merge |

Reuse `lib/callReview/consent.ts` if the approved shared foundation supplies it; extend a single authoritative consent implementation, not parallel reducers in both namespaces. Phase 2 STT/analysis and Phase 6 streaming consumers must use this same authority and cancellation contract.

## H. Recommended implementation branch

`feat/conversation-intelligence-consent-capture`

Create it only after architecture review and owner acceptance, from then-current `master` containing the human-merged architecture and approved shared foundation. Do not create it now or stack an implementation over an unapproved architecture head. This replaces the earlier `feat/conversation-intelligence-capture-persistence` recommendation.

## I. Exact Phase 1 implementation prompt

Paste into a new Codex repository task only after architecture acceptance and explicit authorization of Phase 1A:

```text
Review/Diagnosis owner: Codex
Actionable AI Assistant Task owner: Codex
Execution location/tool: isolated ResponseOS worktree
Human/operator role: accept architecture and implementation scope; arrange eligible independent review; perform merge
Copy/paste destination: new Codex repo task for C:/dev/responseos

Implement Phase 1A only of Conversation Intelligence consent/capture authorization.
Read AGENTS.md, doctrine, PRD, ROADMAP, DECISIONS, SECURITY, data-schema, api-spec,
conversation-intelligence-review.md, conversation-intelligence-consent.md and the
proposed ADR packet under docs/architecture. Verify accepted decisions and exact
review evidence; this prompt does not ratify proposals or authorize live capture.

Verify repository identity, current master SHA, clean worktree ownership and PR
state. After the approved architecture and shared foundation are human-merged,
create feat/conversation-intelligence-consent-capture from latest master in an
isolated worktree. If #177 or its approved replacement foundation is unavailable,
report the precise dependency; do not duplicate models or cherry-pick other work.

Implement only mock contracts, synthetic persistence and isolated ingress:
- reuse Call, Account and reconciled CallCaptureSession/CallConsentEvent authority;
- implement pending/granted/declined/withdrawn, DTMF 1 grant and 2 decline;
- gate recording, transcription, media streaming and AI analysis before any start;
- store distinct scope permissions, including retention and training/quality use;
- pin immutable disclosure text/audio versions and completed presentation evidence;
- persist every ConsentEvent field required in section B, with tenant isolation;
- allow human-only continuation on decline, silence and playback failure;
- accept active-call DTMF 2 or authenticated operator withdrawal without STT;
- revoke locally, fence queued/in-flight work and late results, persist stop intents
  and distinguish requests, acknowledgments and proven effective stop timestamps;
- implement stable command IDs, serialized revision checks and crash reconciliation;
- keep streaming disabled and training/quality use false in this phase;
- preserve all existing FRL restrictions and recordingEnabled=false runtime policy.

Use the proposed files in section G, reconciling shared names before edits. Use
synthetic signed callbacks and default mock adapters. No real Telnyx HTTP, audio,
STT, AI, storage, CRM, email, SMS, n8n, secrets or deployment/configuration changes.
Human-call ingress must not fall through legacy normalization or CRM dispatch.
Read the installed Next.js guides before route edits. Choose the next migration
sequence only from the actual approved baseline; no fabricated consent backfill.

Test missing disclosure, early/invalid/duplicate/reordered digits, timeout, all
participant grants, decline continuation, withdrawal racing start/result commit,
stale-generation reopening, DB crash, unconfirmed stop, late content, deletion
and expiry, cross-tenant links/reads, and zero external effects. Simulate provider
evidence without claiming that simulation proves live stop guarantees.
Update canonical contracts, roadmap and dashboard. Run lint, typecheck, unit,
build and Postgres 16 integration checks; report unavailable checks honestly.
Open a draft PR; get Claude or CodeRabbit review on the final Codex-authored head.
Record authoring agents, reviewed SHA, outcome and evidence URL. Human merges.
No auto-merge or live provider work. Phase 1B needs separate authority and proof.
Return changed files, validation, remaining gates and next recommended task.
```

### Doctrine §21 applicability

1. Layer: communication authorization and evidence governance.
2. Build deterministic authority; buy carrier execution; defer real integrations.
3. Does not unblock or activate today's live pilot; protects the proposed human-call path.
4. Preserves disclosure, consent and execution evidence.
5. Supports provenance, not proof of recovered revenue.
6. Secondary learning remains opt-in and disabled in Phase 1.
7. Carrier/STT execution is commodity; internal policy ownership is not delegated.
8. Adds no competing CRM, telecom or general workflow engine.
9. Narrow adapter and canonical events limit provider coupling; proof remains provider-specific.
10. Account-scoped composite relations and trusted ingress preserve tenant isolation.
11. Source, receipt and effective times reduce attribution ambiguity without fabricating certainty.
12. DOCUMENTED_ONLY; no compliance, production or integration claims.
13. Requires architecture acceptance, separately scoped recording authority and participant consent.
14. Capture increases privacy exposure; unset retention and stop qualification block live use.
15. Required now to finish this architecture; runtime and realtime hosting remain deferred.

### Validation and handoff

This complete companion is retained intentionally in the forward-fix consolidation
of the architecture packet. It extends ADR-0055 and creates no competing consent
model, event stream, service or authorization ledger. It is Proposed /
DOCUMENTED_ONLY and authorizes neither implementation nor recording.

The earlier working-tree link check did not establish committed-tree completeness:
4b964ac referenced this uncommitted document. That head was not reviewable. The
consolidation must be validated using Git objects at its exact committed SHA,
including this file, before and after normal push. See the main review's recovery
record for provenance, validation scope and continuing implementation gates.
