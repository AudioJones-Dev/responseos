# Production packaging closure and joint gate proposal

Status: FAIL / HOLD. This branch contains investigation tooling and a manual CI proposal, not a dependency remediation. PR #195 and application dependencies are unchanged. No workflow was dispatched, production deployment performed, worker activated, or provider contacted.

## Identity and reproduction

Application snapshot: PR #195 commit `4e1f353117696658988bca171e4e0e51c0fb1b96`. Proposal base: master `3252a6de9c8a40992b3edc655c05ffbe73459194`. Windows verification uses Node 24.18.0 and npm 11.16.0. Earlier evidence commits d5c82dd, e54913f, b4435a2, 8ffbca6, and 2a18cb2 remain preserved in the original isolated investigation clone.

The runner exports the immutable application commit into a fresh temporary checkout, installs its complete lockfile, records the full audit, generates Prisma, and builds production artifacts with authentication required and no provider credentials. It records package/configuration hashes and all artifact hashes. Ambient application environment files are not copied. Set `SECURITY_NPM_CLI` to the pinned npm CLI and run:

```sh
node scripts/security/braces-ci.mjs
```

The application commit defaults to the pinned snapshot above; a reviewed full commit hash can be supplied through `SECURITY_APPLICATION_SHA`. Raw local evidence is under `.security-evidence/`. The committed snapshot is in [packaging-proposal-evidence](packaging-proposal-evidence/verification-report.json); its readable report and closure summaries accompany `raw-evidence.tar.gz`, which preserves the complete raw evidence and its evidence-index SHA-256 inventory. Archive extraction and all inventory hashes were verified. Extract into an empty directory before validating the full inventory; only selected readable copies are beside the archive. `archive.json` records the archive hash. Absolute temporary paths in that snapshot document this run rather than portable paths. Never reuse an old report as evidence for a different application or tooling identity.

## Evidence matrix

| Gate | Windows evidence | Decision |
| --- | --- | --- |
| Clean pinned production build | Fresh export, complete install, Prisma generation and build succeed | PASS for this snapshot/platform |
| Application lint / typecheck | Both succeed | PASS |
| Application unit regression | 668 tests across 57 files pass | PASS |
| Public / protected-denial / missing-page HTTP | Nine loopback GET checks pass | PASS within tested scope |
| Mocked auth and tenant execution | 97 tests pass under module tracing; affected-package loads not observed | PASS for synthetic tests only |
| Original matcher comparisons | 49/49 | PASS |
| Expanded ordered directory comparisons | 441/441 | PASS |
| Glob-task semantics | 548/584; all 36 failures retained with inputs/expected/actual | FAIL |
| Hostile-input probes | Eight bounded probes pass | PASS within probe scope |
| Complete application dependency audit | Five high findings in pinned exact-lock graph | FAIL |
| Candidate linked to audited application graph | Prototype exists only in harness | FAIL |
| Production packaging closure | 140 unproven occurrences | UNKNOWN / HOLD |
| Clean Linux output | Manual hosted proposal prepared, not executed | UNKNOWN / HOLD |
| Postgres 16 integration and database-backed build | Hosted proposal prepared, not executed | UNKNOWN / HOLD |
| Independent parser review / diagnostic parity / provenance | No accepted implementation established | UNKNOWN / HOLD |

Counts overlap; they are not independent production scenarios. Five findings remain reported audit findings, not five demonstrated independent exploits. The isolated matcher audit is not the application audit.

## Packaging findings

The closure ledger records every unresolved/computed occurrence with file, line, containing function, enclosing guards, input expression, source SHA-256, serialized build configuration where relevant, and a proposed category. The current groups are 36 platform-specific native alternatives, 27 framework aliases, seven optional imports, and 70 computed loads. All 140 remain UNKNOWN. These categories are hypotheses for review, not proof that a particular branch is inactive or a target is present. An unrecognized literal is classified missing and fails the gate.

No affected package was identified in the inspected package inventory or trace entries, and no original implementation fingerprint was found. String hits in framework metadata/comments are retained separately. Negative search results do not establish complete runtime absence. Hashes, complete trace entries, computed imports and runtime observations are retained for scrutiny.

