# Client Operations Portal — Phase 0 PRD

**Status:** Proposed planning baseline / DOCUMENTED_ONLY. Phase 0 documentation authoring is authorized; runtime implementation is not.
**Owner:** Audio / AJ Digital LLC. **Authoring agent:** Codex. **Date:** 2026-09-15.
**Evidence baseline:** `724a3e5bb221ccbb7ab9a6f8e64a29ed06174746`; [architecture review](./responseos-client-operations-portal-architecture-review.md).
**Governing references:** [DECISIONS](../DECISIONS.md), especially ADR-0002, ADR-0033, ADR-0039, ADR-0050, ADR-0051 and proposed ADR-0059/0060; [platform doctrine](../strategy/responseos-platform-doctrine-v1.md); [SECURITY](../SECURITY.md).

## 1. Problem and desired outcome

A client owner needs to understand what ResponseOS observed or did, what requires attention and what outcome evidence exists. The current client pages expose separate record lists and stored revenue summaries but do not provide that daily operational view. Requiring a client to inspect CRM, email, text and multiple record lists increases review effort.

Evolve the existing client surface into a tenant-facing presentation and interpretation layer. ResponseOS remains the operational/system-of-engagement layer as architectural intent; external CRMs retain designated commercial authority. This is not a CRM replacement or a claim of currently proven generalized provider independence.

Primary users are `client_admin` and `client_viewer`. Operators retain their existing separate console; any future client preview must select an explicitly authorized tenant on the server and never default to a cross-tenant aggregate.

Success for Phase 0 means reviewers can identify current vs proposed behavior, decide boundaries, and evaluate the smallest implementation without guessing data ownership or permission. Product-value success later means a client can identify a next review item and inspect its evidence from one tenant surface; baseline and target review-time measurements remain to be agreed before pilot evaluation.

## 2. Invariants and constraints

1. ResponseOS owns its operational observations, actions and evidence; generalized provider independence remains intent until proven.
2. The portal interprets canonical data; it does not become a second CRM.
3. External commercial authority is explicit by domain/field, with no global last-write-wins.
4. Zero external CRM is a valid operating mode.
5. Rendering performs zero external CRM requests, including status/health calls.
6. Phase 1 uses logical/request-time reads. Persistent projections and their infrastructure are excluded; measured need requires a separately approved scope amendment.
7. `LeadEvent`, `WebhookEvent` and the current ledger substrate are not a complete immutable event-sourcing/replay system.
8. Current `RevenueMetrics` are not continuously reconciled ROI.
9. CRM operation success is distinct from independently verified external or commercial outcome.
10. Attention is an operational exception/decision surface, not a sales pipeline.
11. Presentation never duplicates operating configuration governed by ADR-0051.
12. Portal tenant identity always derives from authenticated server context. Browser IDs, hostnames, agent arguments and provider payloads cannot select its tenant authority.
13. Client disclosure is narrower than internal accessors. No raw transcripts, recordings, webhook bodies, secrets, ciphertext or unrestricted provider information in Phase 1.

All phases preserve existing v0.3, provider, credential, deployment and human merge gates. No schema, code, route, environment or external-system change is authorized by this PRD or its acceptance.

## 3. Scope and non-goals

### Phase 1 candidate scope — future, separately authorized

- Tenant/account identity using existing canonical fields and product styling.
- Daily operational summary with declared metric definitions.
- Bounded chronological activity feed of supported canonical records.
- Deterministic read-only attention candidates.
- Safe call/lead detail.
- Explicit observation window/timezone and evidence/provenance references.
- Completeness and data-mode indicators; distinct empty/incomplete/unavailable states.
- Operation with zero CRM connections and zero provider requests on reads.

Phase 1 adds no acknowledgment, snooze, assignment, callback execution, CRM retry, booking, quote mutation, AI-generated briefing, durable branding configuration or ROI-verification capability. Transcript/recording access stays excluded pending an approved disclosure policy and separately scoped work.

### Non-goals

