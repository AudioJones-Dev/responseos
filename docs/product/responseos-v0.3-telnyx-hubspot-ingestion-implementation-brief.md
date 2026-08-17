# ResponseOS v0.3 — Telnyx-to-HubSpot ingestion implementation brief

**Status:** `PARTIALLY_SHIPPED` — H0 contract lock implemented locally for review; H1–H6 remain unauthorized
**Prepared:** 2026-08-16
**Milestone:** v0.3, founding-pilot Stage G
**Lane:** Standard only
**Decision basis:** ADR-0002, ADR-0009, ADR-0033, ADR-0034, ADR-0045, and the [founding-pilot scope](./responseos-v0.3-founding-pilot-scope.md)

> This document defines a future, staged implementation. It does not authorize code, schema, credential, Telnyx, HubSpot, deployment, or production changes. The Demo-MVP continues to use controlled sandbox CRM actions. A live HubSpot staging adapter requires a separate written Stage G authorization; production requires Stage I.

## 1. Problem

ResponseOS has a generic mock-first CRM provider boundary and event-ledger models, but it does not currently ingest a completed Telnyx AI call into HubSpot. A direct Telnyx-to-HubSpot tool call would bypass the internal event ledger, weaken idempotency and provenance, and couple canonical business state to two provider payloads.

The missing capability is a governed translation from a verified Telnyx completion event into canonical ResponseOS state, followed by an asynchronous, replay-safe HubSpot synchronization.

## 2. Desired outcome

For one Standard-lane founding-pilot tenant, a valid Telnyx call-completion event can eventually produce:

1. one accepted and deduplicated `WebhookEvent` in the ResponseOS ledger;
2. one normalized tenant-owned call record and Phase-1 Business Memory capture;
3. a deterministic HubSpot contact resolution result;
4. one HubSpot call activity associated with the resolved contact;
5. an optional note or deal association only when an approved tenant policy requires it; and
6. a durable CRM-sync result linked back to the originating ResponseOS evidence.

ResponseOS remains the internal operational system of record. HubSpot remains the external commercial CRM system of record. Neither provider owns the canonical event contract.

## 3. Success criteria

The future implementation is complete only when all applicable checks pass in local tests and an authorized staging environment:

