# Inactive FRL release preparation — successor readout, 2026-10-31

Status: LOCAL ONLY, for independent re-review. No push, PR change, merge, deployment, cleanup execution, credential retrieval, production access or real account creation occurred. Draft PR #231 (`465a12a2678b84ea3d1cb45572b0bdf49dbd7748`) and `6a355c6036c8b785688b85ee4a6f27d4d1cab245` are unchanged.

## Redacted publication (2026-10-31)

This branch, `work/frl-inactive-successor-r2`, is a single squashed commit on `329b6e3` with the content of `b0f0c2c` and these changes: owner-supplied identity values (founder, contact number, candidate and demo account IDs, production mapping) are replaced by `SUPPLIED_PRIVATELY_BY_OPERATOR` or prose references; test and comment numbers use fictional `555` numbers; the template takes the separate demo ID as a `separate_demo_id` input instead of a committed literal, with harness refusals for it. The validation tables below describe `292a5fe`; the r2 tree was revalidated separately and its results are recorded in the PR.

## Commits

| Commit | Purpose |
|---|---|
| `329b6e38a7e00f75847e6856c3b4e6d339847af5` | Base: current master, verified against GitHub on 2026-10-31 |
| `bc1a5c3308e0c2131106fba8f8325f715809b574` | Merge of `6a355c6` into master. Only conflict: `dashboard-data.json`, both tasks kept |
| `292a5fe0866baaa6e1f02a0a4a072c968c545a68` | Remediation. **Frozen tested commit** (tree `fd171e8c9d295b721cd8b6bd07feeae603949bb9`) |
| next commit | This readout and its manifest only; no runtime, test or harness change |

Branch `work/frl-inactive-successor-20261031`, worktree `responseos-frl-inactive-successor-20261031`.

## Finding dispositions

| Finding | Disposition |
|---|---|
| **M1** evidence not bound to the committed tree | **Corrected.** A correction is appended to [the October 29 validation](../frl-inactive-20261029/validation.md); historical logs are untouched. All successor results come from `git archive` of `292a5fe` extracted inside containers, not from a bind-mounted working tree. Every log summary records the SHA, tree and archive hash. |
| **M2** snapshot taken before locks | **Fixed.** The template and both app setup writers now take the advisory lock and all table locks under READ COMMITTED before any check reads data. Deterministic tests hold a competing writer open, confirm the setup writer is waiting on a lock, then commit. Negative controls: the original template accepts a collision committed during its lock wait, and the original app code fails 8 of the 9 new integration tests. |
| **M3** phone normalization and scope | **Fixed.** One rule in TypeScript (`phoneDigitForms`) and SQL: compare digits, and a NANP number also matches its ten-digit national form. Account primary phone, setup drafts and inventory refuse. User, contact, call, conversation and SMS history references are refused by the app; the template requires them to equal an operator-reviewed `expected_phone_references` count. The ten-digit rule can over-match a foreign national number. That is a refusal, so it is conservative. |
| **M4** master divergence | **Fixed locally.** Merged onto `329b6e3` (vite 8.3.5). Validated after the merge. |
| **M5** cleanup cutoff | **Planning change only.** The cutoff is November 4 evening EDT: conservative and unverified until the readout timestamp is established. The patch is unchanged and unapplied. The docs gap (ADR status, `production-target-check.md`, CHANGELOG) stays with the eventual cleanup PR. |
| L1 provisioning paths unguarded | Deferred. Not in this remediation's priority; runtime capture is still denied. |
| L2 runtime check covers paused/draft/missing only | Deferred. Unchanged. |
| L3 inactive 403 retries, unassigned payload retention | Deferred. Already documented. |
| **L4** weaker SQL validation | **Fixed.** Name, industry and founder must be trimmed, non-empty and at most 120 characters, matching `CreateSetupSchema`. |
| L5 disclosure scope | Unchanged. Real planning details remain in committed docs and still need explicit publication approval or redaction. This readout adds none. |
| L6 docs drift, no CHANGELOG line | Deferred to publication. |

## Validation of `292a5fe`

Pinned images: Node 24.18.0/npm 11.16.0 `sha256:4e9cb555…`; PostgreSQL 16.15 `sha256:ca0bd484…`, 17.11 `sha256:2d2b8998…`, 18.6 `sha256:74935e72…`. Dependencies were installed in a credential-free container with registry access only. Every test, migration and harness container ran with no network, sharing loopback with a disposable database. No host environment, `.env` file or live credential was used.

| Check | Result |
|---|---|
| Lint, typecheck | Pass |
| Unit (no database URL) | 64 files, 877 tests pass |
| Build without database, build with synthetic database | Pass |
| Prisma migrate diff (schema vs migrations), deploy, seed | Pass on 16.15, 17.11, 18.6 |
| Integration | 15 files, 202 tests pass on each of 16.15, 17.11, 18.6 |
| Dump/restore reconciliation and restored schema diff (16.15) | Identical; no difference |
| `synthetic-migrations.sh` | Preservation, 0011 duplicate-index stops and restores pass |
| `synthetic-account.sh` | All refusal, national-format, history-count, commit, replay and restore cases pass |
| `synthetic-concurrency.sh` | Account, national-format inventory, orphan evidence and history writers committed during the lock wait are all refused; the original template reproduces the missed collision |
| `prisma-failure.mjs` | P3018 then P3009; both synthetic events preserved |
| Negative control (new integration tests vs `6a355c6` service/contracts) | 8 fail as expected; the unrelated-number test passes |

The peer-writer concurrency case holds the advisory lock under READ COMMITTED. It shows that any lock holder that isn't SERIALIZABLE was missed. It is not a reproduction against two real SERIALIZABLE setup writers.

Hashes for every log are in [evidence.json](evidence.json). Raw logs are in local `evidence/frl-inactive-20261031-successor/`, ignored by Git. The runner scripts are in [runners/](runners/). Not run: `npm audit` (no network in test containers), CI on any published successor, and any hosted check. Synthetic restore is **not a production restore rehearsal**.

## Remaining release gates

Independent re-review of `292a5fe` and this readout; CI on any explicitly approved published successor; owner decisions on industry, timezone, contact, disclosure and the publication scope (L5); authorized target readback, including the exact `expected_account_json` and `expected_phone_references`; an approved migration and account execution mechanism; authenticated hosted operator access; old-deployment and in-flight-worker containment; diagnostic cleanup against the verified readout timestamp; protected storage, privileges, current allowance and explicit approval before any real export; and explicit release authorization.