Full pipeline configuration, arbitrary custom objects, contact-database administration, campaigns, marketing automation, sales sequences, generic workflow builders, FSM/dispatch, billing, new CRM adapters, autonomous CRM mutations, custom domains, branding uploads, generalized RAG, persistent projections, new event infrastructure and new acceptance criteria for the Mike demo.

## 4. Phase 1 read contracts

These are conceptual contracts, not implemented types, endpoints or schema. Prefer purpose-built server-only queries returning selected fields over exposing broad accessors. Bounded query caps, p95 latency target and fixture sizes must be recorded in the implementation brief before coding; this PRD does not invent measured capacity.

### Shared response semantics

| Field/concept | Required meaning |
|---|---|
| Tenant identity | Server-resolved account ID/name; never trust a request-selected tenant |
| Window | Half-open `[start, end)` instants plus IANA account timezone; local-day boundaries converted consistently, including DST |
| Observation | `observedAt`; when records were read, not a claim all upstream events have arrived |
| Data mode | Explicit fixture/mock vs persisted record provenance; persisted does not mean live-verified. Mixed or unknown provenance is disclosed, never coerced into live |
| Completeness | Complete for the stated query scope, incomplete enrichment, or unknown upstream coverage; do not label global completeness without evidence |
| Evidence | Canonical source type/ID, relevant event/observation time and permitted provenance; links reauthorize access |
| Pagination | Bounded page size; stable ordering and continuation cursor bound to tenant, filters and window |
| Failure | Distinct unavailable reason safe for the client; internal error/provider details omitted |

Empty means a successful bounded read found no records. Incomplete means some facts or enrichment are missing/in progress. Unavailable means the read could not be completed. A failed read cannot become an empty array, zero total or fixture success. Partial section failure leaves unaffected sections visible with their own state; no overall success label that masks the failed section.

### Daily summary

Count canonical calls once by canonical call ID within the declared window. Do not count webhook deliveries as calls. Define each included count and denominator before implementation; avoid overlapping lead events inflating opportunities. Qualification counts must declare whether their window follows the originating interaction or qualification observation. Distinguish completed call from completed qualification and requested appointment from confirmed booking.

No estimated/verified recovered revenue, ROI percentage or agent-performance percentage is required by this slice. Existing metric records do not justify new attribution claims.

### Activity feed

Start with supported call and lead observations; add other canonical types only when their timestamp/status semantics and disclosure are specified. Use event/observation time consistently with stable source-type/ID tie-breakers. Label record snapshots as such: a mutable row cannot supply an invented historical status transition. Correlate related call/lead records so duplicate source representations do not imply separate customer opportunities. Cursor pagination must not silently skip ties; describe late arrivals and refresh semantics without promising a frozen global stream.

### Read-only attention candidates

Candidate shape: stable tenant-scoped source identity, rule ID/version, reason, priority, observed/due times when known, evidence references and a view-detail action. Initial rules may identify explicit `follow_up_needed` evidence and high urgency on eligible nonterminal leads, after product approval of the precise predicates. Terminal status handling and conflicting qualification data must be specified in tests.

Do not infer callback intent from generic follow-up, commercial value from urgency, missed quote activity from absent CRM data, or completed work from elapsed time. Multiple rules may be grouped under one source with separate reasons; there are no persistent acknowledgments or deduplication tables in Phase 1. Rules and definitions are versioned in the future implementation, not editable through portal configuration.

### Safe call/lead detail

Allow only approved identifiers, times, operational status, qualification fields, provenance and explicitly reviewed/redacted summary content. A summary field is not inherently safe. If a content field lacks approved disclosure treatment, omit it and explain its unavailability. No raw transcript, recording URL, webhook body, encrypted credential, provider response, token or secret reference may pass through this contract.

Qualification must resolve through a lead proven to belong to the session tenant. Related contacts/calls must also satisfy tenant constraints. Detail links and cursors do not bypass authorization. Do not generalize the fixed-account public-demo reader to client data.

## 5. Query strategy and acceptance examples

