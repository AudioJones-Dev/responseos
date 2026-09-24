# Conversation Intelligence — proposed ADR packet

Status: **Proposed / DOCUMENTED_ONLY**. Author: Codex. Date: 2026-09-24.
Companion: [architecture review](./conversation-intelligence-review.md).
No decision in this packet is ratified. Numbered ADR IDs will be assigned after reconciling concurrent branches; CI-A through CI-D are draft identifiers, not new canonical numbering.

## CI-A — Human-call capture requires a scoped recording authorization

### Context

ADR-0051 and execution policy keep recording disabled at every tier. ADR-0047 excludes recording and outbound dialing from the existing demo; ADR-0048 preserves a recording-off prospect posture. ADR-0055 defines artifact-specific immutable consent authority. The open #177 implementation provides related capture machinery but still does not authorize recording.

ADR-0055 is already accepted on master at 724a3e5; it is not waiting for #177
to establish authority. PR #177 at c851940 carries a call-specific implementation.
Conversation Intelligence consumes and extends that one canonical consent stream;
it MUST NOT create a second ConsentEvent model, stream or authorization service.
The review's [consent reconciliation](./conversation-intelligence-review.md#consent-reconciliation--adr-0055)
maps authority fields, capture evidence, disclosures and withdrawal enforcement.

The requested human-call topology includes dialing an operator leg. Classifying the inbound business interaction does not eliminate that outbound provider operation.

### Proposed decision

Introduce a separately assigned human-call-capture capability. Do not change recordingEnabled globally or add recording to every supervised tenant. The capability intersects tenant execution policy, explicit operator authorization, participant consent and provider-evidence qualification.

A future ratified amendment would allow only the named isolated environment/account/number and server-allowlisted operator bridge destination. Existing prospect, FRL and AI-receptionist paths remain recording-off unless separately amended. Consent for recording, transcript processing and secondary evaluation use remains independently represented.

The state machine requires completed disclosure, deterministic affirmative response and operator-leg acknowledgment before recording. No speech recognition to obtain pre-consent agreement. Admission is bound to a capture generation and proven source interval. Refusal/timeout denies capture. Participant changes suspend it. Withdrawal closes local admission first and requires remote stop confirmation or the approved fail-safe termination path.

Phase 1A models these controls with synthetic inputs and mock commands. Phase 1B may only follow a ratified exception, retention policy, exact-head validation and separately authorized provider qualification.

### Alternatives and consequences

A global recording toggle is smaller but would widen unrelated tenants' authority and conflict with ratified policy. Reusing the existing demo route risks its legacy CRM dispatch and content-retention behavior. A dedicated ingress and bounded capability require explicit routing and shared-foundation reconciliation but make the authority boundary auditable.

A no-recording metadata-only capability is a safe fallback while legal/provider evidence is incomplete; it cannot supply the requested recorded-call dataset.

### Acceptance evidence before live use

- All-participant and artifact-specific consent tests, including ties, withdrawal and transfer.
- Bound provider command intent/acknowledgment and effective capture interval evidence.
- Two-party channel mapping and recording topology demonstrated with consenting internal participants.
- Retention/deletion across provider and local copies, and safe unrecorded fallback.
- No reachability from capture to existing CRM/email/quote dispatch.
- Explicit amendment applicability and operator authorization, not an assumed inheritance from SUPERVISED_PILOT.

### Amendments required if accepted

ADR-0051's prohibition gets only the named capability exception; ADR-0047/0048 exclusions remain unchanged for their existing paths. Reconcile ADR-0057 from #177 when merged; assistant/transcript boundary evidence is not automatically recording evidence. Update roadmap/security/contracts alongside the approved implementation slice.

## CI-B — Evidence revisions are authoritative; transcripts and human labels have different status

### Context

CallTranscript is unique per call and CallSegment per call/sequence. They are useful projections but cannot express immutable analysis lineage. #177 introduces CallTranscriptRevision, CallPostCallAnalysis and review models; building a second competing version graph would create ambiguity.

### Proposed decision

Reuse Call identity and reconcile the #177 versioned substrate. Add Recording and participant/channel evidence; retain original authorized source hashes. New transcript and extraction results create immutable revisions. Existing text fields remain compatibility projections and are never treated as proof of consent.

A canonical post-call revision is the selected complete processing result, not guaranteed truth. Human correction preserves the original prediction and reviewer provenance; only adjudicated labels become evaluation reference labels. A corrected revision invalidates unexecuted approvals and never silently edits completed effects.

Store facts, intents and commitments in schema-validated extraction JSON initially. Introduce query tables only for demonstrated needs. Account, source hashes, model/prompt/schema versions and lifecycle states are server-owned, outside model output.

Raw objects remain private under R2's architectural direction; Postgres owns metadata, lineage, retention and access authority. Signed access URLs are transient delivery artifacts. No direct Telnyx-to-R2 integration is assumed.

### Alternatives and consequences

Overwriting Call.transcript is simpler but loses reproducibility and review binding. A fully normalized fifteen-table ontology adds joins and migrations before query requirements exist. Versioned JSON plus explicit evidence identities preserves replay and allows later projections.

Deletion must propagate through derived revisions and evaluation exports. Append-only does not mean indefinite retention of PII; tombstones preserve minimal audit semantics after authorized content deletion.

