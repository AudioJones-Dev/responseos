# Source-time withdrawal: bounded local successor

Owner approval: Sentinel_3b2f888768cc8191bab1c5cb95f69599,2026-10-19 03:16:54UTC. Local implementation and synthetic tests only. Frozen app6b02ba1/controlc081f41 remain unchanged. Deployment tooling is out of scope.

## Authority and behavior

An authenticated operator/aj_admin records a personally witnessed withdrawal for the server-selected capture. The API accepts withdrawalSourceTime with occurredAt in canonical UTC (YYYY-MM-DDTHH:mm:ss[.sss]Z) and attestation=operator_witness. Actor is session-derived. The existing disclosure/evidence/jurisdiction references support that operator assertion; external text, a provider claim or customer input cannot grant source-time authority. This is witnessed human attestation, not independent verification of the reference contents.

Withdrawal records source_occurred_at/source_time_claim/provenance separately from recorded_at (database UTC clock taken before lock wait). occurred_at is the supported source time only when the claim passes chronology and authority checks; otherwise it is a receipt-time fallback labelled review_required. Future, impossible, unsupported precision/format, missing, unverified, before-grant, after-end and conflicting observations go to review. Offset strings are intentionally review-only in this bounded UTC input contract. Grant/refuse keep their existing strict inputs.

The durable withdrawal_received_at fence is written before timestamp evaluation and before waiting for the capture lock. Missing disclosure/evidence/jurisdiction does not delay withdrawal; it requires review. Malformed/unidentifiable requests or unauthorized roles are still rejected. Evidence transaction failure leaves the fence intact; retries can complete evidence and provider stop. Identical keys/content preserve original evidence. Conflicting reuse creates a separate review event without overwriting the original, including reuse of a grant key. The trigger prevents clearing the receipt fence or re-entering active consent states. Later grants cannot reopen consent.

All new content processing, analysis, approval, CRM and email dispatch checks honor withdrawal. The existing idempotent AI stop path is retained; no external remediation or retrospective undo is introduced. In-flight operations admitted before the durable fence may complete or remain uncertain. Checks immediately precede provider boundaries, but are not cancellation of network calls; no zero-effects-after-receipt claim is made. Original command/CRM/email outcome ledgers retain their real statuses and identifiers.

Source2:00/receipt2:05 remains two separate timestamps. Original transcript/capture-end records are not retroactively relabelled as stopped at2:00. Withdrawal suspends freezing/analysis of retained text; review cannot automatically approve or release it. Review snapshots and fresh console inventory expose capture intervals, command intentions/acknowledgements, transcript revisions, analyses, CRM status/IDs and email attempts/IDs. Items may predate the gap or complete after receipt; their timestamps/statuses remain explicit context, not proof all occurred in the gap. Unverified/conflicting times use the wider capture interval. No transcript bodies, recipients or credentials are copied into the activity snapshot.

Migration0021 only adds nullable evidence columns and the terminal-fence trigger. Historical rows remain unchanged with unknown recording/source provenance. No backfill is performed. Existing retention policies and hosted grants are not changed. Hosted migration and restore approval remain separate.

## Validation and review

Synthetic tests cover supported delayed time, invalid/missing/unverified time, precision, prior chronology, tenant role denial, cross-account lookup, immediate fence under lock wait/failure, idempotent/conflicting keys, concurrent observations, terminal regrant prevention and final CRM/email blocks. Existing real Call Control tests cover in-flight start/withdrawal and idempotent stop. Full local PG16/17/18, lint/typecheck/unit/build/config and independent exact-SHA review are required before freezing evidence in consent-source-evidence-20261019.

No live call, real credential, hosted setting/migration, push, merge or deployment is authorized. Remaining operator review is disposition of flagged activity/provenance, not permission to silently resume capture or remediate externally. Mike-demo readiness still requires hosted commissioning and two authorized complete internal rehearsals.

Doctrine21: data/consent evidence layer; bounded app-owned correction; needed for approved5.8; preserves actual evidence; no outcome/learning claim; no commodity replacement; no CRM/telecom duplication; standard PostgreSQL; server tenant identity; less timestamp ambiguity; local experimental status; existing operator authority with explicit attestation; no new real-data exposure; required correctness rather than expansion.