Compute logical views at request time using bounded, selected-field reads and batched joins. Reuse tenant-scope patterns while narrowing broad accessors; direct database access belongs only in the server read boundary. Phase 1 requires no new database table or migration. If implementation discovers a schema prerequisite, stop and return an exact proposal rather than adding it implicitly.

A consistent read snapshot can stabilize related queries but cannot fix incomplete sequential normalization. Prefer existing processing/completeness evidence; where no trustworthy relation exists, show unknown instead of synthesizing a completion flag. Begin without shared caching of sensitive responses; any later cache must include tenant and authorization/disclosure context and handle revocation.

Acceptance scenarios:

1. Two tenants have overlapping record IDs supplied through malicious filters/links: neither client role sees the other tenant's content, counts or evidence.
2. Missing session or missing tenant context fails closed; no development-account or fixture fallback occurs in authenticated hosted behavior.
3. No CRM connection exists: authorized operational reads succeed and no provider is constructed or called.
4. A mocked CRM operation says `succeeded`: it is never labeled as live HubSpot delivery or commercial success.
5. A database section fails: that section is unavailable, not empty/zero; no fake replacement content appears.
6. A call exists before its enrichment: its detail shows incomplete/unknown enrichment, not an invented disqualification.
7. Duplicate source deliveries do not inflate call totals; identical timestamps paginate deterministically.
8. A tenant day crosses DST: the declared window and results agree.
9. A broad internal record includes transcript/provider fields: the client projection excludes them; evidence URLs reauthorize.
10. A request is repeated across tenants or after a role change: no cached disclosure survives outside its permitted scope.
11. Attention rules provide evidence-backed reasons, suppress documented terminal states and do not create mutations.
12. Query plans, fixture volume, page cap and measured p95 meet the implementation brief's agreed budget; no unbounded list hydration or N+1 qualification queries.

## 6. Presentation ownership

ADR-0060 proposes a narrow presentation boundary. Phase 1 uses existing `Account` identity and shared styling, so durable tenant presentation storage is not a dependency.

Before any durable presentation implementation, decide its exact storage home, version/approval provenance, asset validation, allowed theme values, fallback behavior and read/write permissions through an ADR amendment or separate decision. Possible logo/display/navigation fields cannot become a general settings object. Account identity remains on `Account`; hours, service areas, escalation paths and consent remain approved snapshot facts under ADR-0051. Feature visibility is derived from implemented capability and authorization, never a permission grant. Presentation cannot widen execution policy or override capability authority.

## 7. CRM and zero-CRM contract

No portal read imports or constructs a CRM provider. Later client-safe status queries use canonical operation state and safe connection metadata, not the demo operator endpoint. They must distinguish not connected, mock, unavailable, pending, failed/review, operation succeeded and independently verified external state. Missing evidence stays unknown.

CRM-1 resolution is a separately gated dependency for multi-tenant live CRM functionality, not for Phase 1. `ProviderConnection` remains the durable credential authority; no second credential store is proposed. Preserve current cardinality until a later explicit decision changes it. No Salesforce/GHL adapter support is claimed.

For CRM-less clients, preserve core authorized operation and canonical IDs. Establish the client's commercial source of truth during onboarding. HubSpot remains the client-overridable architectural default when an external CRM is introduced; provisioning, identity verification, credentials, mapping and activation require separate authorization. Deliberate standalone mode creates no fake connection or failed-sync backlog.

## 8. Later attention, briefing, outcomes and projections

- Durable attention requires its own lifecycle/authority decision: open/acknowledged/snoozed/resolved/dismissed semantics, actor/reason, expected-version concurrency, recurrence and resolution evidence. A resolved queue item does not silently change CRM stage or callback completion.
- Briefings begin with deterministic facts and links, then optional separately approved language generation. Define eligibility denominators and unknowns for performance rates. Scheduled delivery is separate work.
- Outcome reporting requires approved provenance, state definitions, reconciliation, correction/dispute and verification contracts. ADR-0042 remains proposed; do not represent its richer states as shipped or equate booked work with collected cash. Existing estimated/verified columns alone are insufficient.
- Durable projections require measured need and a separate approved design for dispatch/outbox, idempotency, cursors, lag, replay/rebuild, retention and recovery. They are not a prerequisite or implicit follow-up to Phase 1.

