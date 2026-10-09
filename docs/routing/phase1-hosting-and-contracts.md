# Phase 1 hosting and interface decision

Status: local implementation for review. Architecture direction authorized October 9, 2026; provisioning, hosted migrations, deployment and live acceptance remain separate approvals.

## Discovery and dependency map

ResponseOS PR [209](https://github.com/AudioJones-Dev/responseos/pull/209), head `0f5d1c431aea182648b6b8a68757274c6317cb2f`, remains draft/unmerged. Website PR [93](https://github.com/AudioJones-Dev/florida-ramp-lift-website/pull/93), head `a329ac6e8a380eb6d38e85df6ae6730a007be00e`, remains draft/unmerged. Worker branch starts from master `26da408a8e1e95d058acea44ea21777896edac2a` and locally incorporates the unmerged 209 dependency. Do not merge either existing PR as part of worker activation.

| Boundary | Existing primitive | Phase 1 extension |
|---|---|---|
| Website retry | Component-memory identity; unwired coordinator | Staging integration deferred until controlled acceptance; UUID/reference-only recovery contract |
| Signed ingress | Local-only `/api/frl-test-intakes` | Separate `/api/webhooks/frl/v1/intakes`, distinct signing domain and server credential registry |
| Durable receipt | `FrlWebIntake` and tenant/environment/submission unique key | Reuse same table and private JSON payload; versioned canonical inquiry envelope |
| Mock intents | `FrlMockDelivery`, SQL mock-only | Preserve table and guards; additive `HostedRoutingDelivery` child |
| Dispatch | Mock Account lock, fencing, expiry-to-uncertainty | Dedicated poller, frozen configuration/plan fingerprints and committed checkpoints before mutations, fencing and bounded retry |
| CRM projection | Local six-path planner | Verified FRL manifest, environment-specific inquiry identity and versioned HTTP adapter seam |
| Operator evidence | AuditLog and session tenant authority | Redacted status and simulation-only audited reconciliation endpoint |

## Existing hosting, independently refreshed

Vercel readback identifies ResponseOS, responseos-frl-live-demo and responseos-staging-mock projects. The latest observed ResponseOS deployment is READY at master `26da408`, target Production, deployment `dpl_BM7TJQxPSoH7nhwBiBNfQiiQVW9p`. This is evidence of the existing application/demo surface, not worker or FRL delivery readiness. Neon lists the corresponding existing Postgres projects. No hosted database query or migration was performed. Render workspace inventory returned Michael's workspace; service listing returned no usable service inventory. Railway's account/runtime inventory is not connected here.

The governed staging contract is explicitly mock-only with provider credentials forbidden. It must not be silently repurposed for live delivery. Hosting an isolated simulated worker against approved staging resources requires configuration review and provisioning/deploy approval.

## Decision

Use an isolated ResponseOS-owned Node process and the existing PostgreSQL datastore. Keep Vercel responsible for web request/receipt handling; no browser request waits for CRM dispatch. PostgreSQL is the queue and checkpoint authority. No Redis, second database, competing ledger or LLM is introduced.

Recommend a Render background worker as the first deployment candidate because a workspace is accessible and its fixed compute pricing is easy to review; Railway is an equivalent candidate if its account/region/operating requirements are preferable. Provider selection/provisioning is pending human infrastructure review, not implemented by this record.

| Concern | Design / operational consequence |
|---|---|
| Runtime | Long-lived Node 24 process. Render background workers receive no incoming traffic: loopback health/readiness is for in-process/container diagnosis, while platform monitoring must use logs/process supervision. Choose a reviewed private service instead if network readiness probes are required |
| Database | Existing Neon PostgreSQL over TLS, pooled runtime role, direct migration role; choose worker region near the selected existing DB; never place migration privileges in worker runtime |
| Queue wakeup | One-second bounded polling; no dependence on LISTEN/NOTIFY over pooled connections |
| Concurrency | Start one replica, two jobs per batch; configurable one to four per process. Independent replicas fence the same intent but total connection/API budget needs approval |
| Claims | Short tenant lock around claim transaction; 60-second lease; no transaction held across provider operations |
| Retry | Definitive nonacceptance/read-only failure only; exponential delay capped at 300 seconds, five claims maximum; uncertain operations never auto-retry |
| Secrets | Server registry of unique key IDs with account, test/preview environment, audience and approved retention; signing secrets stay server-only. Worker needs DB credentials only in simulated phase |
| Cost | Polling keeps DB active and may add Neon compute/egress costs. Render worker compute is advertised from $7/month. Railway Hobby is a $5/month minimum usage commitment, with resource usage beyond it billed. These are reviewed planning inputs, not spending authorization |
| Logs | Event codes, states and aggregate attention counts; no payload, contact, credential or image URL |
| Alerts | Structured operator-attention events for failed/uncertain deliveries; actual external paging provider remains an activation gate |
| Restart | Stop claiming on SIGTERM/SIGINT, drain current bounded batch; abandoned claims expire to uncertainty; an operator reconciles before release |
| Release | Exact reviewed SHA; local/CI checks, backup/restore drill, migration approval, deploy simulated worker, verify health and identity, then separately approve provider acceptance |
| Rollback | Stop worker, preserve receipts/uncertainty/checkpoints, redeploy previous compatible SHA. Additive schema stays in place; no destructive automatic down migration |

Sources checked October 9: [Render background workers](https://render.com/docs/background-workers), [Render pricing](https://render.com/pricing), [Railway plans](https://docs.railway.com/pricing/plans), [Railway billing](https://docs.railway.com/pricing/understanding-your-bill).

## Hosted protocol and authority

POST `/api/webhooks/frl/v1/intakes`. Headers: `X-ResponseOS-Key-Id`, `X-ResponseOS-Timestamp` (epoch seconds), `Idempotency-Key` (UUID-v4), `X-ResponseOS-Signature: v1=<hex HMAC-SHA256>`. Sign `responseos-hosted-intake.v1\nPOST\n<fixed path>\n<configured audience>\n<timestamp>\n<submission ID>\n<SHA256(raw UTF-8 body)>`. Five-minute freshness and 16384 actual-byte limit are enforced. Configuration resolves account/environment; request fields cannot select them. No shared protocol or credential with the localhost test endpoint.

Body is `{schemaVersion: 1, inquiry: <canonical inquiry without accountId>}`. Schema parsing strips no unknown fields: invalid/extra fields reject. The inquiry UUID must match Idempotency-Key. The server binds account and calculates the canonical digest. Private customer content stays in existing ledger JSON; operational receipts and logs expose no payload.

202 means received and queued, not CRM delivery. Identical replay returns 200 with the existing receipt/state; changed payload returns 409. Credential/environment/manifest problems fail closed. Only test/preview server environments are currently supported, even under hosted Node Production builds. Production lead capture is absent.

Public website integration cannot supply an invented qualification decision. It needs a separately reviewed deterministic mapping to pending/manual review, with qualified decisions sourced from authorized evidence. Equipment-acquisition intake, preferred contact, attribution and review/Task handling must be reconciled before Phase F. The current website schema lacks an acquisition need, and the local canonical planner expects a decision reference. Browser reload recovery must store only an opaque UUID/reference, never customer payload or secret; resubmitting changed fields needs a new identity and explicit UI recovery behavior.

## Doctrine section 21

1. Capture, operational evidence and delivery layers. 2. Build orchestration; buy existing hosting/CRM. 3. Preserves FRL demand before dispatch. 4. Receipt/checkpoint/audit evidence retained. 5. Delivery proof only, no revenue claim. 6. No proprietary learning. 7. Buy commodity compute/CRM. 8. No competing CRM/FSM/queue product. 9. Provider seam keeps vendor lock-in bounded. 10. Credential/session/server tenant authority and composite foreign keys. 11. Stable identity and environment separation reduce ambiguity. 12. Simulations make no live claim. 13. Existing provisioning/provider/deploy/merge approvals remain. 14. Private minimized payloads, explicit retention and no images. 15. Required to resolve observed FRL intake delivery gap.
