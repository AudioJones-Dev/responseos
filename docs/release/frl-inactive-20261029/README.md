# Inactive FRL release preparation — 2026-10-29

> **Successor note (2026-10-31):** the transaction locking, number matching and evidence binding described here were revised on local branch `work/frl-inactive-successor-20261031`. See [the successor readout](../frl-inactive-20261031-successor/README.md). Text below is retained as the October 29 record except where marked.

Status: LOCAL REVIEW ONLY. No release, production restore rehearsal, real account creation or provider operation occurred. The published draft PR is unchanged. Industry and timezone remain owner decisions.

## Frozen source and authorization

GitHub readback: master `523e179be338603673f5d8ccbc75dd98391a7dec`; PR #231 open/draft at `465a12a2678b84ea3d1cb45572b0bdf49dbd7748`, containing current master. Latest CI validate and integration aggregate plus PostgreSQL 16/17/18 jobs succeeded. Earlier cancelled runs also exist. Vercel pending and CodeRabbit skipped are not validation coverage. Local branch `work/frl-inactive-release-local-20261029` was created from current master and fast-forwarded to the exact PR head. The occupied original checkout and other worktrees were preserved. Git reported an unrelated stale-worktree metadata permission error; no repair/delete was attempted.

The user's October 29 instruction authorizes local/synthetic preparation only. ADR-0084 remains proposed/local-only; neither it nor green CI grants production authority. Authenticated operator role and deployment/release authorization are different controls. The API accepts `aj_admin`/`operator` session roles, refuses customer writes and role injection, derives client read scope from the session, and rejects cross-tenant reads. Hosted writes are still blocked with no override. `RESPONSEOS_REQUIRE_AUTH` remains a hosted gate: without it, the development-session fallback can be privileged. No real identity/login was tested here.

The operator-supplied production mapping is recorded privately, not in this repository (not queried this run). This supersedes the older plan's “unresolved mapping” statement only. It proves neither current schema/history nor privileges, recovery readiness, available allowance or permission to connect.

## Review findings and local changes

1. **Collision gaps fixed locally:** the PR ignored contact numbers in malformed setup JSON and did not consult local telephony inventory. Create/edit now reserve readable contact numbers even in invalid drafts and refuse inventory collisions, including released inventory. This is conservative reconciliation, not number verification. *(Revised 2026-10-31: setup writers now take the shared advisory lock and table locks under READ COMMITTED, so they also see rows committed by writers outside the lock convention while they waited. Numbers match by digits, and a NANP number also matches its ten-digit national form. User, contact, call, conversation and SMS history references are refused by the app.)* Unrelated inventory/lifecycle writers must still be quiesced for release.
2. **Additional capture/memory writers guarded locally:** `recordCallTranscript`, `recordCallSegment`, `createManualKnowledgeFact` and `createAndApproveMemorySnapshot` did not check inactivity. They now deny paused/missing/setup-marked accounts before writing. Direct data writers have no current public capture route, but the server boundary should not depend on that absence.
3. **Local database allowlist tightened:** connection query strings and fragments are rejected, avoiding host/schema option overrides on an apparently loopback URL. No connection to any such target was attempted.

PR #231 already guards signed call ingress before raw-body persistence for resolved inactive accounts, direct normalization, CRM dispatch before operation creation/provider selection, assistant context and website ingestion before fetch/write. Strict schemas reject injected activation/approval/access fields and keep all seven flags false. Tests cover paused accounts with valid, missing and malformed drafts, and active accounts retaining a draft deny marker. Draft updates retain existing published profile/memory content; synthetic evidence does not authorize attaching those objects to FRL.

**Limits:** these are entry checks, not distributed cancellation or database policy. They do not terminate a fetch/provider call already in flight before a pause, govern old deployments, or prove external provider settings. Unresolved signed events can retain unassigned webhook payloads in existing code. The reviewed FRL transaction refuses every number inventory collision and every dependent account record; a previously routed or history-bearing ID must stop for reconciliation. Before release, quiesce all writers/old deployments and verify no active/in-flight assignments, bootstrap jobs or CRM retries can address FRL. Do not generalize the test result to zero metadata storage or provider-side inactivity.

## Migration sequence and preconditions

The exact sequence after a **verified** 0001–0008 baseline is:

