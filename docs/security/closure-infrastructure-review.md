# Closure and verification infrastructure review

Status: FAIL / HOLD. This is the implementation author's inspection and reproducible control evidence, not independent approval. PRs #195 and #197 remain draft/held as applicable; no hosted workflow, merge, deployment, provider write or security exception occurred.

## Occurrence decisions

The [JSON matrix](closure-review/occurrence-closure.json) and [readable matrix](closure-review/occurrence-closure.md) retain IDs 1–140 from the pinned Windows snapshot `4e1f353117696658988bca171e4e0e51c0fb1b96`. Every row has source hash/location, import kind/expression, category, exact branch/exception context, package scope, duplicate linkage, proposed target, closure proof, runtime reachability and remaining obligation.

| Evidence obligation | Result | Meaning |
| --- | --- | --- |
| Build-only source files | 4 closed for this package | Hash-verified files absent from the inspected runtime inventory; this does not exclude embedded equivalents or other deployment packaging |
| Inactive Sharp platform branches | 28 closed for Windows x64 | Actual selector returns win32-x64; matching source contains a terminating Windows case, while these cases select other platforms |
| Remaining occurrences | 108 UNKNOWN | Alias, optional, computed and fallback mappings still require evidence |
| Duplicate copies | 6 linked, retained | Already included in the 140; not additional distinct vulnerabilities |
| Overall package acceptance | FAIL | Native image execution fails, and unresolved mappings remain |
| Full audit / task semantics | Five findings / 36 defects retained | Dependency remediation remains blocked |
| Linux / Postgres / independent review | Not performed | No cross-platform or review acceptance claim |

The scope totals are four build-only occurrences, six duplicated runtime copies and 130 standalone occurrences. Closure of 32 obligations is narrow and does not establish absence of vulnerable runtime paths. A loaded module is not proof of an individual import's execution. Catch handling, a condition's presence or a package-name match alone cannot close a row. The instrumentation import's development and production branches remain distinct; neither is silently removed.

## New native packaging defect

The original materialized standalone package fails to load Sharp with `ERR_DLOPEN_FAILED`. The same pinned installed dependency tree successfully creates a 90-byte one-pixel PNG under Node 24.18.0 with the clean environment and containment hooks. Its native package contains `libvips-42.dll` and `libvips-cpp-8.18.7.dll`; both are absent from the inspected standalone copy. The DLL hashes and module observations are captured in [native comparison](closure-review/native-packaging-comparison.json).

This is observed native execution failure, with missing DLLs as supporting packaging evidence. It is not a newly proven security vulnerability. No DLLs were copied into the inspected package and no application configuration or dependency was repaired. Exact causality and a maintained packaging correction require review.

The nine earlier HTTP paths did not exercise image processing. The updated runtime verifier adds a contained image operation and exits nonzero when native execution fails. Its fresh loopback run still completes nine probes, but the overall verification fails on native execution. The aggregate gate independently requires corroborated native success; older reports without this evidence cannot qualify.

## Author infrastructure findings

| Control / burden | Inspection | Disposition |
| --- | --- | --- |
| Permissions and triggers | Manual-only trigger; contents read; checkout credentials not persisted; no secrets context or deploy command | Configuration passes author inspection; actual hosted behavior unverified |
| Installation boundary | Root npm ci and pinned npm installation execute on a networked hosted runner; full audit findings remain | BLOCK hosted approval until reviewer accepts the installation trust boundary; this is not a network sandbox |
| Child environments | Application build/probes use an explicit environment allowlist and local URLs; integration has disposable database credentials | No configured provider secrets; inspect installer execution separately from sanitized child environments |
| Runner/data isolation | Hosted Windows/Linux proposals; Postgres 16 test service, no production URLs or persistent-volume configuration | Proposed isolation only; no actual Linux/Postgres proof |
| Evidence integrity | Required raw records, inventory completeness, relative paths, no links, file hashes, raw/summary consistency and source/tool identity checks | Repeatable controls pass; hashes prove integrity, not authenticity of a trusted run |
| Failure behavior | Missing/duplicate platforms, corrupt/malformed/incomplete evidence, unknown closure, native failure and failed/cancelled/skipped integration reject acceptance | Controls committed and wired before diagnostic collection; synthetic positive control explicitly labelled |
| Integration provenance | Final job receives GitHub integration status; integration job does not upload a structured exact-lock command report | BLOCK promotion until source/lock/command evidence is captured and independently checked |
| Implementation linkage | Current comparator specifically detects the experimental matcher path, never an accepted maintained solution | BLOCK remediation promotion; future candidate requires separately reviewed linkage |
| Action/runtime pins | Node/npm versions pinned; action major tags and Postgres major image tag remain mutable | Immutable-reference review remains a prerequisite for hosted approval |
| Retention | Hosted artifacts proposed for 14 days; committed original archive is about 1.1 MB and persists in Git | Keep original evidence immutable; do not commit dependency trees, complete builds or future routine job output; reviewer must approve retention |
| Dependencies and scope | No application package/lock changes or new npm dependency; existing TypeScript compiler supplies AST analysis | New code is verification-only; public application APIs/types unchanged |
| Unused tooling | braces-reachability.mjs is not called by the workflow; tinyglobby adapter is imported by the frozen comparison harness | Recommend removing/archive-relocating the unused reachability runner during reviewed scope reduction; retain comparator dependencies until corpus is preserved |
| Maintenance | Framework/Sharp source hashes, selector expression, branch semantics, supported runtime and implementation linkage are deliberately narrow | Source drift must stop closure and require review; do not generalize the classifier to guess parser semantics |
| Independent review | Author is the same agent that implemented the proposal | PENDING; neither this document nor passing controls is independent approval |