## 9. Phases and gates

Phase numbers here are portal-specific, not the platform doctrine's strategic phases or CRM-1's subphases. No milestone or deadline is promised.

| Phase | Candidate scope | Acceptance / authorization gate |
|---|---|---|
| 0 — Documentation | Review, PRD, proposed ADRs, narrow canonical links and progress tracking | Static checks; explicit ownership/status; independent current-change review; owner architecture decision; human merge |
| 1 — Read-only slice | Identity, summary, feed, candidates, safe detail, window/provenance/completeness and zero CRM | Separate implementation authorization; approved disclosure/query contracts; acceptance scenarios in §5; required repo validation and independent review |
| 2 — Attention actions | Durable acknowledgment/snooze/resolution | Separate lifecycle/schema/action authority; concurrency, recurrence, audit and rollback validation |
| 3 — Presentation and briefing | Narrow approved presentation and deterministic summaries | Presentation storage ADR; access/asset/accessibility controls; counts reconcile to source detail |
| 4 — CRM status / integration | Safe client status; separately approved CRM-1 and later runtime work | Tenant/connection identity, capability and credentials gates; outage/retry evidence; no mock/live ambiguity |
| 5 — Outcomes / optional projections | Evidence-based reporting; durable read models only if measured need | Provenance/dispute doctrine; manual reconciliation evidence; projection rebuild/lag/recovery/retention gates when applicable |

CRM and portal tracks retain their own dependencies. Read-only portal operation does not require completion of CRM-1. Phases 3–5 are candidate sequencing, not authorization to expand Phase 1.

Implementation PRs retain local and CI lint, typecheck, unit tests, build and Postgres integration gates. Phase 0 uses documentation/static checks; passing those is not a claim that runtime validation or independent review has passed. Codex-authored changes require Claude or CodeRabbit review covering the current changes, with blocking findings resolved. Record reviewed head, reviewer system and evidence; human merge remains mandatory. No agent auto-merge or deployment is authorized.

## 10. Risks, open questions and stop conditions

| Open decision | Required before | Owner |
|---|---|---|
| Which summary/qualification fields are safe for each client role; retention and redaction behavior? | Phase 1 coding | Product/security owner |
| Exact count windows, attention predicates, page cap, fixture volume and latency target? | Phase 1 coding | Product/engineering owner |
| Durable presentation storage/approval and asset policy? | Durable presentation implementation | Architecture owner |
| Attention lifecycle authority and recurrence; what constitutes resolution evidence? | Any queue write | Operations/product owner |
| Tenant-scoped CRM identity/capability and production key posture? | Multi-tenant live CRM | Integration/security owner under CRM gates |
| Revenue evidence, attribution, correction and dispute definitions? | Expanded outcome/ROI claims | Product/commercial owner |
| What materially changed when the Mike demo closes? | Final reconciliation before implementation | Architecture owner; focused delta review only |

No question above blocks documentation authoring. Missing Phase 1 disclosure/query decisions block coding, not this review. Stop an implementation proposal if it needs new persistent projections, schema, provider resolution or broad settings authority without separate approval.

## 11. Phase 0 delivery and review gate

This package creates this PRD and its evidence review, adds proposed ADR-0059/0060, and narrowly updates PRD, roadmap, architecture, security, changelog and the engineering progress board. It changes no runtime or provider configuration. Architecture authoring proceeds now; Mike-demo closure triggers only a focused delta reconciliation.

Review the eventual diff for accepted-ADR conflicts, accidental authorization, source-status overclaims, ADR-0051 duplication, ambiguous commercial ownership, replay/ROI overclaims, unsupported adapter claims and demo leakage. Static checks must verify local links, unique ADR/task identifiers, JSON shape, untouched generated dashboard fields and the authorized file allowlist. Independent review is pending until evidence is recorded; author self-checks do not satisfy it. Stop at that review gate and do not begin implementation.
