# FRL local hardening and commissioning gates

Status: local development candidate, not hosted or Mike-demo ready. Base is the preserved release successor `664a76a2d58c0e94868722488b34a2b16b9890cd`; isolated branch `feat/frl-local-hardening-20261018`. Original worktrees and developer branches remain unchanged. Final commit/tree and check counts belong in the external `hardening-20261018` evidence bundle, generated after committing this document.

## Phases and owners

| Phase | Owner | Dependency and acceptance | Gate |
| --- | --- | --- | --- |
| Local development | Codex | Reproduce races; preserve consent/tenant policy; local lint/typecheck/unit/build/config plus disposable PG16/17/18 regression, migration compatibility and restore checks | Authorized local scope only |
| Immutable webhook identity | Codex + owner/privacy review | Approve exact schema/key/retention proposal below, then add conflict tests and migration/rollback design | Separate schema authorization; not implemented |
| Publication | Owner/reviewer | Review exact commit and diff; recheck branch freshness and every Git/connector deployment trigger | Push approval distinct from deployment approval |
| Hosted commissioning | Operator + owner | Pin control/application SHA, target identities, database principal/schema and existing migrations; verify auth and rollback | Separate environment/settings, credentials and deployment authorization |
| No-effects qualification | Operator | Approved facts/disclosure and Voice API Call Control; consent cases, boundaries, initialization, authenticated transcript review; permanent CRM/email prohibition | Separate live carrier/call authorization |
| Full supervised demonstration | Owner + operator | New SUPERVISED_PILOT call, approved test recipient/records, frozen human-approved content, HubSpot readback, provider message ID and inbox receipt | Separate effects authorization; two consecutive complete internal rehearsals |

## What this local change does

The old live-demo workflow pulled Preview, deployed without an explicit custom target, migrated the database in the deployment job and accepted ambiguous HTTP redirects/404 as access evidence. It is replaced with a deliberately closed workflow: no secrets, checkout, installation, provider commands, migrations or deployment. It validates dispatch revision shape/binding and always fails before effects. This is a quarantine interlock, **not an implemented or validated hosted deployment pipeline**. Activation requires a separately reviewed implementation and explicit authorization. A missing GitHub Environment is not a security interlock and must never be relied upon.

`scripts/live-demo-commissioning-contract.mjs` supplies pure evidence checks and an offline qualification preflight. It does not call providers, validate real credentials, inspect a live assignment or grant authority. Collected evidence must come from independently authorized readbacks. Clerk checks concern format/mode only; actual issuer/session verification and tenant access remain commissioning checks. Qualification evidence booleans are attestations to verify against durable assignment records, not runtime controls.

The existing `validate-live-demo-env.mjs` remains the separate full-live-operation validator; its required HubSpot/gate settings must never be enabled just to make qualification pass. The new offline preflight requires carrier effects disabled as well as CRM/email disabled and recording off. Live no-CRM/email qualification needs separately reviewed carrier-only preflight wiring after carrier authorization; this local validator does not certify live-call readiness. No provider flags or settings were activated.

Root Telnyx normalization now runs in a bounded transaction; existing capture transactions are reused. An account-scoped transaction advisory lock serializes cooperating normalizers before contact/call/lead reads. Reproduction produced six contacts for one phone in both shared-call and different-call cases. Regression checks require one contact and one lead per call. No schema change or automatic transaction replay is introduced.

Lock order is capture, account normalization, then review. Root normalizers never acquire capture locks. Account locking trades throughput for correctness. It does not deduplicate existing rows, establish database uniqueness for other writers, or coordinate retention/prospect-bootstrap purge. PostgreSQL may abort a transaction on row-lock cycles involving other writers; do not retry effects automatically. Retention-versus-normalization resurrection remains a separate review item.

Consent backend termination is tested against the actual operator route while its transaction waits for the initial capture lock: failure returns 503, creates no consent grant/start intent and dispatches no AI command. This specifically proves the pre-write boundary. It does not establish behavior when termination occurs after grant/intent writes or during ambiguous commit. Existing generic transaction rollback/no-replay tests remain separate evidence; neither is a claim of end-to-end live recovery.

## Exact target and future activation acceptance

- Team `team_BHxIkAGPW6qEKKQBAt9c0NGz`.
- Project `prj_Pm88ysh24EgV1DEIcvaE9r2Xd28A`, name `responseos-frl-live-demo`.
- Custom environment `env_k4aq29aq3e4XqcKuaNyRYyOJ7YkV`, slug `frl-live-demo`.
- Intended managed alias `responseos-frl-live-demo-env-frl-live-demo-audiojones.vercel.app`.

These are target expectations, not current hosted-state certification. Before activation, independently bind project owner and custom environment readbacks, current-master control SHA, reviewed application SHA, workflow source SHA and checkout HEAD. Keep controls separate from application source; no unreviewed application script receives deploy credentials. Pin reviewed action commits, constrain secret-bearing steps and require protected-environment approval of the exact revisions. Never substitute Preview or Production when custom target lookup fails.

After a separately authorized deployment, require returned immutable deployment ID/host, exact project/team/custom environment and application/control metadata, READY state, `/api/health` build SHA, and exact managed-alias routing to that deployment. Reject unknown or conflicting evidence and unexpected/user aliases. Provider response adapters and retry/polling remain to be implemented and reviewed; the pure contract deliberately fails when required evidence is absent. No alias promotion or reassignment is authorized here.