- The application still boots and exercises deterministic CRM mocks with no provider credentials.
- Telnyx signature verification runs against the raw request body before JSON parsing or business mutation; invalid or stale requests return `401` and create no ledger, call, contact, or CRM mutation.
- The tenant is resolved server-side from the configured provider connection; no request body or client parameter selects `accountId`.
- A duplicate Telnyx event ID produces one accepted ledger event, one canonical call, and at most one HubSpot call activity.
- Out-of-order provider events use provider occurrence time and monotonic state transitions; an older event cannot regress a finalized call.
- HubSpot timeout, rate-limit, and retry paths do not create duplicate contacts, calls, notes, or deals.
- Zero, one, and multiple contact-match paths are covered. Multiple matches enter operator review and do not merge or mutate records automatically.
- Every CRM read and write is scoped to the tenant's resolved HubSpot connection.
- Call field mappings and association direction are verified against the target HubSpot account at Stage G rather than copied from a demo fixture.
- No raw transcript, recording URL, inferred revenue, or sensitive qualification detail leaves ResponseOS unless an approved tenant policy explicitly permits it.
- A provider kill switch returns CRM execution to the deterministic mock without blocking canonical call ingestion.
- Controlled staging records can be traced from Telnyx event ID → ResponseOS ledger/call → CRM operation → HubSpot object IDs.
- Existing repository gates pass: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:integration`.
- No public copy describes the integration as live until the staging evidence and production gate support that claim.

## 4. Scope

### 4.1 In scope for the eventual implementation

- A canonical CRM-sync request derived from a normalized, finalized ResponseOS call.
- Expansion of the CRM provider contract and deterministic mock for contact, call activity, optional note, and conditional deal operations.
- Replay-safe CRM dispatch outside the Telnyx webhook request.
- HubSpot staging adapter behavior for contact resolution/upsert, call activity creation, associations, and explicit sync results.
- Tenant-configured mapping policy, data-minimization policy, kill switch, retries, audit references, and staging evidence.
- Unit, contract, tenant-isolation, replay, failure, and authorized staging end-to-end tests.

### 4.2 Out of scope

- Direct Telnyx AI Assistant tools that write to HubSpot.
- HubSpot writes inside the webhook request/response path.
- Automatic contact merge or deletion.
- A deal for every phone call.
- Automatic deal amount, recovered-revenue, or attribution claims based on AI inference.
- Full transcript or recording replication by default.
- Bidirectional HubSpot-to-ResponseOS synchronization.
- Historical backfill or bulk migration.
- Custom HubSpot objects, workflows, dashboards, or pipeline redesign.
- Restricted/HIPAA-lane records.
- Production credentials, production records, deployment, or founding-pilot activation.

## 5. Constraints and current-state truth

| Area | Verified repository or preflight truth | Consequence |
|---|---|---|
| CRM adapter | `lib/providers/crm` exposes a generic mock-first boundary and does not supply a live HubSpot adapter | Begin with contract and mock changes; do not imply HubSpot is integrated |
| Telnyx ingest | No Telnyx webhook route is currently shipped | Signed ingest from the live-call brief is an upstream dependency |
| Provider enums | Current schema/provider unions do not fully represent Telnyx | Any enum or migration work belongs to separately authorized Stage B work |
| Idempotency | `WebhookEvent` has provider-event dedupe fields, but calls do not currently enforce a Telnyx provider-call uniqueness invariant | The implementation must choose and test a durable call/operation idempotency model before live writes |
| HubSpot access | A read-only preflight confirmed the connected account and relevant CRM object schemas; no CRM records were read or changed | Re-verify object properties, pipelines, dispositions, and association definitions at Stage G |
| CLI credential | The HubSpot CLI personal-access key is a local developer credential and lacks suitable endpoint/runtime authority | It must never be copied into Doppler, `ProviderConnection`, app env, fixtures, or source control |
| Recording | The current Telnyx assistant configuration has recording disabled | Omit `hs_call_recording_url`; do not infer that a recording exists |
| Demo fixture | `docs/product/demo-assets/hubspot-sync-event.json` contains fictional demo values | It is narrative-only and cannot certify a live HubSpot field, pipeline, stage, amount, or association |
| Demo scope | HubSpot is sandboxed for the Demo-MVP and deferred live until Stage G | Keep all earlier stages mock/sandbox-only even if Telnyx staging is enabled |

## 6. Existing assets and dependencies

- [`responseos-v0.3-live-call-demo-implementation-brief.md`](./responseos-v0.3-live-call-demo-implementation-brief.md) owns Telnyx contracts, signed webhook intake, and canonical call normalization.
- [`responseos-v0.3-founding-pilot-scope.md`](./responseos-v0.3-founding-pilot-scope.md) owns the staged authorization ladder and Demo-MVP sandbox boundary.
- [`responseos-v0.3-provider-readiness.md`](./responseos-v0.3-provider-readiness.md) owns provider-account, secret, signature, kill-switch, observability, and non-production readiness checks.
- [`../SECURITY.md`](../SECURITY.md) owns raw-body signature verification, timestamp freshness, secret handling, and tenant-isolation rules.
- [`../api-spec.md`](../api-spec.md) owns the canonical webhook envelope and acknowledgment behavior.
- [`../data-schema.md`](../data-schema.md) owns the ledger, call, contact, provider-connection, workflow, and audit model descriptions.

Upstream dependency: the live-call path must first produce a verified, deduplicated, tenant-owned, normalized call. This brief begins at `crm.sync.requested`; it does not duplicate the Telnyx transport work.

## 7. Required architecture

```text
Telnyx signed completion event
        |
        v
raw-body verification -> WebhookEvent ledger -> dedupe/order
        |                                      |
        | fast acknowledgement                 v
        |                              normalized Call + memory
        |                                      |
        +--------------------------------------v
                                       crm.sync.requested
                                                |
                                                v
                                      asynchronous dispatcher
                                                |
                          +---------------------+-------------------+
                          v                                         v
                  deterministic mock                       HubSpot Stage G adapter
                                                                    |
                                                                    v
                                           contact resolution -> associated call
                                                                    |
                                                      optional note / conditional deal
                                                                    |
                                                                    v
                                                crm.sync.succeeded or failed
                                                with provider object references
