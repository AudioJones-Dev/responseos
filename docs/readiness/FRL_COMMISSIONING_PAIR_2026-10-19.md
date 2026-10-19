# Local commissioning split-checkout contract

Status: EXPERIMENTAL local synthetic candidate. Activation and automatic transfer remain disabled. This document is identical in the application and control checkouts; exact successor SHAs belong in the external evidence record to avoid circular self-references.

The frozen application is 700459e3f265101a5a514694629591688c762a29, descended from 952280b904cbe3988121d26727097fdf80899030. The frozen control is 2fbd84d0bee92c99cc0d8ab0f1bdc484a95b5f8c, descended from 9b7b8c5c1a66712aa133061aa3413b0b9dd63a10. Preserve all four commits. Application successor owns runtime and browser fixtures; control successor owns deployment workflow, toolchain lock and launcher. Historical deployment scripts in the application are not the authoritative commissioning control. The control checkout is not the application source.

Use the application End call/evidence contract in [application commissioning](FRL_LOCAL_COMMISSIONING_2026-10-19.md) and the control mode/install gates in [control commissioning](FRL_LOCAL_COMMISSIONING_CONTROL_2026-10-19.md). The new control lock and installer supersede any earlier global npm-install instructions. Run scripts/validate-qualification-pair.mjs from the control with application directory, full application SHA and full control SHA. It checks clean exact revisions, identical shared documentation/schema/migrations, pinned engines, disabled automatic Git deployment, tool integrity metadata and disabled orchestration before any I/O. Existing synthetic orchestration tests cover enabled paths with substitutes; this does not prove real CLI compatibility.

## Locked tooling

Node 24.18.0, npm 11.16.0 and Vercel CLI 41.7.0 remain exact requirements. The control commits infra/qualification-toolchain/package-lock.json (lockfile v3), registry SRI for nonbundled dependencies, and SHA-256 metadata for the package/lock and four npm/Vercel entrypoints. Bundled npm files are covered by the npm archive SRI. Installation requires the existing explicit installation approval and activation gates. The installer downloads and verifies the pinned npm bootstrap before extraction or execution, then uses that npm to run ci with lifecycle scripts disabled. It uses a fresh isolated tool directory and empty npm configuration. No credentials enter installation.