| Order | Migration | Material effect / stop condition |
|---|---|---|
| 1 | `0009_internal_demo_professional_receptionist` | Adds account classification, profile/opportunity substrate; existing accounts default to customer. No automatic demo classification. |
| 2 | `0010_v0_3_provider_enum_alignment` | Adds provider enum values; commit this migration before a later transaction uses those values. No provider activation. |
| 3 | `0011_gtm_demo_closure_foundation` | Unique call `(account_id,provider,provider_call_id)` and webhook `(provider,provider_event_id)` indexes, contact flag and intake/CRM substrate. Duplicate non-null identities stop migration; preserve evidence and reconcile separately. |
| 4 | `0012_prospect_bootstrap_foundation` | Adds bootstrap/memory/number/promotion substrate and webhook expiry columns. No history import. |
| 5 | `0013_prospect_bootstrap_review_controls` | Backfills `review_expires_at = created_at + 7 days` for draft/ingesting/review_required/approved/provisioning/failed rows. This is a data change; active rows stay null. |
| 6 | `20261028_inactive_client_setup` | Adds nullable `Account.setup_draft_json`; no default, backfill or account creation. |

Before any separately authorized target operation: verify exact endpoint/database/schema/role/version; obtain applied migration names, checksums, successful/failed history and schema diff; check both duplicate-index predicates; inspect 0013-eligible rows; reconcile existing customer/demo identities and orphan references. Any different lineage, including pilot 0014–0028, is a stop. Do not run seed on an existing target, mark migrations applied speculatively, or delete duplicate evidence. No hosted baseline is assumed from the reported missing AgentProfile error.

Proposed migration executor is pinned Prisma 6.19.3 `migrate deploy`, after history/checksum acceptance and explicit approval. Apply only the reviewed pending chain. The separate `psql -1` harness proves per-migration transactional SQL behavior; it is not a replacement for Prisma history management. A real Prisma synthetic failure was tested too: duplicate webhook IDs cause P3018 at 0011, automatic retry is blocked by P3009, no tested unique indexes remain, both source events survive, and 0012 onward is not applied. Recovery requires a reviewed catalog/history reconciliation; no `migrate resolve` was run.

## Proposed account transaction

[proposed-frl.json](proposed-frl.json) contains the proposed business/contact data; no real values enter the synthetic test inputs. [account-transaction.sql](account-transaction.sql) is a review template and ends with `ROLLBACK`. It is not connected to an API or production runner.

The eventual authorized operator must supply industry, IANA timezone, authenticated operator identity, approved slug, and an exact current Account JSON snapshot (JSON null only after confirming absence). SQL checks an existing operator role as an integrity precondition; it does not authenticate a human by accepting an operator ID. An execution wrapper and approved credential scope remain release gates.

The transaction repeats name/slug/legacy-phone/raw-draft-phone/inventory collision checks after taking the setup advisory lock and table locks. *(Revised 2026-10-31: READ COMMITTED with every lock taken before any check; the October 29 SERIALIZABLE version fixed its snapshot before the lock waits. History references must equal an operator-reviewed `expected_phone_references` count.)* It scans all public `account_id` tables because this schema has logical rather than enforced foreign keys. It refuses orphan references even when Account is absent. Broad locks are deliberate for this one-shot review and require a short supervised maintenance window; lock timeout aborts without retry.

Preserve the operator-supplied candidate account ID only if absent and unreferenced, or if its exact reviewed row is an empty compatible paused customer with matching identity/owner-decided fields, no phone binding, Clerk binding or existing setup draft, and no dependent records. Otherwise abort; do not overwrite, auto-merge or invent a replacement ID. The supervised demo `operator-supplied supervised-demo ID` remains separate. No pilot calls, snapshots, number assignments or other history are imported.

Writes are at most one Account insert (or draft-only update of a compatible existing Account) and one AuditLog insert, atomically. Draft founder/contact: Florida Ramp & Lift, the operator-supplied founder, the operator-supplied contact number, all unverified. Customer/paused, primary phone null, no access binding; recording, transcription, AI answering, forwarding, outbound calls, automated follow-up and memory ingestion all false. Disclosure/consent content remains empty and unpublished/pending. A later approved disclosure workflow is separate.

## Synthetic validation and reproducibility

All SQL/test runtime used new local containers with **network none**, shared loopback only, no published port, no host environment forwarding, no `.env` files or live credentials. Dependency acquisition alone used an isolated credential-free container with registry/binary-download access; tests and migrations had no external network. PostgreSQL authentication is trust inside this isolated disposable container only.

