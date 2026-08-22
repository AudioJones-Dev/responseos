# ADR-0049 — Client environment continuity across demo, discovery, and live promotion

**Status:** Proposed — operator intent is confirmed, but this standalone draft must be reconciled into the canonical `docs/DECISIONS.md` log before merge.

**Date:** 2026-08-22

## Context

ADR-0048 intentionally made the personalized prospect bootstrap short-lived and safe. Its normal promotion export/import handshake creates a second `customer` Account, rebinds the approved snapshot to the new tenant, and then marks the source bootstrap converted.

That is a defensible cross-environment transfer mechanism, but it is not the desired normal commercial lifecycle. ResponseOS needs to scale from a superficial prospect-specific demonstration into consultant-led discovery and eventually live operation without rebuilding the client environment or changing tenant identity.

The desired progression is:

```text
prospect demo
  -> discovery / diagnostic enrichment
  -> client-validated configuration
  -> separately gated live staging
  -> live operation
  -> operational Business Memory
```

The same tenant should accumulate stronger evidence and configuration as it progresses.

## Decision

1. **The `Account` is the durable tenant identity.** Normal demo -> discovery promotion preserves the original sandbox `Account.id`.
2. **`ProspectBootstrap` becomes provenance/history after promotion.** It remains linked to the tenant and its original acquisition/snapshot lineage but no longer owns a short-lived account lifecycle after explicit conversion.
3. **In-place promotion is the preferred normal path.** ADR-0048's export/import handshake remains available for true cross-environment portability; it is not the default lifecycle for a prospect that stays inside the same ResponseOS control plane.
4. **Promotion does not authorize live use.** The promoted account remains `account_type=sandbox`; CRM, scheduling, payments, and production execution remain disabled/review-required until a later explicit live gate.
5. **Raw source retention and approved context retention diverge after promotion.** Raw acquired website text retains the ADR-0048 expiry policy. Approved normalized facts and immutable approved snapshots may persist after explicit promotion because they are the starting context for discovery. Unapproved/expired acquisition material remains eligible for purge.
6. **Discovery findings are structured evidence, not freeform prompt text.** They are stored as tenant/bootstrap-scoped `manual_reference` sources and `KnowledgeFact` rows with provenance, authority, reviewer state, hashes, and optional `AssessmentReport` linkage.
7. **Authority is explicit.** `owner_confirmed` outranks `operator_approved_for_demo` for single-value conflicts. Unapproved, rejected, and conflicted facts never compile into approved agent context. Multi-value facts retain distinct values and deduplicate identical values by the same authority rule.
8. **Business context remains versioned and immutable.** Discovery enrichment produces a new approved `BusinessMemorySnapshot`; older snapshots are not mutated.
9. **The reusable environment is represented by a non-secret manifest.** `client-environment.v1` carries tenant identity, blueprint version, current context hash/version, discovery references, agent/policy identity, and explicit integration/gate status. It excludes secrets, caller data, transcripts, recordings, and provider credentials.
10. **Live transition is a later decision/gate.** Nothing in this ADR authorizes changing the account to `customer`, enabling production providers, exposing client access, or representing the v0.4 knowledge layer as shipped.

## Consequences

### Positive

- Prospect personalization becomes the first stage of a reusable client environment rather than disposable demo work.
- Diagnostic/discovery work can directly enrich the client's structured operating context.
- Tenant identity and historical evidence remain continuous.
- Public-source facts can be superseded by stronger client-confirmed evidence without deleting provenance.
- Demo and live permissions stay separated, reducing the chance that a configuration change accidentally activates production behavior.
- AJ Digital can improve the shared platform/template without forking ResponseOS per client.

### Costs / risks

- ADR-0048's current `converted` state now carries two historical meanings unless the export/import path is later clarified or renamed.
- Existing cleanup logic must continue to purge raw public content without deleting promoted normalized context.
- A future live gate must explicitly define account classification, provider credentials, client auth, number ownership, integration permissions, and retention policy.
- `KnowledgeFactStatus` is being reused as the initial authority vocabulary; a richer v0.4 knowledge model may later deserve separate authority/source-type fields.
- `manual_reference` evidence is an intentionally narrow bridge, not authorization for general client knowledge ingestion, file upload, embeddings, or RAG.

## Compatibility with existing decisions

- **ADR-0001:** unchanged. No live provider is activated.
- **ADR-0002:** unchanged. Live operational events remain ledger-first.
- **ADR-0004:** unchanged. Compliance posture remains per tenant/deployment.
- **ADR-0005:** unchanged. No prospect/client Clerk membership is created here.
- **ADR-0009:** unchanged. Provider mutations still require verified webhook/edge controls.
- **ADR-0034 / v0.4 gates:** unchanged. This does not ship general retrieval/RAG or production client knowledge ingestion.
- **ADR-0048:** extended and partially superseded only for the **normal promotion topology**. Its bounded acquisition, review, telephony, retention, and safety controls remain in force; export/import remains a portability option.

## Merge gate

Before this implementation can merge:

1. reconcile this ADR into canonical `docs/DECISIONS.md`;
2. update canonical roadmap/API documentation to reflect in-place discovery promotion;
3. pass unit, integration, lint, typecheck, and build gates;
4. verify raw-source expiry does not purge promoted approved context;
5. verify no route or manifest enables live integrations;
6. human-review the semantic overlap between the legacy promotion-import path and the new in-place path.