setup-node is pinned to official v6.5.0 commit 249970729cb0ef3589644e2896645e5dc5ba9c38; the public tag and GitHub verified commit were checked October 19. [Official commit](https://github.com/actions/setup-node/commit/249970729cb0ef3589644e2896645e5dc5ba9c38). Runtime entrypoint/lock checks detect the covered file changes; they do not attest every installed transitive file against a hostile same-user process. Trusted immutable control checkout and disposable runner remain assumptions. No claim of a vulnerability-free dependency graph is made.

stdin token transport remains synthetic-tested. No real Vercel CLI execution, provider authentication or deployment was performed. Future compatibility experiment needs a separately approved exact control SHA and locked artifacts, disposable runner, named project/account, least-privilege short-lived credential injected by the operator, an explicit read-only command/endpoint allowlist, and reviewed output redaction and credential cleanup. Permission to install is not permission to authenticate, pull environment values, deploy, alias or call a carrier. Do not run the experiment under this local scope.

## Browser and database evidence

tests/e2e/commissioning-fixture.ts accepts only an explicitly marked disposable loopback responseos_test database with responseos role and operator development session. It seeds fictional calls and synthetic retained signature-verification evidence. tests/e2e/commissioning-browser.mjs exercises the real local Next console: End call, double click and repeated requests, stale generation rejection, refresh-only GET, and terminal consent with all fields populated. Carrier ingestion is off and credentials absent; a failed disabled-adapter command is not a carrier acceptance/disconnection test. The fixture's verifiedBytes is a synthetic test seam, not proof of real carrier signature verification. Existing integration suites cover authorization, concurrency, uncertainty and evidence validation.

Run lint, typecheck, unit/build/config checks for both final trees and the existing disposable PostgreSQL 16/17/18 matrix for the application. Preserve all migrations and withdrawal guards. Record initial failures, final tree/commit bindings and owned-container cleanup outside both checkouts in commissioning-integrity-evidence-20261019. Browser tests use a fresh headless browser profile and no user authentication state.

## Deferred review proposals

Expired proof currently produces unconfirmed evidence and does not by itself disable End call. Proposed follow-up: explicit unavailable/expired proof presentation and a separately defined control eligibility rule that never treats expiry as permission to resend a previously claimed command. Preserve immutable terminal consent. This behavior is not implemented here.

End call currently requires a qualification assignment; supervised-pilot assignment remains rejected. Proposed follow-up: define assignment/actor authority and exact-generation eligibility for supervised pilot, then add denial, withdrawal, stale, concurrency and uncertainty coverage before broadening the dispatcher. This behavior is not implemented here. Both proposals require a scope decision before work proceeds.

Doctrine21: (1) deployment trust and test layer; (2) use npm's lock/SRI rather than invent package distribution; (3) addresses observed integrity gap now; (4) retains exact artifact/evidence bindings; (5) no outcome/revenue claim; (6) no learning; (7) no commodity service replacement; (8) no CRM/telecom duplication; (9) existing providers only; (10) app tenant/session authority unchanged; (11) no attribution change; (12) EXPERIMENTAL only; (13) local authoring/verification only; (14) credentials absent and disposable data only; (15) bounded owner-requested review correction, with behavioral expansion deferred.

## Bounded eligibility successor
The expired-evidence proposal above is superseded by the owner-approved [implemented local eligibility contract](FRL_END_CALL_ELIGIBILITY_2026-10-19.md). Frozen review pair is application 5e0581c286690a75407d050153f854315ee17ceb / control 6d07349d85fa3547e837f878953ca0c141d75119. Supervised-pilot End call and real CLI experiments remain deferred. Shared DECISIONS/ROADMAP/api-spec/Doppler/dashboard are now reconciled; configuration differences remain intentional as documented in the eligibility contract.

## Disconnection fact successor
Frozen review pair application deea487eb656cfe53f098831ba7051cb716fdee5 / control 1376180119735d7aea727e7fe14df6645583ef76 is preserved. The successor pair adds owner-approved local migration 0022 (call_disconnected_at) to both checkouts so the prisma tree stays identical; no hosted migration is authorized. End call now fences on the recorded disconnection fact rather than capture end, conversation end or FINALIZING. F2 (account-wide unattributable hangup veto) remains unresolved. [Amendment](FRL_END_CALL_ELIGIBILITY_2026-10-19.md).

## Withdrawal raw-ledger correction

Frozen F1 pair application 0752de433a2ea1fde0c5ae52d86f240a91a0ec7f / control 7a4dc58a44756a8b31ebc889f29edc8b5548c00c is preserved. The local successor serializes raw-history admission with durable withdrawal receipt and preserves receipt-only withdrawal on conversation end. No schema or control behavior changes. [Correction and validation contract](FRL_WITHDRAWAL_LEDGER_RACE_2026-10-19.md). External evidence: commissioning-withdrawal-race-evidence-20261019. F2 remains design-only. The supplied main proposal is reconciled in the external evidence; its CSV, reference model and vendor excerpts remain uninspected.

## Independent receipt successor

Frozen pair 44e45c21e925510c1f9563f7c9f0d63bb2b6744b / 905091b9707bba33d2f376d7ac27bf9666c61b4d is preserved. [Accepted Option B](FRL_WITHDRAWAL_RECEIPT_B_2026-10-19.md) supersedes complete serialization at receipt: preauthorized content may finish, drain is separate. Schema/migration0023 and shared documentation match across the split pair; deployment control remains disabled. External evidence is commissioning-receipt-b-evidence-20261019.

## Partial bounded correction

The later [terminal-error correction](FRL_TERMINAL_ERROR_2026-10-19.md) preserves this partial pair as frozen parents and adds only shared migration0025/docs plus an application exact-error assertion. It does not resolve the dispatch/continuation/runtime blockers below.

Frozen application afa127e6efc9c56065d4d52abf6ed1ae9b5fcdef and control 83f5a6c4c1dda2360e2998c59a39df17ccc7ae73 are preserved. [Partial correction](FRL_BOUNDED_CORRECTION_2026-10-19.md) adds application state guards and per-case environment restoration, with shared migration 0024 and documentation. Control runtime sources retain their existing split-checkout baseline; they are not the application source. End-call dispatch and continuation remain pending policy decisions. Only isolated SQL PG16/17/18 checks have run for this successor; full final-tree runtime and pair-script validation remain NOT RUN. External evidence: commissioning-bounded-correction-evidence-20261019. Activation remains disabled.


## Operator send boundary successor
Frozen application 7bef9f11a1d3bd0111121d532a2da65e63890bac / control 67c2c65ae6405485f5929fcccc145793c26228c0 remain preserved. Their isolated runtime checks are complete in isolated-runtime-validation-20261019/CONTINUATION_RESULT.md; previous NOT RUN statements above are historical. [Owner-approved operator-only successor](FRL_OPERATOR_END_CALL_2026-10-19.md) preserves all migrations and disabled control policy. External successor evidence: operator-endcall-evidence-20261019.


## Database-only recovery successor
Preserve frozen app45a4ade0cbd6e9a31b28e94d862b093a3e08d205/control dc6ad87dc7f2dad5efd5d1eba21643fa61527ff4. [Narrow recovery](FRL_WITHDRAWAL_DATABASE_RECOVERY_2026-10-19.md) changes app database stages and presentation only; shared docs/dashboard match, Prisma and all25 migrations remain identical, control remains disabled. Exact successor evidence is external in withdrawal-recovery-evidence-20261019.