### Acceptance evidence

Cross-tenant parent-link rejection; revision/hash determinism; no fabricated consent backfill; invalid evidence references rejected; projection compatibility; deletion cancels jobs and prevents replay resurrection; datasets partition entire call families.

### Amendments required if accepted

Extend ADR-0034/0055 and data-schema/event contracts. Reconcile #177 model names and dependencies before migration. v0.4 knowledge/RAG and cross-client benchmark gates stay unchanged.

ConsentEvent in this packet is the ADR-0055 domain concept, not a proposed new
table. CallConsentEvent is #177's call-specific implementation name. Retain its
identity and extend the shared contract after foundation reconciliation; do not
dual-write into a Conversation Intelligence consent ledger. Consent-related
CallEvidenceEvent notifications carry only canonical event references and cannot
grant or revoke permission independently. Per-contact state and capture admission
are derived projections, never competing consent authority.

## CI-C — Deterministic policy owns action authority; adapters own bounded execution

### Context

ADR-0017 places core orchestration in code and n8n downstream. ADR-0050 defines governed CRM mutation intent as a target, while CrmSyncOperation implements a bounded existing seam. Capability descriptors under ADR-0058 are not a general workflow engine. The n8n inbound route is currently an unauthenticated acknowledgment stub.

### Proposed decision

Models return observations only. Deterministic versioned policy derives candidates. The operator approves a specific candidate, source revision, payload hash, destination and policy decision. Revalidate approval and policy immediately before durable dispatch.

WorkflowAction owns authorization and frozen effect identity. WorkflowRun represents execution summary; per-effect attempts preserve generation and pre-effect intent. Existing CrmSyncOperation remains authoritative for its bounded effects; do not create competing status owners for the same HTTP operation.

n8n receives only a signed/authenticated authorized envelope, executes the permitted action and reports a correlated authenticated receipt. It does not decide taxonomy, policy, authorization or whether a failed CREATE should be retried. Content in a call cannot create an instruction or execution right.

Possible external effects with unknown outcomes go to reconciliation. A lease timeout or empty provider search does not prove absence. Do not promise exactly-once delivery. Completed provider acceptance and verified business outcome are separate facts.

Phase 4 recommends/simulates only. Phase 5 enables named action classes individually after approval and evaluation; no blanket "high confidence" automation.

### Alternatives and consequences

Letting an LLM or n8n workflow infer and dispatch in one step is operationally convenient but obscures evidence, authorization and recovery. The proposed separation adds a durable approval/intent boundary and operator reconciliation burden in exchange for bounded effects.

Binding quotes, customer messages, CRM writes and service commitments remain separately authorized actions; drafting is not permission to send.

### Acceptance evidence

Tests for stale/revoked approval, changed destination, corrected source, duplicate callback, attempt-generation races, timeout after effect, and unauthorized effects from prompt injection. Test policy independently from models. Preserve existing qualification-origin prohibitions when adopting #177.

### Amendments required if accepted

Clarify ADR-0017/0050/0058 without broadening current CRM/provider scope. Add action-specific event schemas and authenticated execution receipt contracts only in the phase that implements them.

## CI-D — Realtime gateway hosting is deferred pending workload evidence

### Context

ADR-0013/0014/0030 describe a dedicated Node gateway, Redis session state and realtime-state boundary. Durable Objects are a plausible later session coordinator; current Vercel WebSocket support also changes the available options. Neither observation selects a host for this project.

### Proposed decision

Post-call capture/intelligence does not depend on a realtime gateway. Defer the host decision until Phase 6. Evaluate Durable Objects as the preferred experimental candidate against the existing Node gateway baseline and Vercel's current bounded WebSocket runtime.

Measure call duration, reconnect/gap behavior, concurrent calls, frame rate, memory, STT uplink lifecycle, withdrawal-stop latency, regional processing constraints and cost per call. Do not assume hibernation savings during continuous outbound STT traffic.

One logical session is keyed by environment/account/capture generation, with durable evidence in the existing backend. Gateway state is provisional and cannot own business authority. Native audio transcoding/file processing may require a separate worker.

### Alternatives and consequences

Selecting a new host now adds configuration and operational cost before realtime value is established. Retaining the Node baseline without reevaluation may overlook useful coordination primitives. A later proof separates those questions from Phase 1 safety and persistence.

### Acceptance evidence and amendment

If a non-Node design is selected, a ratified successor must explicitly amend ADR-0013/0014/0030, including Redis state ownership, with runtime/region/cost/retention constraints and failure/recovery evidence. This draft changes no host, domain, DNS, credential or deployment configuration.

## Operator decision record — unfilled

| Decision | State |
|---|---|
| CI-A scope and recording exception | Proposed; not granted |
| CI-B evidence and privacy contract | Proposed |
| CI-C future effect authority | Proposed; external execution remains blocked |
| CI-D host evaluation | Deferred; no infrastructure selected |
| #177 dependency/reconciliation approach | Awaiting explicit implementation baseline |
| Retention, deletion and secondary-use policy | Unset; blocks live capture |
| Exact Phase 1A implementation scope | Defined in review Q; not started |
| Independent reviewer/current head/evidence URL | Pending |
