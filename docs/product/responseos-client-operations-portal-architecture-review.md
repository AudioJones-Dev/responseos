# Client Operations Portal — architecture review

**Status:** DOCUMENTED_ONLY — review baseline; target recommendations are proposed, not implemented or ratified.
**Authoring agent:** Codex. **Owner:** Audio / AJ Digital LLC.
**Reviewed baseline:** `724a3e5bb221ccbb7ab9a6f8e64a29ed06174746` on remote `master`, verified again on 2026-09-15.
**Worktree:** `C:\dev\responseos-client-portal-architecture` on `docs/client-operations-portal-architecture`.
**Companion:** [Portal PRD](./responseos-client-operations-portal-prd.md).

## 1. Decision and authority

Evolve the existing client surface into a tenant-facing interpretation of ResponseOS operational records. Preserve ResponseOS as the provider-independent operational/system-of-engagement layer **as architectural intent**; generalized production provider independence is not proven. External CRMs retain authority only over explicitly designated commercial domains and fields. The portal is not another CRM.

The owner authorized Phase 0 documentation authoring after this review. That authorization permits no runtime implementation, schema, migration, API, provider, credential, environment, deployment, CRM configuration, or external mutation. Approval of these documents does not authorize Phase 1 or change any v0.3 gate.

The proposed portal ADRs are ADR-0059 and ADR-0060 in [DECISIONS](../DECISIONS.md). Registry numbering was checked against the baseline before allocation; recheck for concurrent allocations before committing. ADR-0050 is accepted doctrine; [CRM-1](./responseos-crm-1-connection-registry-prd.md) remains proposed planning. Existing statuses in the decision registry remain authoritative, including proposed ADR-0042 and ADR-0043.

## 2. Evidence limits and parallel work

This is a source review, not production certification. Existing test definitions were inspected, not executed for this review. No provider availability, tenant data, deployment, credential, or commercial outcome was verified.

The separately checkpointed Mike demo was at `e89faf1c800854f4da396d9e7e9559532a27caee`. It is not the architecture baseline or a dependency for authoring. No demo change is imported here. After demo closure, compare its reconciled changes with this baseline and record only material deltas to canonical records, disclosure, ownership, attention evidence, or phase gates. Do not restart the full review or promote demo exceptions into platform policy.

## 3. Current-state architecture and capability matrix

Status describes the reviewed code, not production operation. Source links are relative to this checkout; the baseline SHA binds the findings.

| Area | Source-proven state | Missing / planned | Reuse decision |
|---|---|---|---|
| Client surface | Existing [client routes](../../app/(client)/client/dashboard/page.tsx): dashboard, calls, leads, appointments, quotes, revenue, reports, settings | Unified daily cockpit; reports/settings are placeholders | Evolve the existing route group |
| Tenant identity | [Account/User](../../prisma/schema.prisma), [server session](../../lib/auth/session.ts), [tenant helpers](../../lib/data/session-helpers.ts) | Portal action/disclosure contract | Preserve identity and role substrate |
| Operational records | `Contact`, `Call`, `LeadEvent`, `LeadQualification`, `Appointment`, `QuoteRequest` | General task/opportunity and explicit evaluation lifecycles | Reuse existing meanings; do not invent records from labels |
| Ledger evidence | `WebhookEvent` with dedupe/signature/process metadata; `AuditLog` | Universal immutable normalized event stream and complete replay guarantees | Preserve foundation without claiming full event sourcing |
| Call ingest | [Signed Telnyx route](../../app/api/webhooks/telnyx/calls/route.ts) and [normalizer](../../lib/providers/telnyx/normalize.ts) persist bounded post-call records | General channel capture; atomic multi-record normalization | Consume canonical output; disclose incomplete enrichment |
| Communications/workflows | Conversation, SMS, notification, workflow-run and QA models/accessors | Complete live pipelines and capability-version outcome lineage | Model existence is not delivery evidence |
| CRM operations | [Call-sync orchestration](../../lib/crm/syncFinalizedCall.ts): durable states, atomic claims, persisted provider IDs, operator retries and ambiguity review | Generic operations, connection-scoped routing, autonomous recovery and inbound reconciliation | Preserve narrow semantics |
| CRM adapters | [Provider types](../../lib/providers/crm/types.ts) contain exactly `mock` and `hubspot`; [factory](../../lib/providers/crm/index.ts) is process-global and flag/token gated | CRM-1 registry/resolution; Salesforce/GHL adapters | PARTIALLY_SHIPPED seam, not generalized integration |
| Connections | [Safe connection reads](../../lib/data/providerConnections.ts) exclude encrypted credential fields; one row per account/provider | General connection verification/provisioning | Preserve `ProviderConnection` authority |
| Reporting | [Stored metric reads](../../lib/data/revenueMetrics.ts), [estimate calculator](../../lib/revenue/calculateRecoveredRevenue.ts), customer rollup exclusions | Continuous recomputation, detailed attribution/correction chain | PARTIALLY_SHIPPED; not continuously reconciled ROI |
| Attention | Lead urgency/status/follow-up evidence and CRM operation states | Unified queue, ownership, acknowledgment and resolution history | New bounded interpretation capability |
| Briefings | [Illustrative demo briefing](../../app/(demo)/_data/getWalkthroughScenario.ts) | Tenant briefing generation and reproducible historical reports | Do not reuse demo assumptions as client truth |
| Presentation | Account name/slug/timezone and shared client shell | Durable logo/theme/navigation contract | New narrow presentation decision |

