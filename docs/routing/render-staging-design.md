# Render staging design — review only

October 9, 2026: the user approved Render architecture. Provisioning, hosted migrations, deployments, provider writes, merge and production activation remain unauthorized. PR #210 stays draft, stacked on PR #209; website PR #93 remains unchanged.

## Architecture and specification

FRL's Vercel server submits signed versioned intake to the separate ResponseOS web API. ResponseOS returns a durable received receipt after PostgreSQL persistence; the browser does not wait for CRM delivery. An isolated Render worker polls the same ledger. No second database, Redis, disk, public worker URL or LLM is introduced.

Review artifact: `infra/routing/render.staging.yaml`, JSON syntax valid as YAML. One Oregon worker, plan `0.5c-512mb`, concurrency 2 (hard maximum 4), polling 10 seconds, Node 24.18.0/npm 11.16.0. Manual deployments, previews off, 90-second shutdown allowance. Build installs dev dependencies because tsx is required; generates Prisma but runs no migrations. Start invokes Node directly for SIGTERM. Enabled=false deliberately refuses execution. Separate approval is required to enable synthetic simulation. Runnable code still rejects live delivery.

`node scripts/validate-routing-blueprint.mjs` validates the inactive specification against the official vendored schema and checks activation/secret boundaries. Schema source https://render.com/schema/render.yaml.json, captured October 9, SHA-256 a0d4e8a3eb119a1b63657741757e3c25c091b3ce463c4be8c90e8026678d8163. This is local schema validation, not deployment or account-level validation.

Existing infrastructure: ResponseOS uses Vercel and Neon. Read-only metadata previously identified ResponseOS project quiet-band-27365020, PostgreSQL 17, AWS us-east-1, free_v3, 0.25–2 CU, suspension disabled, 6-hour history. This does not establish an approved staging target. Existing candidate staging project patient-snow-16014934 needs exact branch/database/role readback and authorization. No main/customer/demo target is selected by inference. Render inventory was inconclusive; no claim that its workspace is empty.

Fresh read-only staging metadata: patient-snow-16014934 is responseos-staging-mock, PostgreSQL **18**, AWS **us-west-2**, fixed 0.25 CU, suspension disabled, free_v3, 6-hour history, public connections permitted with no IP allowlist entries. CI now includes PostgreSQL 18. The proposed target is now this staging project, and the review Blueprint selects **Oregon**. The main ResponseOS project is excluded. Fresh reconciliation found the staging branch archived and only its owner role listed; see [final provisioning specification](final-staging-provisioning-spec.md) for activation, grants, TLS, restore and budget gates. Region is immutable after creation, so target and region must be settled together. No database contents/credentials were queried.

## Environment and secrets manifest

| Setting | Owner / classification | Proposed handling |
| --- | --- | --- |
| DATABASE_URL | Worker secret | Exact synthetic target, tenant/environment restricted nonowner role, no superuser/BYPASSRLS/DDL/DELETE; remote TLS required. Supply through secret UI, never chat/source. |
| RESPONSEOS_ROUTING_ACCOUNT_ID | Worker configuration | Approved synthetic tenant, currently unset. |
| RESPONSEOS_ROUTING_ENVIRONMENT | Worker configuration | test; production rejected. |
| RESPONSEOS_ROUTING_DELIVERY_MODE | Worker configuration | simulated; live rejected. |
| RESPONSEOS_ROUTING_WORKER_ENABLED | Activation gate | false until separate approval. |
| RESPONSEOS_ROUTING_CONCURRENCY / POLL_MS | Worker configuration | 2 / 10000. |
| RESPONSEOS_ROUTING_COMPANY_BINDINGS | Restricted configuration | [] until exact tenant/environment/portal/Company ID/approval reference approved. |
| NODE_VERSION / NPM_VERSION / NODE_ENV | Build/runtime | 24.18.0 / 11.16.0 / production. |
| DIRECT_URL | Separate migration principal | Forbidden in worker; time-limited migration job only after approval. |
| RESPONSEOS_HOSTED_INTAKE_KEYS | ResponseOS intake server secret | Forbidden in worker/browser; domain-bound HMAC key registry binds tenant/environment/audience/retention. |
| FRL signing credential | FRL server secret | Server only; independent of localhost synthetic authentication. |
| HubSpot private app token | Future provider secret | Absent; HTTP factory, scopes and activation require separate review. |
| Notification credentials/recipients | Future provider secret/configuration | Absent; internal queued notices only. |

