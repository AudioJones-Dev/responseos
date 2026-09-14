# Mike's supervised FRL demonstration

Status: local implementation under review; independent review and live activation remain pending. No live demonstration has passed. Owner: Audio. Implementers: Claude (reused closure candidate `e55c100`), Codex (reconciliation and review/consent changes). Reconciled base: `a9747cc` (includes PR #175 and ADR-0055).

## Approved task

Problem: the merged baseline does not connect approved FRL context, a real call, operator-reviewed evidence, test CRM records, and an email Mike receives.

Outcome: an isolated inbound demonstration covering every FRL intake path, with real approved business facts and clearly fictional customer/project scenarios. Audio approves the follow-up before CRM or email effects. Invite Mike only after two consecutive internal live rehearsals pass.

Success: Mike can choose a scenario and ask unscripted questions; the agent uses supported facts, handles unknowns honestly, and creates follow-up Mike considers useful. This establishes demonstration evidence, not autonomous readiness, production readiness, revenue recovery, or a guaranteed sale.

Scope: supervised tenant configuration, pinned business knowledge, per-call consent evidence, canonical call capture, operator review, bounded HubSpot contact/call/qualified task, operational email, failure visibility, and rehearsal tests. Out of scope: recording, real customer histories, production traffic, scheduling, outbound calls, public release, separate CRM Notes/Tickets/Deals/Companies, general RAG, and a new agent platform.

## Implementation and provenance

Reuse candidate runtime, configuration, normalization, HubSpot and Resend work from `e55c100` selectively on a branch from current master. The original closure worktree's uncommitted `supervisedTenant.ts` change is preserved and is not included. Candidate documentation and environment scripts were not imported as authority. Original candidate claims about recording and immediate external effects are superseded by this task.

- Add `business.knowledge` to the typed operator configuration: approved facts with source references, plus explicitly fictional scenario records. Store assertion provenance with a hash covering values, not only field names. No real FRL operational values are committed.
- Pin the approved snapshot on `CallCaptureSession` at assistant initialization. Missing context or recipient prevents readiness. Updating configuration does not change an existing call's context.
- Keep recording disabled. Append `CallConsentEvent` records for the transcript artifact. The authenticated operator records witnessed grant/refusal/withdrawal at current server time; entries cannot be backdated or edited. This endpoint records evidence; it does not control Telnyx capture.
- Require verified provider capture controls and interval provenance in the signed preflight. Content events require `capture_started_at` and `capture_ended_at` covering their entire cumulative content. Missing or unauthorized intervals are metadata-only before ledger storage and normalization. This transport contract is **not verified against a live provider**. A prompt instruction or operator consent row is not proof that capture stopped at the provider.
- Finalized calls create versioned `CallReview` drafts. Authenticated operators edit the structured payload and preview the exact email before approving. Approval freezes the payload and records the reviewer. Stale or duplicate decisions fail closed.
- A separate dispatch action uses the approved content. Ordinary personalized prospect demos retain their CRM prohibition. Qualified-only task eligibility is retained; PR #175's unratified outcome allowlist is not adopted.
- CRM and email statuses are independent. Provider acceptance is not inbox receipt. Retries reuse the frozen payload and email idempotency key; old ambiguous deliveries require reconciliation. No background scheduler or unattended retry is claimed.

## Interfaces

Updates to an enabled supervised profile require explicit reactivation with the complete approved configuration and fresh number preflight. Omitting activation cannot change an active tenant's policy. The call webhook records only metadata and rejects normalization when the supervised runtime is incomplete, degraded or outside `SUPERVISED_PILOT`. Existing notification retries use their stored recipient and message even if the latest configuration was revoked; the live email provider gate remains required for previously live attempts. These controls are repository behavior, not proof of provider activation or delivery.

Late evidence cannot create a superseding review while a dispatch is claimed. The webhook retains the event and marks processing as failed for a retry after dispatch releases its claim; replay is not an unattended scheduler. A later revision following provider effects requires reconciliation. Revoking the execution gate during CRM dispatch prevents the subsequent email effect. G-12 still stops new transcript persistence after withdrawal, including delayed content from an earlier capture interval; previously retained evidence is not deleted by this check.

- Existing `POST /api/admin/supervised-tenants` accepts typed configuration entries including `business.knowledge`; use `dryRun` before an authorized apply.
- `POST /api/admin/call-capture/:id/consent`: `{action: grant|refuse|withdraw, disclosureRef, evidenceRef, eventKey}`. Actor, tenant, artifact and event time are server-owned. `:id` is an initialized capture session, not a caller-selected tenant.
- `POST /api/admin/call-reviews/:id`: approve with expected revision and structured payload; reject with expected revision; dispatch an already approved revision. Only authenticated cross-tenant operators may operate this console, consistent with the existing operator role.
- `/admin/demo-operations` shows review, transcript, email preview and delivery state. Full transcript remains authenticated and is never exported to CRM or email.
- Additive migrations 0014 (reused runtime) and 0015 (capture/consent/review). Existing rows default to legacy behavior; new supervised calls require approval. Existing prospect-demo behavior is preserved.

## Architecture checklist (§21)

1. Layers: communications capture, operational memory, follow-up.
2. Build policy/evidence/review; integrate existing provider adapters; defer fulfillment.
3. Directly closes Mike's call-to-follow-up journey.
4. Preserve call, source, consent, review and delivery evidence.
5. Prove communication outcomes only; no revenue claim.
6. Collect operator corrections as evidence, not automatic model training.
7. Buy voice, transcription, CRM and email.
8. Do not duplicate telecom, CRM or scheduling products.
9. Canonical records and provider interfaces bound vendor dependence.
10. Derive tenant from authenticated operator-selected server resources or verified number assignment.
11. Do not label estimated value as recovered revenue.
12. No unsupported live, autonomous, compliance or conversion claim.
13. Add explicit per-call approval before external follow-up.
14. Consent and recipient handling require verified activation evidence; retain no audio.
15. Required for the requested demonstration; broader platform work excluded.

## Open operational gates

### Local validation — 2026-09-13

Branch `feat/mike-live-demo`, worktree `C:/dev/responseos-mike-live-demo`, [draft PR #177](https://github.com/AudioJones-Dev/responseos/pull/177). The validation below covers the implementation committed as `9458513`; it is local test evidence, not independent review or CI evidence.

- Node 24.18.0 / npm 11.16.0: lint, typecheck, 687 unit tests across 60 files, and production build passed.
- PostgreSQL 16.15 on loopback with synthetic databases: all 15 migrations applied; Prisma schema diff reported no difference; all 180 integration tests across 15 files passed. The production build also passed with the synthetic preview database configured.
- Browser verification: fictional call transcript, structured fields and exact email preview rendered; approval froze edits and changed status to approved while CRM/email remained pending. No dispatch or live provider call occurred.
- Fixed issues found during validation: configuration snapshot idempotence now ignores assertion timestamps while comparing fact values; preflight errors expose the safe actionable reason; integration role fixtures use the actual restricted development-session key.
- Independent review, hosted authentication, provider-side consent capture, live CRM effects, inbox receipt and rehearsal timing remain unverified.

### Remaining activation work

1. Independently review current code, including reused Claude work; mixed authorship requires CodeRabbit under repository policy. Human merge only.
2. Verify real provider event shapes, consent start/stop controls, and cumulative-content bounds. If unavailable, keep activation blocked and revise the transport explicitly; never fabricate evidence or silently weaken consent.
3. Obtain approved FRL fact pack, disclosure wording, callback expectations, recipient and demonstration number through the operator configuration path.
4. Operator separately authorizes isolated resources, credentials, provider activation, deployment and live sends. Configure hosted auth and kill switches; no public number release.
5. Validate local and CI gates, live HubSpot mappings, email receipt, failure drills and rollback.

## Rehearsal acceptance

Cover VPL, vehicle lift, ceiling lift and ramp inquiries; new/existing sales; new/existing service; project coordination; administration; homeowner, builder/GC and commercial roles. Verify fictional history access only with the scenario reference. Test unknown geography, price and compatibility; interruption; unsupported requests; consent refusal, silence and withdrawal; absent configuration; duplicate and out-of-order events; stale approval; CRM ambiguity/failure; email failure and retry.

Record exact build SHA, snapshot version, provider call ID, consent evidence, review revision, CRM identifiers, email provider identifier and human-confirmed inbox receipt for each run. Target review availability within two minutes of hangup and inbox receipt within two minutes of approval/dispatch. These are unverified acceptance targets. Two consecutive complete runs with no critical failure precede the invitation.

## Operator presentation

Allow 20–30 minutes: explain real facts versus fictional scenarios and the approval boundary; let Mike choose a caller/product; accept unscripted questions; inspect transcript and analysis; approve and dispatch; inspect CRM and inbox together; repeat with a service/project call. Capture corrections and objections before proposing the operational pilot.

### Repair validation — 2026-09-13

After reconciling master at `a9747cc`: `npm run lint`, `npm run typecheck`, `npm test` (693 tests), `npm run test:integration` (183 tests), `npm run build` with the isolated database, and `npm audit --audit-level=high` passed. Prisma migration diff, all 15 migrations and seed passed against synthetic Postgres 16 on loopback. Configuration validation passed. No provider effect, live call, deployment or client-data mutation was exercised. Independent CodeRabbit review and GitHub CI of the published repair remain separate gates.
