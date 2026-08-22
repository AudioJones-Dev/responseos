# ResponseOS Client Environment Blueprint

**Status:** Proposed implementation slice. Repository capability only. No provider activation, production tenant activation, deployment, client login, CRM mutation, scheduling, payment, or live-use authorization is created by this document or its companion code.

## Purpose

ResponseOS should be reusable across small-business prospects without cloning or rebuilding the application per client. The scalable unit is a **versioned client environment**: one tenant identity whose business context and permissions become progressively richer as the relationship advances.

The intended lifecycle is:

```text
platform template
  -> prospect demo
  -> business context seed
  -> discovery / diagnostic enrichment
  -> client-validated configuration
  -> separately gated live staging
  -> live ResponseOS
  -> operational Business Memory
  -> operational / founder intelligence
```

The demo is therefore the first bounded state of a potential client environment, not a disposable application.

## Core invariants

1. **One tenant identity.** Normal demo -> discovery progression keeps the same `Account.id`. A prospect is not copied into a second account merely because the commercial stage changes.
2. **Context is progressively enriched.** Public-source facts remain provenance-bearing evidence. Discovery findings add higher-authority evidence rather than rewriting history.
3. **Knowledge and permission are separate.** Knowing a scheduling policy does not authorize ResponseOS to schedule. Live tools and integrations require independent gates.
4. **Raw-source retention and normalized knowledge retention are separate.** Scraped text can expire while approved normalized facts and immutable snapshot hashes persist after explicit promotion.
5. **No client-specific fork.** Client variation belongs in tenant-scoped context, policy, workflow configuration, and provider bindings, not bespoke ResponseOS code.
6. **Promotion is not activation.** Demo -> discovery changes lifecycle and retention semantics only. It does not switch the account to `customer`, enable CRM writes, expose provider credentials, or authorize production traffic.

## Layer model

### Platform layer

Shared ResponseOS runtime and controls:

- tenant isolation
- event/audit discipline
- receptionist template
- webhook security
- provider adapters
- retention/reconciliation
- operator controls
- evaluation gates

### Business Context Seed

The prospect demo begins with the bounded ADR-0048 website acquisition path. Public information is normalized into reviewed facts and compiled into an immutable snapshot.

This is **seed context**, not a claim that ResponseOS already possesses comprehensive Business Memory.

### Discovery overlay

Discovery and diagnostic sessions create structured `manual_reference` evidence attached to the same tenant and source bootstrap. A finding records:

- fact key
- structured value
- evidence note
- authority class
- optional `AssessmentReport` reference
- valid-as-of time
- reviewer identity/time when approved
- source/content/evidence hashes

Initial authority classes:

| Authority | Stored verification state | Meaning |
|---|---|---|
| `consultant_observed` | `operator_approved_for_demo` | AJ Digital observed and accepted the finding; not owner-confirmed truth. |
| `client_stated` | `source_observed` | Captured from discovery but awaiting explicit review/confirmation. |
| `client_confirmed` | `owner_confirmed` | Operator records that the client confirmed the fact. |

### Authority resolution

For a single-value fact key, snapshot compilation prefers:

```text
owner_confirmed
  > operator_approved_for_demo
  > unapproved / rejected / conflicted (excluded)
```

When two approved facts have equal authority, the more recently reviewed/valid fact wins deterministically. Multi-value fields retain distinct values but deduplicate the same value using the same authority rule.

This allows discovery to supersede a superficial website statement without deleting its provenance.

### Client environment manifest

`client-environment.v1` is the portable representation of the tenant's current non-secret configuration state. It contains:

- durable account ID
- source bootstrap ID
- blueprint/template version
- lifecycle stage
- business identity
- current approved snapshot + hash/version
- assessment references and discovery counts
- agent template + policy hash
- explicit integration states
- explicit `liveActivationAuthorized: false`
- explicit `tenantIdentityPreserved: true`
- explicit `requiresSeparateLiveGate: true`

The manifest deliberately excludes credentials, raw caller data, transcripts, recordings, and provider secrets.

## Current repository slice

This slice implements only:

1. `completed` prospect demo -> `converted` discovery state **in place** on the same sandbox Account;
2. persistence of approved normalized facts beyond the prospect cleanup TTL while raw website source text retains its existing expiry;
3. structured discovery finding capture with optional AssessmentReport provenance;
4. review of pending discovery findings;
5. immutable context snapshot recompilation after discovery;
6. authority-aware resolution between public seed context and discovery context;
7. read-only export of a non-live `client-environment.v1` manifest.

## API surface

Operator-only:

- `POST /api/admin/prospect-bootstraps/:id/promote-to-discovery`
  - requires `{ "promotionAcknowledged": true }`
  - requires completed demo + approved snapshot
  - preserves `Account.id`
  - leaves `account_type=sandbox`
  - clears bootstrap/account-content expiry for promoted normalized context
  - does not activate providers

- `POST /api/admin/accounts/:id/discovery-findings`
  - accepts a structured discovery finding
  - optional `assessmentReportId` must belong to the same account

- `PATCH /api/admin/discovery-findings/:id`
  - review/confirm/reject a pending manual-reference finding

- `POST /api/admin/accounts/:id/environment-snapshots`
  - requires `{ "reviewAcknowledged": true }`
  - compiles the next immutable context snapshot

- `GET /api/admin/accounts/:id/client-environment`
  - returns the current portable non-secret environment manifest

## Existing promotion export/import path

ADR-0048's `BootstrapPromotion` export/import handshake remains useful for a true **cross-environment portability** case. It is no longer the preferred normal demo -> discovery lifecycle because that path creates a new customer Account and therefore breaks tenant identity continuity.

The new in-place path does not delete or silently repurpose the existing export/import implementation. A canonical ADR must decide their long-term relationship before this slice is merge-ready.

## Demo -> live boundary

This slice intentionally stops at discovery.

A future separately authorized live-transition gate must define at least:

- client approval of business facts and policy
- live agent profile/configuration
- account classification transition, if required
- Clerk organization/client access
- live phone-number disposition
- CRM/scheduling/payment provider bindings
- secrets placement
- webhook verification/readback
- data-retention policy
- integration-specific kill switches
- staging rehearsal
- rollback proof
- human go/no-go

No endpoint in this slice performs that transition.

## Evaluation criteria

This architecture succeeds when a prospect can progress from a superficial personalized demo into discovery without rebuilding their ResponseOS environment, while:

- tenant identity stays stable;
- public and discovery evidence remain attributable;
- owner-confirmed information can supersede lower-authority facts;
- raw acquisition data can still expire;
- context versions remain immutable and auditable;
- live permissions remain independently gated;
- client-specific code remains unnecessary.

## Deferred

Not authorized by this slice:

- social-media automation/scraping beyond ADR-0048's current source boundary
- file uploads
- embeddings/vector search/RAG
- production client knowledge ingestion
- automatic conversion to `customer`
- live provider activation
- provider number purchase/release
- client-facing editing UI
- automated diagnostic extraction from transcripts
- workflow execution from discovery findings
- production Business Memory retrieval

These remain subject to roadmap/ADR gates.
