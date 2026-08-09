# Operational & Serviceability Gap

Companion to [`CURRENT_STATE_AUDIT.md`](./CURRENT_STATE_AUDIT.md) (evidence) and
[`CRITICAL_PATH.md`](./CRITICAL_PATH.md) (task register). This document states the two gate
verdicts and the reasoning behind the completion percentages.

## Gate A — OPERATIONAL: ~15% complete

> One controlled tenant executes the core revenue-recovery workflow end to end in staging without
> manual database manipulation.

| Requirement | Status |
|---|---|
| inbound phone call | MISSING |
| Vapi agent interaction | MISSING |
| Telnyx transport | MISSING |
| webhook ingestion | SCAFFOLDED (ack-only) |
| call event persistence | PARTIAL (models yes, write path no) |
| transcript persistence | PARTIAL (models yes, write path no) |
| extraction pipeline | MISSING |
| normalized entities | MISSING |
| lead/contact creation | PARTIAL (models + accessors, no ingestion path) |
| conversation state | PARTIAL (model unwired) |
| event ledger | MISSING (generic); PARTIAL (`LeadEvent` only) |
| business-memory write | MISSING |
| recommended next action | MISSING |
| task/action generation | MISSING |
| downstream executable workflow | MISSING |
| system observability | MISSING |
| failure logging | MISSING |

**16 requirements: 0 fully implemented, 5 partial, 11 missing or scaffolded.**

The ~15% reflects genuine credit for the storage layer and accessors — real, tested work that later
tasks consume rather than replace. It does **not** reflect any working end-to-end path. **Zero of the
16 requirements is fully operational.**

## Gate B — SERVICEABLE: ~20% complete

Credit is concentrated in areas built during v0.2 hardening:

**Implemented:** tenant isolation (21 tests), authentication (Clerk + fail-closed gate),
audit-log model, credential encryption (AES-256-GCM), deployment containment.

**Partial:** secrets management (no KMS/rotation), audit-trail coverage (model exists, new paths
unwritten), runbooks (exist, owners unnamed), retention lanes (enum unwired), QA loop (model unwired),
per-tenant provider config (model unwired).

**Missing:** tenant configuration, phone provisioning, onboarding, retries/idempotency wiring, queue
handling, replay, monitoring, alerting, rollback drill, backup verification, recording/disclosure
policy, usage metering, cost controls, data export, offboarding.

**Notable pattern:** an unusual share of Gate B is *unwired models rather than absent design*.
`WebhookEvent`, `QaLog`, `WorkflowRun`, `ProviderConnection`, and `TranscriptRetentionLane` all exist
in the schema with accessors and no callers. That makes Gate B cheaper than a raw missing-count
suggests — most of these are S-effort wiring tasks, not design work.

**One item is disproportionately serious:** B12, call-recording disclosure and consent
configuration. It is a legal-posture gap rather than a feature gap, and it blocks a paid pilot
independently of everything else.