Vercel CLI remains pinned conceptually at 41.7.0; no install or upgrade was performed. Local global CLI 62.4.0 cannot certify 41.7.0. Official 41.7.0 source confirms custom string target parsing, pull environment forwarding, build target recording and prebuilt target equality checking:

- [Target parser](https://raw.githubusercontent.com/vercel/vercel/vercel@41.7.0/packages/cli/src/util/parse-target.ts)
- [Pull implementation](https://raw.githubusercontent.com/vercel/vercel/vercel@41.7.0/packages/cli/src/commands/pull/index.ts)
- [Build implementation](https://raw.githubusercontent.com/vercel/vercel/vercel@41.7.0/packages/cli/src/commands/build/index.ts)
- [Deploy prebuilt checks](https://raw.githubusercontent.com/vercel/vercel/vercel@41.7.0/packages/cli/src/commands/deploy/index.ts)

This is source compatibility evidence, not an executed end-to-end custom environment certification. Candidate commands for future review consistently use `pull --environment=frl-live-demo`, `build --target=frl-live-demo`, and `deploy --prebuilt --target=frl-live-demo`. Verify the entire request/response mapping and approved package artifact before activation; do not install or upgrade as an implicit workaround.

## Database, auth and rollback checklist

Deployment must never run migrations implicitly. In a separately authorized database phase, record intended database/branch/endpoint, database name, role, schema/search path, migration history/checksums and application binding without exposing connection strings. Catalog evidence of migrations 0014–0017 alone does not prove the application uses that database. Do not combine the Mike demo database with web-routing migrations from #209/#210. Require compatible schema diff, reviewed migration SQL, backup/restore evidence and an explicit rollback owner. No hosted migrations were run here.

Auth acceptance requires valid Clerk secret/publishable pairing and issuer, required auth, absent dev override, approved operator organization and account mapping. Test anonymous denial, a valid operator positive control, another tenant denial and non-operator denial on authenticated review and protected APIs. A redirect or 404 alone is insufficient. Verify both immutable deployment origin and managed alias. Never collect real tokens or session bodies into evidence.

Rollback pins the previous known-compatible artifact and database contract. If deployment/readback/auth fails, stop commissioning; do not automatically target Preview/Production, promote aliases or reverse migrations. Any rollback deployment is separately authorized. Preserve bounded diagnostics and redact values/content. Historical connector deployment records establish that deployments occurred; they do not establish whether those deployments were authorized.

## Immutable webhook fingerprint proposal — approval required

The provider/event ID dedupe key does not bind content. Local reproduction accepts changed content for the same ID after redacted, restored and purged body states. Current `raw_body` is intentionally mutable and cannot establish original content; do not repurpose it, `signature_header`, errors or the identity dedupe key.

Proposed schema: nullable immutable `content_fingerprint`, `fingerprint_version`, and `fingerprint_key_id` if keyed hashing is chosen. First insert atomically binds provider/event identity to a digest computed from the verified original bytes before redaction. Raw-byte equality is the simplest version; canonical JSON would need a separate precise canonicalization specification. Duplicate mismatch must fail before reopening, backfilling or business mutations, preserve the original row and store only bounded non-content conflict evidence. Signature, tenant and consent checks still apply to every retry.

Legacy null fingerprints cannot be reconstructed from redacted/purged bodies; unverifiable recovery fails closed with explicit remediation. Retention must cover fingerprints and correlation metadata. SHA-256 is not anonymization; prefer a separately managed keyed digest if dictionary resistance is required. Key lifecycle, rotation, retention and provider reserialization tolerance need owner/privacy decisions before implementation. Proposed migration is additive/nullable, with no invented historical backfill; rollback must not silently re-enable unverifiable recovery. No SQL migration, key access or fingerprint implementation is included.

Minimum approval requested for this portion: authorize designing and locally testing this additive schema/migration with synthetic data and choose keyed raw-byte fingerprint semantics/retention policy. Hosted migration and key provisioning remain separate approvals.

## Qualification and demonstration protocol

Preserve the deterministic post-call analysis stub: Analysis unavailable, conservative maybe qualification, human review. The first demonstration uses manual operator summary/qualification. Model-backed analysis is a future proposal requiring separate evaluation, privacy/cost and activation approval.

Use Voice API Call Control. Do not revive the September 16 TeXML bypass, superseded PR #182 or simulated routing as the Mike demonstration. Before any authorized call, pin approved FRL facts/disclosure, routing/number, callback expectations and recipient; confirm recording off, transcript retention bounds and qualification assignment interval. Check consent grant/refusal/withdrawal, disclosure completion before initialization, capture start/stop boundaries, delayed/out-of-order transcript handling and authenticated review. Qualification assignment permanently prohibits CRM/email effects for its calls, even after the interval closes.

A later full demonstration requires a distinct authorized SUPERVISED_PILOT call and approved test records/recipient. Human approval freezes exact summary/qualification/message content. Verify real HubSpot readback, provider message ID and inbox receipt. Two consecutive complete internal rehearsals are required; unit/integration passes and mock command receipts do not satisfy this gate.
