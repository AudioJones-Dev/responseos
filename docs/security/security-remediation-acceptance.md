# Security remediation acceptance contract

Status: documented investigation gate with a separate manual CI proposal; not an activated required CI check. Existing CI security checks remain unchanged. This contract does not accept the current braces prototype or authorize integration.

A dependency remediation qualifies as complete only when every row below passes for the same candidate commit and exact lockfile. A security pass cannot compensate for a compatibility failure, and vice versa. Missing evidence is UNKNOWN and blocks acceptance.

| Required gate | Acceptance evidence |
| --- | --- |
| Provenance and reproducibility | Maintained release or genuinely repaired source with license, immutable identity, lock integrity and successful clean install; no disguised vulnerable implementation |
| Complete dependency security | Full npm audit JSON and exit status, with no exceptions or suppressions; for this mission zero findings. Existing CI npm audit --audit-level=high must remain enforced in both jobs. No production-only substitute. |
| Behavioral compatibility | All 49 original cases, all 441 expanded directory cases including order/multiplicity, all 584 exact task cases including the known 36 defects; no cases silently removed or expectations rewritten to match a candidate. Comparisons cover positive/negative patterns, base grouping, dynamic flags, outputs and errors. |
| Security behavior | Reviewed resource bounds, explicit rejection rather than silent truncation, bounded hostile-input processes, and tests covering the repaired implementation's reachable APIs. The current eight probes alone are insufficient proof. |
| Code-quality preservation | Unchanged required ESLint rules, diagnostic parity on representative fixtures, TypeScript coverage and application behavior; no tool downgrade without demonstrated equivalent protections |
| Application acceptance | npm run lint, npm run typecheck, npm test, npm run build, Postgres 16 migrations/deploy/seed/integration and DB-backed build; both existing CI jobs green |
| Cross-platform acceptance | Windows and Linux at pinned supported runtimes, including paths, links, escaping, task order and errors; OS-specific cases represented rather than omitted |
| Exact-head integration | Record PR #195's then-current head and package/lock identities, preserve its existing security updates, validate the combined graph and repeat all applicable gates in a disposable checkout |
| Maintenance and review | Document limitations, update/rollback procedure, ownership of any custom code, and independent review for a custom parser repair |
| Release authorization | Separate human approval to merge/deploy/activate; a test pass does not grant release permission |

Evidence must identify OS, Node/npm versions, base/candidate commits, dependency identities, timestamp, exact commands, exit codes and raw results. Overlapping fixture counts must not be represented as independent application scenarios. Record confirmed advisory presence separately from demonstrated runtime reachability.

The failed experimental harness is intentionally excluded from ordinary application acceptance until a passing supported candidate exists. Wiring a known-failing prototype into CI is not enforcement of an accepted fix. Before a remediation is promoted, wire reproducible security and compatibility checks into CI in its reviewed change; this document alone does not provide that automation or branch protection.

The separate packaging proposal automates necessary rejection conditions in a manual workflow. It deliberately rejects the current prototype and incomplete evidence. Provenance, diagnostic equivalence, independent review and other human obligations above remain required. See [packaging closure proposal](packaging-closure-proposal.md).

Native packaging execution must pass under containment on each platform. A resolved .node path without successful native loading cannot qualify. Occurrence-level closure and author infrastructure findings are documented in [closure review](closure-infrastructure-review.md); neither is independent approval.
