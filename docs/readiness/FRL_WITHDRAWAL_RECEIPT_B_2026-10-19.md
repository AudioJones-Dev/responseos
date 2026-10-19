# Independent withdrawal receipt and content drain

Status: EXPERIMENTAL local candidate. Owner-approved Option B, October 19, 2026 (Sentinel_b574d9239eec81918229a5ec8e425e11). Frozen predecessor application 44e45c21e925510c1f9563f7c9f0d63bb2b6744b and disabled control 905091b9707bba33d2f376d7ac27bf9666c61b4d remain unchanged, as do the original commissioning baselines 952280b / 9b7b8c5.

## Accepted semantics

Saving the receipt blocks new content authorizations. A transaction already authorized to retain raw history, caller data or a transcript may finish after the receipt and that content remains stored. Receipt alone is neither completed drain nor proof of provider cessation. This supersedes the receipt/row-lock serialization claims in FRL_WITHDRAWAL_LEDGER_RACE_2026-10-19.md and the immediate-complete-fence language in ADR-0069/0074.

The operator response and console distinguish receipt recorded/not recorded/unknown, content drain pending/confirmed, and AI-stop command status. Unknown readback disables new consent in the console. Grant and refuse cannot reopen a recorded withdrawal. Command acceptance never establishes independent AI cessation or phone disconnection. Existing exact-call disconnection evidence remains separate.

## Receipt, drain and evidence

Migration 0023 adds an insert-only CallWithdrawalReceipt with actual account and composite capture/account/provider-call foreign keys. The first actor, stored generation, request identity, claimed source time, provenance and database UTC receipt time survive retries. No client account selects the record. Capture identity becomes immutable. Legacy non-null withdrawal_received_at values are copied without time conversion; legacy rows receive no invented actor or drain confirmation. Migrations 0001–0022 remain byte-identical.

Receipt uses a dedicated one-connection pool, explicit READ COMMITTED, pool acquisition 250ms, lock_timeout 250ms, statement_timeout 500ms, idle transaction timeout 1000ms and transaction budget 1500ms. Capture writers use NO KEY UPDATE where a row lock is needed, allowing the receipt FK's KEY SHARE. Account/key-changing contention may still prevent a receipt: confirmed SQL rollback plus empty readback reports not recorded; unresolved acknowledgements/readback report unknown. These are per-operation bounds, not an end-to-end HTTP latency guarantee.

A separate bounded capture-lock transaction commits withdrawal_drained_at and the legacy receipt/closure projection. It cannot confirm until covered content writers release the same advisory lock by commit or rollback. A database trigger requires receipt and closure and acquires that barrier even for direct marker updates. Evidence construction is a later transaction; evidence failure cannot undo receipt or drain. AI stop still follows successful drain and evidence recording; there is no earlier-stop redesign or background retry worker. Same-request operator retry resumes incomplete work. Lost acknowledgement is reconciled by durable readback, never assumed successful.

## Covered writers and observations

- Generic supervised webhook raw reservation/backfill and normalization: capture advisory lock, READ COMMITTED, receipt-aware canRetainCallContent. New authorization sees receipt even before compatibility projection.
- Call Control raw cumulative history, normalized call data and transcript revisions: capture lock then account lock, receipt checks; existing authorizations may finish. Queued work checks again after acquiring the capture lock.
- Finalization selection and final review persistence: capture lock and receipt check. External analysis already in progress is not claimed cancelled.
- Standalone review queue and approval: capture lock and receipt check. Grant/start and transfer command authorization use the same lock and receipt-aware checks. Automatic transfer remains disabled.
- CRM/email gates also consult the central receipt-aware predicate. They remain disabled in qualification; the drain marker is not a claim that arbitrary external provider work ceased.

Activity review exposes content-free row identifiers, transaction observation times, raw ledger processing/purge status, normalized transcript/summary presence, transcript revisions, reviews and command/provider statuses. Observation timestamps are not database commit timestamps. The generic normalization observation leaves transcript-write determination unknown; it does not invent a transcript write. No caller bodies are copied into audit metadata.

## Validation and remaining gates

Final evidence must bind exact application/control commits and trees, include local UI and authorization/uncertainty/concurrency results, PG16/17/18 integration, additive upgrade in different database time zones, restore schema/function/ACL comparisons, and disposable cleanup. The guarded migrate-reset seed test is not bypassed; any exclusion must be explicit. Connection loss tests terminate only owned disposable database sessions. Lost acknowledgement tests model response loss; they do not prove a hosted network-fault scenario.

No new retention duration is chosen. Insert-only/FK restrictions intentionally prevent ordinary receipt deletion; a future maintenance lifecycle requires a separate policy/authority decision. No credentials, real calls, provider/CRM/email/recording effects, installations, push, merge, hosted changes, deployment, F2 or other-leg routing expansion. Pinned Node24.18.0/npm11.16.0/VercelCLI41.7.0 control remains disabled; real CLI stdin-token compatibility remains unverified.

## Doctrine section21 review

1. Evidence/admission layer. 2. Build the bounded receipt/drain contract. 3. Reuse PostgreSQL. 4. Preserve original evidence and chronology. 5. No cessation claim from receipt or acceptance. 6. No learning expansion. 7. No carrier replacement. 8. No CRM duplication. 9. No provider activation. 10. Stored account plus exact capture FK and shared lock. 11. No inferred cross-leg identity. 12. EXPERIMENTAL only. 13. Separate hosted approval. 14. Synthetic data; no retention policy expansion. 15. Resolves the observed receipt latency/atomicity conflict under the explicitly accepted in-flight rule.