```

### 7.1 Non-negotiable boundaries

1. The webhook handler verifies, records, deduplicates, and acknowledges. It does not perform HubSpot network calls.
2. A Telnyx post-conversation action or insight may become a signed input to ResponseOS; it may not bypass ResponseOS to mutate HubSpot.
3. Provider payloads are translated at adapter boundaries. Domain and workflow code consumes canonical types only.
4. CRM retries repeat a stored operation intent; they do not reconstruct business intent from an untrusted provider payload.
5. Every provider result records `accountId`, canonical call/event reference, operation key, adapter, attempt, outcome, timestamp, and provider object references without storing credentials.

## 8. Canonical contract

The exact TypeScript names may be refined in the implementation PR, but the semantics are fixed by this brief.

### 8.1 `CrmSyncRequest`

Required fields:

- `accountId` — server-resolved tenant.
- `callId` — canonical ResponseOS call.
- `sourceEventId` — accepted ledger event.
- `operationKey` — stable key such as `hubspot:{accountId}:{callId}:call-v1`.
- `occurredAt` — provider occurrence time, not worker execution time.
- `contactCandidate` — normalized E.164 phone; verified email and name only when present.
- `callActivity` — direction, status, duration, from/to numbers, sanitized summary, intent, qualification facts, and next action.
- `policyVersion` — tenant mapping/data-minimization policy used for the decision.
- `requestedOperations` — contact + call; optional note/deal only after policy evaluation.

Prohibited fields:

- credentials or tokens;
- client-supplied tenant identity;
- AI-inferred deal amount or recovered revenue;
- raw recording bytes; and
- unrestricted raw transcript by default.

### 8.2 `CrmSyncResult`

Required fields:

- `status`: `succeeded | retryable_failure | permanent_failure | review_required | skipped`;
- explicit `providerId`, `accountId`, `callId`, `sourceEventId`, and `policyVersion` for tenant-scoped audit and replay;
- the same stable `operationKey`;
- contact resolution: `created | matched | updated | ambiguous | skipped`;
- provider object references for created/matched contact, call, optional note, and optional deal;
- attempt count and provider response category;
- redacted error code/message when unsuccessful; and
- `completedAt` plus a link to the originating ledger/call evidence.

The result must be replayable and auditable without storing the provider credential or full response body.

## 9. HubSpot mapping policy

All property names and enumerated values below are staging candidates observed during the read-only preflight. Stage G must re-read the target account's live schema and association definitions before enabling writes.

### 9.1 Contact resolution

1. Normalize caller phone to E.164.
2. Search the tenant's connected HubSpot account by normalized phone.
3. If no phone match exists and a verified email is present, search by email.
4. Zero matches: create a contact with only verified/minimum fields.
5. One match: preserve operator-entered values; update only empty fields or fields explicitly owned by the approved sync policy.
6. Multiple matches: return `review_required`; do not choose, merge, or update automatically.

For new contacts, `lifecyclestage=lead` and `hs_lead_status=NEW` are proposed defaults, not locked values. Existing lifecycle stage, lead status, owner, and consent fields remain unchanged unless the tenant policy explicitly authorizes an update.

### 9.2 Call activity

| Canonical value | Candidate HubSpot property | Rule |
|---|---|---|
| Call start time | `hs_timestamp` | Required; use canonical call start time |
| Descriptive label | `hs_call_title` | Neutral label such as `Inbound AI receptionist call` |
| Sanitized structured summary | `hs_call_body` | Include verified intent, qualification facts, next action, and ResponseOS references; no unrestricted transcript |
| Duration in seconds | `hs_call_duration` | Convert to milliseconds |
| Direction | `hs_call_direction` | Map to the account-supported inbound/outbound value |
| Final call state | `hs_call_status` | Map only after schema verification |
| Approved outcome/disposition | `hs_call_disposition` | Resolve account-supported disposition IDs/values; do not invent one |
| Caller number | `hs_call_from_number` | E.164 |
| Destination number | `hs_call_to_number` | E.164 |
| Source | `hs_call_source` | Proposed `VOIP`; verify before write |
| Recording | `hs_call_recording_url` | Omit while recording is disabled or policy forbids sharing |

Do not write `hs_call_summary` or `hs_call_has_transcript`; the preflight reported them as read-only. Use `hs_call_body` for the sanitized, structured summary.

### 9.3 Associations

- Associate every created call activity with the resolved contact.
- Associate the call with a deal only when the deal policy selects an existing or newly authorized deal.
- Retrieve association definitions at connection validation or use HubSpot's supported default-association path. Association IDs are directional and must not be blindly hardcoded from the preflight account.

### 9.4 Optional note

A note is off by default. When the tenant policy enables it, the note may contain a redacted transcript excerpt, verified qualification facts, and the agreed next action. The full raw transcript remains in the ResponseOS evidence boundary unless a separate retention and disclosure policy authorizes export.

### 9.5 Conditional deal

A call does not automatically create a deal. Deal creation requires an approved qualification or appointment policy, a configured tenant pipeline/stage, and an unambiguous associated contact. Amount stays blank unless supplied by a verified operator or approved source. AI estimates never become pipeline amount or verified recovered revenue.

## 10. Idempotency, ordering, and failure handling

- **Webhook identity:** deduplicate on the Telnyx event ID persisted with the provider name.
- **Call identity:** map the provider call/conversation identifier to one tenant-owned canonical call; add a durable uniqueness invariant if the existing schema cannot enforce it.
- **CRM operation identity:** one stable key per account, call, object operation, and contract version.
- **Provider identity:** persist successful HubSpot object IDs so a replay returns or updates the prior result instead of creating a second object.
- **Ordering:** use provider `occurred_at` for event order. Finalized states may accept additive metadata but may not regress.
- **Retries:** retry rate limits and transient failures with bounded backoff; permanent validation failures enter review or dead-letter handling.
- **Partial success:** persist each completed object operation. A call-creation retry must reuse the previously resolved contact and must not repeat contact creation.
- **Concurrency:** two workers claiming the same operation key must serialize or converge on the same stored result.

## 11. Security, privacy, and authority

- Verify Telnyx Ed25519 signatures on the unmodified raw payload and enforce the freshness window in [`../SECURITY.md`](../SECURITY.md) before mutation.
- Resolve the tenant through the active `ProviderConnection`; every read/write includes the server-derived `accountId`.
- Store runtime HubSpot credentials only through the approved encrypted provider-connection/secrets path. Never reuse the HubSpot CLI personal-access key.
- Select the HubSpot runtime authorization model before Stage G. The local CLI auth proves developer connectivity only; it does not establish a deployable multi-tenant credential design.
- Apply data minimization to summaries, transcripts, qualification facts, and error logs. Never log authorization headers, access tokens, or unrestricted provider bodies.
- Keep this flow in the Standard lane. Regulated/HIPAA use requires the separate restricted-lane controls and provider agreements.
- Require operator approval for ambiguous identity, destructive CRM changes, contact merge, attribution decisions, and any policy that exports additional transcript/recording content.

## 12. Staged implementation plan

Each row is a separate authorization and review boundary. Completing this brief authorizes none of them.

| Work package | Deliverable | Permitted behavior | Gate |
|---|---|---|---|
| **H0 — Contract lock (Review)** | Canonical request/result types, field policy, fixtures, contract tests | Documentation and deterministic mocks only | Authorized with the recommended defaults on 2026-08-16; scoped tests green |
| **H1 — CRM boundary** | Expand `CrmProvider`; mock contact/call/note/deal results | No network calls; no schema or env mutation unless separately approved | Scoped implementation approval |
| **H2 — Ledger dispatch** | Persisted CRM-sync intent/result, operation-key uniqueness, retry/claim semantics | Mock adapter only; migration requires Stage B authorization | Stage B plus H1 green |
| **H3 — Upstream handoff** | `crm.sync.requested` emitted from verified/finalized canonical call | No HubSpot network call; Telnyx ingest remains owned by live-call brief | Authorized Telnyx stages and signed-ingest tests green |
| **H4 — HubSpot staging adapter** | Contact resolution, call activity, associations, optional policy operations | Controlled staging HubSpot records only | Written Stage G authorization; runtime auth + mapping policy locked |
| **H5 — Staging E2E** | Golden call, retry/replay, isolation, kill-switch, rollback, evidence packet | Dedicated demo tenant/resources only | H4 green; no production |
| **H6 — Production cutover** | Founding-tenant connection and monitored activation | One approved Standard-lane tenant | Stage I authorization after all founding-pilot gates |

Recommended pull-request boundaries mirror the work packages. Do not combine schema, live adapter, provider configuration, credentials, and production activation into one PR or approval.

## 13. Test matrix

At minimum, the authorized implementation adds tests for:

- valid, invalid, missing, and stale Telnyx signatures;
- duplicate and out-of-order events;
- cross-tenant event/provider/call/contact access attempts;
- zero, one, and multiple HubSpot contact matches;
- field ownership preservation on existing contacts;
- required call fields, duration conversion, omitted recording, and prohibited read-only properties;
- association direction/definition lookup;
- optional note disabled/enabled behavior;
- deal policy false/true/ambiguous paths and blank unverified amount;
- retryable, permanent, partial-success, and rate-limited provider responses;
- concurrent workers using the same operation key;
- mock fallback with no credentials and with the kill switch enabled;
- redaction of transcript, errors, logs, and provider response bodies; and
- one controlled staging golden call with evidence references and cleanup/rollback instructions.

## 14. Observability and rollback

Required operational signals:

- accepted/rejected Telnyx webhook counts by tenant and reason;
- CRM sync requested/succeeded/retried/review-required/permanent-failure counts;
- latency from call finalization to HubSpot activity creation;
- dedupe/concurrency suppressions;
- ambiguous-contact rate;
- provider rate-limit and auth-failure counts; and
- kill-switch state and adapter selection without secret values.

Rollback order:

1. disable live CRM dispatch for the affected tenant;
2. route new sync requests to the deterministic mock while canonical ingestion continues;
3. stop retries for the affected contract version;
4. preserve ledger and operation evidence for reconciliation;
5. reverse only controlled staging artifacts that the runbook explicitly identifies; and
6. revert application deployment if required.

Never delete or merge external CRM records as an automated rollback.

## 15. Open decisions — operator/engineering lock required

| Decision | Recommended starting position | Owner | Blocks |
|---|---|---|---|
| Runtime HubSpot auth model | Tenant-scoped deployable credential through `ProviderConnection`; never CLI PAK | Operator + security/engineering | H4 |
| Contact match/field ownership | E.164 phone first, verified email second; ambiguous → review; preserve existing values | Operator + product | Locked for H0 |
| Deal creation threshold | Off by default; enable only for an approved qualified/appointment state | Operator + sales ops | Locked for H0; re-approve any H4 change |
| Pipeline/stage/disposition | Tenant configuration validated at connection time; no fixture hardcoding | Sales ops + engineering | H4 |
| Transcript policy | Sanitized `hs_call_body`; note and full transcript off by default | Operator + privacy/legal | Locked for H0; H4 still requires privacy review |
| Telnyx completion source | Prefer the least-coupled signed completion/insights event that supplies stable IDs and finalized data | Engineering, verified in staging | H3 |
| Persistence model | Durable operation uniqueness and result references; exact schema decided in Stage B | Engineering | H2 |
| HubSpot owner assignment | Leave unchanged/unassigned unless an approved tenant routing rule selects an owner | Operator + sales ops | Locked for H0; H4 configuration remains gated |

## 16. Risks

| Risk | Control |
|---|---|
| Duplicate contacts/calls from retries | Provider-event, canonical-call, and CRM-operation idempotency layers |
| Wrong contact mutated | Guarded matching; ambiguous results quarantine; no automatic merge |
| Provider coupling | Canonical contracts and adapter-only payload translation |
| Webhook latency/retry amplification | Ledger-first fast acknowledgment; asynchronous CRM dispatch |
| Tenant data crossing | Server-resolved `accountId`, tenant-bound connection, isolation tests |
| Sensitive transcript leakage | Minimized summary, export policy, redaction tests, recording omitted |
| False revenue/CRM claims | Conditional deal, no inferred amount, evidence-state language |
| Credential misuse | Encrypted runtime credential path; CLI PAK prohibited |
| Demo side effects | Sandbox/mock until Stage G; controlled resources and kill switch in staging |
| Account-specific schema drift | Stage G schema/association discovery and contract validation |

## 17. Architecture-review checklist

1. **Layer:** Communications intake → Phase-1 Business Memory → external CRM projection.
2. **Built/integrated/deferred:** Canonical ledger/dispatch behavior is built internally; HubSpot is integrated as a commodity CRM; live behavior is deferred to Stage G.
3. **Live pilot:** Yes—this closes the first real CRM projection after the signed call path is proven.
4. **Evidence:** Yes—every operation retains source event, call, operation key, policy, outcome, and provider references.
5. **Verified outcomes:** It preserves the evidence needed for later reconciliation but does not itself verify revenue.
6. **Proprietary learning:** It can preserve tenant-specific operational history; HubSpot API mechanics are not proprietary.
7. **Commodity buy:** CRM storage/UI is bought from HubSpot; ResponseOS builds only canonical memory, policy, evidence, and orchestration.
8. **Duplication:** It does not rebuild HubSpot; it projects the minimum commercial record from ResponseOS.
9. **Lock-in:** Canonical contracts, internal ledger, mocks, and adapter boundaries limit lock-in; HubSpot-specific fields stay in the adapter.
10. **Tenant isolation:** Required through server-resolved tenant identity and tenant-bound provider connections.
11. **Attribution ambiguity:** Reduced by prohibiting inferred amounts and separating CRM activity from verified outcome evidence.
12. **Public claim:** The contract capability is `PARTIALLY_SHIPPED` at H0; live HubSpot integration remains `DOCUMENTED_ONLY` until staging evidence changes it.
13. **Human approval:** New controls are required for ambiguous identity, destructive CRM changes, export policy, and Stage G/Stage I activation.
14. **Compliance exposure:** Yes—CRM export adds PII exposure; minimization, lane restrictions, and policy gates control it.
15. **Required now:** The design is required before the roadmap's first live CRM path, but implementation is not required before signed call ingest and idempotency are green.

## 18. Provider references to re-verify at implementation time

- Telnyx, [Receiving Webhooks](https://developers.telnyx.com/development/api-fundamentals/webhooks/receiving-webhooks) — signature headers, raw-payload verification, event identity, ordering, retries.
- Telnyx, [Start AI Assistant](https://developers.telnyx.com/api-reference/call-commands/start-ai-assistant) — current conversation-completion and insight event behavior.
- Telnyx, [Create an Assistant](https://developers.telnyx.com/api-reference/assistants/create-an-assistant) — post-conversation settings and tool behavior.
- HubSpot, [Calls API guide](https://developers.hubspot.com/docs/api-reference/latest/crm/activities/calls/guide) — call properties, required timestamp, and associations.
- HubSpot, [Association schema guide](https://developers.hubspot.com/docs/api-reference/latest/crm/associations/associations-schema/guide) — association definitions, labels, IDs, and direction.

These links are implementation references, not repository evidence that a provider is configured or live.

## 19. H0 execution record and next gate

The operator authorized H0 with the recommended defaults on 2026-08-16. The local implementation adds additive canonical request/result types, a readonly default policy, deterministic request/result fixtures, and contract tests. It does not expand the existing `CrmProvider` methods, persist sync state, call a network, or change schema, environment variables, secrets, provider configuration, deployment, or CRM records.

Current review-fix validation passed: `npm run lint`, `npm run typecheck`, `npm test` (232 tests), and `npm run build`. The initial H0 validation also passed the Postgres 16 integration gate after migration/seed (`npm run test:integration`, 132 tests, plus a database-backed build); that validation database was ephemeral and removed after the run.

H1 remains a separate authorization. H4 additionally requires a runtime auth decision, an authorized HubSpot staging resource, Stage G approval, and green upstream signed-ingest/isolation evidence.