DB rotation: approve replacement scoped role, verify readiness, swap secret, revoke old access. Intake rotation: explicitly registered key-ID overlap then revoke old key. Never log secrets. Proposed acceptance fixture retention seven days; deployed payload/audit retention and deletion require approval. Unresolved queued/inflight/uncertain records remain held. Images are not accepted; private storage has a separate gate.

## Cost estimate

USD published rates checked October 9: one 0.5 CPU/512 MB worker **$7/month**; optional 1 CPU/2 GB **$25/month**, requiring new approval. Two small instances would be $14/month and are not proposed. Workspace fees, metered usage, taxes and existing commitments are additional/unknown. No new database, queue or disk is specified. Sources: https://render.com/pricing and https://render.com/docs/compute-plans.

Ten-second polling produces about 259,200 cycles per 30 days, multiple SQL statements each, and can prevent database suspension. Free-tier adequacy is unproven. Conditional Neon Launch illustration at published $0.106/CU-hour: 0.25 CU continuously for 730 hours = **$19.35/month compute**, before storage/allowances/minimums/transfer. This is not the existing free_v3 price or an approved upgrade. Worker plus that illustration totals $26.35 before extras; firm total requires target billing readback. Source: https://neon.com/blog/major-compute-price-reduction-on-neon. Staging must measure memory, CPU, connections and polling cost before scaling.

## Staging deployment and rollback

1. Review exact candidate SHA, PR #209 dependency, migrations 0017/0018/0019, security/restore evidence and acceptance matrix. No merge implied.
2. Approve exact Render workspace/region/plan/budget and synthetic DB project/branch/database/tenant. Verify grants, TLS, connection limits, billing, backup/PITR and retention. Missing identity or cross-tenant access blocks deployment.
3. Separately authorize scoped role creation, backup/restore and additive migrations if required. Inspect applied versions; migration credentials stay outside worker. No destructive down migrations.
4. Separately authorize resource creation and exact-SHA deployment using the nested review Blueprint. Check existing service-name collision. Keep disabled, with no provider credentials. Record resource ID/SHA/configuration/billing readback.
5. Separately enable synthetic simulation. Verify heartbeat/readiness, latency, redaction, bounded concurrency, restart and quarantine. Deployment overlap may outlast the 60-second fence lease; ambiguity stays uncertain, never blindly resent.
6. Live HubSpot and website staging need further explicit authorization and a reviewed live-runtime change; current executable refuses real delivery.
7. Rollback: disable authorized test intake, stop/suspend worker, preserve database, redeploy approved compatible SHA/configuration. Never delete schema/checkpoints or reset uncertainty. Reconcile with provider evidence.

Render workers accept no inbound traffic. Process-local health/readiness cannot be public Render probes. Required hosted monitoring: heartbeat absent >60 seconds, oldest due queue >5 minutes, any uncertainty, rejected growth and repeated restarts. External recipient/channel is not approved; alert delivery must be commissioned before customer traffic. Sources: https://render.com/docs/background-workers, https://render.com/docs/blueprint-spec, https://render.com/docs/deploys, https://render.com/docs/regions.

## Next authorizations and risks

| Separate authorization | Cost exposure | Risk / prerequisite |
| --- | --- | --- |
| One Render worker and secrets | $7/month plus workspace/metered extras | Named workspace/region/plan and synthetic DB target. |
| Scoped DB role, hosted restore, additive migrations | Existing DB compute/storage/retention unknown | Wrong target, access leakage, locks, restore mismatch; grants/TLS/backup first. |
| Exact-SHA deployment and simulation enablement | Compute plus polling load | Memory pressure, overlap, restart uncertainty; monitoring required. |
| ResponseOS intake and FRL staging deployment | Existing Vercel usage unknown | Secret provenance, received versus delivered UX, noindex and no direct fallback. |
| Controlled HubSpot test writes | Existing Starter/API allowances; no upgrade specified | Explicit noncustomer records, Company IDs, six-path scope and cleanup; live runtime disabled. |
| External notifications | Provider/channel price unknown | Exact recipient, SLA and escalation workflow absent. |
| Merge/production/customer traffic/images/domain/indexing/publication | Separate estimates | Not included in staging approval; authorized end-to-end acceptance required. |