### Material implementation qualifications

- `LeadEvent` has mutable status, notes and `updated_at`; it is not an immutable transition history.
- `WebhookEvent` preserves inbound evidence but includes processing and payload-retention lifecycle. Its existence does not establish replay of all canonical effects.
- `LeadQualification` has no `account_id`. The [accessor](../../lib/data/leadQualifications.ts) checks tenant ownership through its parent lead. New joins must preserve that boundary.
- The Telnyx normalizer performs sequential writes. A database snapshot can contain a call whose qualification has not yet been written. Transactional read consistency does not mean semantic completion.
- The reviewed runtime contains metric reads; writes found in seed/demo setup do not establish a continuous reporting pipeline.
- The [CRM list endpoint](../../app/api/admin/crm-sync-operations/route.ts) selects the configured demo account, while its service requires operator roles. It is not a tenant-facing status API.
- [Call accessors](../../lib/data/calls.ts) expose broad transcript/recording fields. The [transcript accessor](../../lib/data/callTranscripts.ts) excludes storage pointers but includes inline text. Neither is an approved client disclosure contract.
- Several client pages use development account fallbacks and collapse read errors into empty states. Reuse the surface, not those semantics.

Existing [tenant matrix tests](../../tests/integration/data-tenant-matrix.integration.test.ts), [CRM integration tests](../../tests/integration/crm-sync.integration.test.ts) and [claim tests](../../tests/unit/crm-sync-claim.test.ts) are relevant validation precedents. Their presence is not a fresh passing result or proof of untested portal behavior.

## 4. Target architecture and bounded contexts

```text
Authorized channel -> verified ingestion/evidence -> canonical operational records
                                                        |
                           +----------------------------+-------------------+
                           |                                                |
                  tenant-scoped read services                    governed CRM orchestration
                  + deterministic attention                     -> connection/capabilities
                           |                                    -> authorized adapter
                  Client Operations Portal                      -> external CRM
                           |
                  later evidence-linked briefing

Future inbound CRM changes -> verified ingestion -> identity/authority reconciliation
                           -> approved canonical change or review
```

| Context | Owns | Does not own |
|---|---|---|
| Canonical operational domain | ResponseOS actions, observations, evidence and current operational records | Every external commercial fact |
| Portal read services | Safe summaries, bounded feed, detail, completeness and provenance | Provider construction or mutation |
| Presentation | Approved display label, theme/logo references, navigation preferences | Tenant identity, authorization, hours, escalation or consent policy |
| Attention | Explained operational exceptions/decisions | Sales pipeline or implicit CRM task lifecycle |
| Briefing | Evidence-linked interpretation of a specified window | Financial verification or autonomous actions |
| CRM orchestration/adapters | Governed translation and synchronization | Client rendering or authority inferred from HTTP success |

The repository [engineering dashboard](../../dashboard/README.md) tracks build progress. It is not the runtime client portal or a source of client operational data.

## 5. Data ownership and source of truth