Windows standalone output contains two Prisma directory links to the build checkout. The runtime trial materializes links in a separate directory, inventories the resulting ordinary files, and blocks module resolution outside that directory. It records zero escape events and verifies package files did not change; permitted route-cache additions are identified separately. This establishes containment for the copied package and tested paths, not hermeticity of the original linked standalone output or every deployable environment.

The HTTP checks cover health, marketing, both demos, authenticated-surface denials, and a missing-page error. Successful authenticated production HTTP is not claimed. The separately traced auth/tenant tests mock sessions and data adapters and include test tooling loads. Neither trial exercises production provider writes. Instrumentation controls verify an affected-package load can be detected and an outside-root load rejected.

## Proposed enforcement and limits

[security-packaging-proposal.yml](../../.github/workflows/security-packaging-proposal.yml) has only `workflow_dispatch`, read-only repository permission, Windows/Linux artifact jobs, a Postgres 16 integration job, and a final acceptance job. Existing application CI, audit thresholds and deploy controls are unchanged. No branch-protection setting has been changed. The workflow is a review proposal and has not been registered or dispatched from the default branch.

Diagnostic collection continues after audit or comparison failures so evidence uploads are available; the separate final job fails on any audit finding, known semantic defect, unresolved packaging closure, absent application-linked implementation, failed regression, or missing platform/integration evidence. Report SHA identities, tooling/fixture hashes and uploaded file hashes must agree. The committed pinned snapshot is an intentional negative control and must fail acceptance. A diagnostic job finishing successfully is not remediation acceptance.

This proposal automates necessary rejection conditions; it does not automate all acceptance-contract review obligations. Provenance, maintenance/license review, representative ESLint diagnostic equivalence and independent review still require explicit evidence before promotion. The current eight hostile probes are not exhaustive security proof. A future maintained alternative needs reviewed implementation-link verification and comparison coverage; changing report flags or installing a prototype solely in the matcher directory cannot qualify.

## Decision and sequence

1. Keep integration with PR #195 on hold. Review this tooling proposal separately; keep it draft while application/security CI is blocked.
2. Review the occurrence-level ledger. Close each alias/native/optional/computed mapping with actual emitted-target or inactive-guard evidence, and retain UNKNOWN for anything unproved. Materialization on Windows is not a Linux packaging result.
3. After workflow registration/dispatch is separately authorized, collect clean Linux and Windows artifacts and Postgres integration evidence without deployment. Verify every uploaded hash, exact source identity, and native package selection. Diagnose any failures before advancing.
4. Select a maintained, secure, semantically equivalent implementation or a separately reviewed parser repair. This proposal makes no application dependency change and accepts no exception.
5. Validate that implementation against the complete application graph, frozen 584 task cases, original/directory cases, hostile probes, diagnostic parity, full regression, both platforms and integration. Update the acceptance tooling through review to validate the selected implementation's real identity.
6. Only after all automated and manual gates pass, export PR #195's then-current exact head into a disposable combined checkout, apply the reviewed fix, and repeat complete audits and acceptance against its exact dependency versions and lockfile. Human approval remains required for integration, merge or deployment.

Maintenance owner: Codex prepares evidence; the repository maintainer approves the workflow and any eventual custom-code ownership. Keep pinned runtimes/fixtures deliberate, preserve failures, re-capture hashes after source changes, and treat incomplete artifacts as failure. Rollback of this proposal removes only its new manual workflow, tooling, fixtures, report and dashboard task; no application dependency rollback is involved.

## Supplemental occurrence and infrastructure review

The [closure and infrastructure review](closure-infrastructure-review.md) supersedes the packaging-closure assessment above: four source-file exclusions and 28 inactive Windows platform branches are supported, 108 occurrences remain UNKNOWN, and a contained Sharp image probe now fails on the inspected Windows standalone package. Two native DLLs are absent from that copy. Earlier HTTP and application test results remain scoped historical evidence, not proof of native image execution. Repeatable rejection controls are now committed; independent review and hosted validation remain pending.