## Reproduction and validation

Preserve the original archive and verify its hash against archive.json. Extract it into an empty directory; the complete inventory is inside the archive. Supply that directory to the matrix generator. It checks every inventory hash and each occurrence's matching source/hash against the build checkout and runtime directory recorded in the preserved build/runtime summaries.

```sh
node scripts/security/braces-infrastructure.test.mjs .security-evidence/closure-review/infrastructure-controls.json
node scripts/security/braces-gates.test.mjs
node scripts/security/braces-closure-matrix.mjs .security-tools/archive-verification
```

Use Node 24.18.0 and the preserved pinned source artifacts. The generator is intentionally snapshot-specific. If temporary artifacts are unavailable, recreate the pinned build with the existing build runner and explicitly supply its matching paths; mismatching hashes must stop regeneration rather than rewrite original IDs or expectations. A new build with different source hashes requires a new supplemental matrix, preserving the original IDs and mapping changes through review.

The committed repeatable controls cover a synthetic complete pair, absent reports/platforms, duplicates, malformed reports, missing inventory/raw records, corrupt evidence, traversal, links, raw/summary contradictions, native failure, integration terminal states and CLI failure status. AST fixtures cover true/false branches, conditional and short-circuit expressions, try/catch/finally, switch/default and shared case labels. Synthetic acceptance is a test of gate logic, not application evidence.

Tool lint and workflow syntax/Bash parsing are required. Application lint/types/668 unit tests remain historical evidence from the unchanged pinned graph; this phase changes verification tooling, so those application checks were not rerun. The affected native/runtime check was rerun and rejected the package. Source and evidence hashes identify the new tooling separately from the original verification report; historical reports were not relabelled as fresh acceptance.

## Independent reviewer checklist and next decision

An independent human reviewer must reproduce the controls, inspect all 140 decisions and the source/target hashes, verify the Windows switch termination and duplicate accounting, and confirm UNKNOWN remains for unsupported cases. Review native loading and missing DLLs without treating package presence as execution success.

Resolve the installation trust boundary, immutable action/image references, integration provenance and retention findings before approving any hosted route. Require the final gate to reject missing/incomplete/corrupt platform evidence and failed/cancelled integration in an actual reviewed run later. No hosted dispatch is included in this phase.

Track B remains separate: no parser repair or dependency candidate is accepted here. Preserve all 36 regression cases and require a complete zero-finding audit and behaviorally equivalent application-linked implementation before reconsidering PR #195.

## Doctrine section 21 answers

| Question | Answer for this change |
| --- | --- |
| Layer | Trust infrastructure: verification, not application business behavior |
| Built / integrated / deferred | Small evidence adapter and gate tests built; TypeScript/Node reused; hosted execution deferred |
| Live pilot | Clarifies blockers without activating a pilot |
| Evidence | Original archive/IDs preserved; source, native and rejection evidence added |
| Verified outcomes | Technical results only, no revenue or production outcome claim |
| Proprietary learning | Engineering defect evidence, not a new product learning capability |
| Build vs buy | Reuse compiler/package tooling; occurrence mapping is repository-specific |
| Duplication | No CRM/FSM/communications/workflow business capability duplicated |
| Lock-in | File-based reports, standard Node tooling; no new service dependency |
| Tenant isolation | No tenant data-layer or production request contract change |
| Attribution ambiguity | Snapshot/platform/duplicate/source-file closure explicitly separated |
| Public claims | No shipped remediation, universal absence, compliance or independent-review claim |
| Human approval | Existing review/dispatch/merge/deploy boundaries preserved |
| Compliance | No live data or credentials introduced |
| Required now | Addresses the requested closure and verification review obligations |

No new platform architecture, milestone or ADR is introduced. The dashboard task remains Review/blocked. The reviewer may approve verification infrastructure independently only after its own gates pass; that cannot clear permanent-remediation HOLD.