| Data | Authority | Portal rule |
|---|---|---|
| Account identity/timezone | `Account` | Use authenticated account context |
| Access | Server session, role and applicable policy | A logo, slug or hidden navigation item grants no access |
| ResponseOS actions/observations | Canonical records with ledger/audit evidence where present | Link evidence; distinguish recorded state from verified outcome |
| Contact observations | ResponseOS canonical contact; external fields under explicit ownership | Preserve canonical identity; do not globally prefer either system |
| Commercial stage, owner, external quote | Explicitly designated commercial source | Show source, observation time and unknown/stale status |
| Appointment | Canonical request/state plus authorized scheduling confirmation | Requested, scheduled and completed remain distinct |
| CRM operation | `CrmSyncOperation`; later independent readback | `succeeded` is not verified commercial outcome |
| Credentials | `ProviderConnection` under existing encryption controls | No secret, ciphertext or credential locator in portal output |
| Operating configuration | Approved memory snapshot under ADR-0051 | No duplicate `TenantSettings`/`ClientConfig` authority |
| Presentation | Proposed contract under ADR-0060 | Durable storage remains undecided and gated |
| Attention disposition | Future ResponseOS action history | Acknowledgment does not complete a callback or commercial transaction |
| Revenue | Evidence plus explicit attribution/verification policy | Stored totals alone cannot prove recovery or collection |

ADR-0050 prohibits global last-write-wins. External provider IDs are mapping evidence, never replacement canonical IDs. Conflicting identity or authority goes to review.

## 6. Read-model recommendation

Use logical/request-time read models over existing canonical records for Phase 1. Selected fields, bounded queries, batched joins and stable pagination are sufficient starting mechanisms. Portal rendering makes zero external CRM requests, including health checks or provider readback.