Pinned images:

- Node 24.18.0 / npm 11.16.0: `sha256:4e9cb555d708e0829c9d93e5eeae9dfab0617b832ca436a690680e0fca735ef5`.
- PostgreSQL/client tools 16.15: `sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d`.
- Lockfile: Next 16.4.3, Prisma 6.19.3, Vitest 4.1.11. No dependency change.

Harnesses: [synthetic-migrations.sh](synthetic-migrations.sh), [synthetic-account.sh](synthetic-account.sh), [prisma-failure.mjs](prisma-failure.mjs). Run the shell harnesses in a fresh matching isolated PostgreSQL container with repo migrations under `/review/prisma` and the transaction template under `/review/account-transaction.sql`; they create only fixed `synthetic_*` databases and intentionally refuse an already-used database name. The Prisma failure harness uses only its hardcoded synthetic loopback URL and requires `synthetic_prisma_failure` to be created first. Do not adapt these scripts to hosted URLs.

Evidence stays under local `evidence/frl-inactive-20261029/` (logs, row fingerprints and synthetic custom-format dumps). Preservation fixture includes distinct synthetic legacy/demo accounts, contact, call, transcript, webhook and audit evidence. Every pre-0009 table's original-column count/hash matches after the full chain. 0013 backfill and final null draft column checked. Injected final ALTER failure rolls back. Both duplicate-index failure cases preserve source evidence. Pre-0009 and post-migration dumps restore into fresh synthetic databases; full post-migration table fingerprints match and restored schema diff is empty. Synthetic committed drafts and audits restore exactly too.

Account SQL checks exercised: rollback-only preview, new synthetic creation, compatible-ID preservation, occupied/stale IDs, invalid/missing industry/timezone, absent operator, malformed draft phone, released inventory, normalized business name, slug, orphan history, audit-insert failure and replay refusal. New/compatible synthetic commit copies alone replace the final ROLLBACK; the review artifact retains it.

Initial harness runs exposed a fixture-column mistake and Windows pipe line endings; both were corrected before passing evidence. An initial unit invocation inherited the synthetic database URL and failed two fixture-mode tests; the corrected credential-free unit run passed. The offline first install/generate lacked cached dependencies/Prisma binaries, resolved by the separate credential-free dependency download. No live-service fallback was used.

## Rollback limitations and remaining gates

No destructive down migration is proposed. Retain nullable draft storage and existing evidence on application rollback. Older code can ignore the deny marker, so rolling back guards requires containment first. Added enum values and created substrate are not safely undone by deleting migrations. A backup restore to an old point loses intervening writes unless explicitly reconciled; no RPO/RTO, hosted roles/grants/extensions or provider recovery has been proven here.

Account transaction failure rolls back account and audit together. After a future commit, reverse only the exact reviewed revision with an unchanged-row precondition and a new audit record; retain paused state. Never automatically delete a new Account or overwrite later edits. Keep a compatible preexisting identity and its captured prior state. A restore does not undo any external CRM/provider side effect.

Remaining release gates: independent review of exact local commits and transaction; new CI on any eventual published successor; owner industry/timezone/identity/contact/disclosure decisions; target-specific authorized schema/history/collision/privilege readback; separately approved migration and account execution mechanism; authenticated hosted operator access; old-deployment/in-flight-worker containment; and explicit release authorization. Real backup/export/restore remains blocked until protected storage, required schema/export privileges, current allowance and explicit export approval are accepted. Synthetic tests are **not a production restore rehearsal**. No pushes, merges, deployments, hosted SQL/exports, secret retrieval, FRL creation or Telnyx changes occurred.

## Doctrine §21 review

1. Tenant configuration/trust infrastructure. 2. Small local guards and review artifacts built; deployment deferred. 3. Prepares inactive delivery, not live pilot activation. 4. Preserves evidence and refuses collisions. 5. Makes no outcome-verification claim. 6. No proprietary learning/ingestion. 7. Reuses Postgres/Prisma/Git; no commodity platform built. 8. No CRM/FSM/carrier/workflow duplication. 9. No new dependency/lock-in. 10. Existing session scope retained; transaction operator-only and explicit account identity. 11. Demo/customer separation reduces ambiguity. 12. Only local-tested/prepared claims. 13. Existing explicit release/export approvals remain. 14. Synthetic-only validation; contact stays unverified. 15. Required for this inactive release preparation, no unrelated feature expansion.