Responses identify observation window, account timezone, generation time, provenance, data mode and completeness. Avoid unconditional claims that every interaction has a corresponding workflow run or immutable history. Details belong in the [PRD contracts](./responseos-client-operations-portal-prd.md#4-phase-1-read-contracts).

Use a consistent database snapshot where needed for related counts, while separately exposing in-progress normalization. An observed timestamp is not a universal ingestion watermark. Sorting a bounded feed does not establish causal ordering across providers.

Persistent projections, background workers, queues, checkpoints, streaming and a new event infrastructure are excluded from Phase 1. Measured requirements may justify a later scope amendment; they do not silently unlock those components. The later design must define projection version, durable dispatch, checkpointing, idempotency, lag, rebuild parity, retention/deletion propagation and recovery. Raw webhook expiry means full historical reconstruction cannot be assumed.

Tradeoff: request-time reads incur database work; materialized projections incur operational machinery and eventual consistency. Revisit only against measured query budgets or a demonstrated historical-snapshot requirement.

## 7. Attention and briefing

Initial attention candidates are deterministic read-only interpretations of explicit source fields. A follow-up event is not necessarily a callback; urgency is not monetary value; an evaluation request is not a booked evaluation. Missing CRM information is not evidence of a missing quote. Rules require evidence and explain their reason.

Later durable attention state needs actor/reason, expected-version concurrency checks, deduplication, recurrence, snooze and resolution evidence. It must not silently mutate commercial state or duplicate CRM tasks. These require a separate authority/schema decision.

Briefings begin later with deterministic counts, attention and known outcomes. Every statement needs a source window and evidence links. Agent-performance percentages require defined denominators, exclusions and explicit unknowns; missing escalation evidence cannot prove no escalation. An optional later language model may phrase approved facts but cannot establish numbers, authority or actions. Delivery by email/text is separately authorized work.

## 8. CRM interaction and zero-CRM operation

Preserve CRM-1's proposed resolution path: authenticated server context -> safe tenant-scoped `ProviderConnection` projection -> registry -> state/capability evaluation -> independently authorized adapter construction. The current global factory is not that resolver.

Core authorized capture, canonical persistence, portal reads and attention must work with zero external CRMs. A deliberate absence is `not_connected`, not a failure backlog. Mock and disconnected are distinct: mock adapter success never means HubSpot synchronization.

Onboarding first establishes whether a client has a commercial system and which domains it owns. If none exists, retain standalone operation; the existing ADR-0033 HubSpot default is a possible later onboarding path, not a prerequisite. Provisioning, connection identity, credentials, mapping, permissions and activation each remain under their applicable gates. Salesforce/GHL remain architectural candidates without implemented adapters at this baseline.

## 9. Failure, retry and reconciliation

| Condition | Required target behavior |
|---|---|
| CRM unavailable | Local portal remains usable; expose stale/pending status when evidence exists |
| DB/query unavailable | Explicit unavailable state; never substitute zero or mock success |
| Partial normalization | Incomplete enrichment; known facts remain visible with qualification |
| Duplicate/late source event | Stable identity and domain/version policy; no duplicate effects or blind overwrite |
| Ambiguous entity/authority | Review required; no guessed canonical/external write |
| Sync process crash | Future recovery protocol checks partial effects before repeating writes |
| Rate limit | Future worker respects provider retry signals with bounded backoff |
| Projection lag | Future projection shows age/watermark; canonical detail remains separately meaningful |
| Expired evidence | Honor retention; preserve permitted metadata without resurrecting deleted content |

The current CRM code has atomic claims, persisted provider identifiers and retries, but does not establish a complete scheduled retry service or lease/recovery protocol for stranded `processing` operations. The post-response ingest callback is not a general durable worker. Later durable dispatch needs an outbox or equivalent design; none is introduced by this proposal.

## 10. Security and implementation blockers

Before Phase 1: approve narrow disclosure contracts and tenant-safe query behavior; test missing/invalid session, both client roles, foreign IDs, foreign child records, cache separation and error semantics. Hosted access must fail closed under ADR-0039. The public-demo exception in ADR-0052 does not apply to this authenticated portal; ADR-0053 does not authorize its deployment.

Transcript text, recordings, raw webhook payloads and provider internals are excluded from initial disclosure. Safe summaries still require review/redaction policy; a field called `summary` is not proof that its contents are safe. Do not expose PII-bearing evidence by linking an internal accessor. Credentials and ciphertext are always excluded.

Additional gates before later phases: ADR-0051-compatible presentation storage; attention lifecycle authority before writes; tenant-scoped CRM resolution before multi-tenant live CRM; outcome provenance before serious ROI claims. None blocks documentation authoring.

## 11. Risks and disconfirming case

High risks are ledger/replay overclaims, global CRM resolution, broad transcript disclosure, duplicated configuration authority, and financial claims unsupported by provenance. Medium risks are a queue becoming a second CRM and premature projection infrastructure. Bounded request-time queries require measurement before scaling.

The strongest competing path is to use existing CRM dashboards. A ResponseOS portal is justified only if owners can understand ResponseOS activity, exceptions and evidence with less operational effort. Validate that with the small vertical slice before expanding. Architectural fit has high confidence; capacity and operator-value assumptions remain unmeasured.

## 12. Doctrine §21 checklist

| Question | Answer |
|---|---|
| 1. Layer | Presentation/interpretation over operational capture and records; later intelligence |
| 2. Build/integrate/defer | Build bounded reads; integrate existing identity/CRM; defer durable projections and advanced intelligence |
| 3. Live pilot | Helps later review; adds no acceptance criterion to today's demo |
| 4. Evidence | Preserves references and explicitly reports missing evidence |
| 5. Verified outcomes | Supports later verification; does not create it |
| 6. Proprietary learning | Potential attention/outcome feedback; not proven current capability |
| 7. Commodity | Buy/integrate CRM, identity, delivery and storage |
| 8. Duplication | Exclude pipelines, CRM administration, FSM and generic workflow builders |
| 9. Lock-in | Local canonical reads reduce CRM dependence; portability still needs proof |
| 10. Tenant isolation | Server context, constrained joins, disclosure/cache tests |
| 11. Attribution | Explicit source, definitions and unknowns; no inference of recovery from totals |
| 12. Public claims | Proposed capabilities remain planned; no new public capability claims |
| 13. Human controls | Existing review/merge/activation controls; later actions need explicit authority |
| 14. Compliance exposure | Client visibility increases disclosure risk; narrow initial fields |
| 15. Required now | Documentation now; implementation only after its gates and authorization |

## 13. Required decisions and reconciliation

ADR-0059 proposes the portal boundary and Phase 1 read pattern. ADR-0060 proposes presentation ownership boundaries while withholding durable-storage selection. Later decisions must cover durable attention, projections/dispatch/recovery and outcome provenance before those implementations.

No accepted ADR is superseded. Potential conflicts are made explicit: a general settings store would conflict with ADR-0051; a mandatory CRM would conflict with ADR-0050 standalone mode; claimed full replay would exceed the implemented substrate despite ADR-0002's target; current financial verification claims would exceed the stored metrics model. ADR-0042's proposed richer states are not implemented by these documents.

The linked PRD owns scope, phase gates and open questions. Independent review by Claude or CodeRabbit must cover the eventual current changes; self-checks are not independent review. Record authoring agent, exact reviewed head, reviewer system, outcome and evidence link when that review occurs. Human merge and separate deployment/provider gates remain intact.
