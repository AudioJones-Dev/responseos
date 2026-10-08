# PR 195: braces security disposition

**Decision: HOLD — risk acceptance requested for review, not granted.**
Assessed October 7, 2026 against application commit `41a0468`.
PR 195 remains draft; no exception, CI change or runtime change is implemented.

## Advisory and execution exposure

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
affects braces <=3.0.3: deeply nested patterns can exhaust recursive walkers.
Five high package findings represent this single advisory, not five distinct
vulnerabilities. Exact installed path, all lockfile `dev: true`:

`eslint-config-next@16.3.4 → @next/eslint-plugin-next@16.3.4 → fast-glob@3.3.1 → micromatch@4.0.8 → braces@3.0.3`.

| Execution path | Evidence and limitation |
| --- | --- |
| Installation | npm ci succeeds in both CI jobs. The project postinstall patches minimatch compatibility, not braces. Transitive install execution was not instrumented. |
| Lint | Local CommonJS instrumentation observes braces/fast-glob loaded, with zero monitored parse/compile/expand/globSync/sync calls. The Next plugin calls globSync for settings.next.rootDir; this setting is absent. |
| Unit tests / build | 668 tests and build pass with instrumentation; no matching CommonJS package loads observed. ESM, bundled copies and unobserved entry points are outside this trace's coverage. |
| Integration | Prior 174 tests pass locally. Integration was not instrumented in this disposition pass; no claim of dynamic non-reachability. |
| Production | Lockfile dev-only classification, clean production-only audit, no application imports and no matching paths in 193 local build traces. Production deployment contents are not independently verified. |
| Actual CI | Both jobs at 41a0468 stop at audit before lint/tests/build. Local Windows Node 24.19 evidence is not Linux Node 24.18 CI execution evidence. |

The temporary trace wraps CommonJS exports and records counts only; a benign
`braces.compile('a/{b,c}')` positive control records compile and parse calls.
No hostile pattern was run. [Reproducible probe and summary](./pr195-braces-execution-evidence.json)
retain the observation method. [Full dependency evidence](./pr195-dependency-evidence.md)
contains registry readback, advisory ranges and before/after audits.

## Mitigations and residual risk

- **Compatible upgrade:** none found. Latest braces is 3.0.3; available upstream
  consumers retain it. Recheck before any approval because registry state changes.
- **Remove functionality:** deleting Next lint rules/config would remove assurance
  and is not accepted as remediation. Runtime behavior alone is an insufficient
  compatibility test for developer tooling.
- **Replace:** a vetted upstream fix or a reviewed glob implementation/adapter could
  remove the chain. API and glob-semantic parity need dedicated tests and a separate
  security PR; an arbitrary package alias is not approved.
- **Isolate:** existing CI uses hosted runners, contents-read permission and a
  synthetic Postgres service. Proposed additional controls are an explicit job
  timeout and verification that lint receives only reviewed configuration, with
  no provider credentials. These reduce impact; they do not repair the parser.

Residual risk is principally local/CI availability if crafted patterns reach the
walker, including after configuration changes. Loaded vulnerable code remains;
non-observation is not proof of safety. No residual-risk acceptance is inferred.

## Exception candidate — not approved or implemented

The current workflow uses plain `npm audit --audit-level=high` in both jobs.
[npm audit documentation](https://docs.npmjs.com/cli/v11/commands/npm-audit/)
offers severity/omit controls, not an advisory-ID allowlist. A scoped exception
requires a separately reviewed policy evaluator; do not raise the threshold,
omit dev dependencies, use continue-on-error or blanket-ignore five package names.

| Required approval record | Proposed value / current status |
| --- | --- |
| Exception ID | PR195-BRACES-2026-10, proposed only |
| Scope | Only this GHSA and its five exact dev-only nodes/versions in the reviewed lockfile; no additional advisory causes |
| Risk owner | Human ResponseOS repository owner or appointed security owner; named individual and acceptance **UNASSIGNED** |
| Approval authority | Explicit designated human security approver; identity/delegation and approval reference **NOT RECORDED**. Codex is not the approver. |
| Expiration | Proposed hard stop **2026-10-14T23:59:59Z**, or earlier upon patched upstream availability, dependency/path/config change or new exposure; no automatic renewal |
| Enforcement | Fail closed on expiry, missing approval, unexpected audit schema/error, changed scope or any other normally blocking advisory; archive complete raw audit including the accepted finding |
| Removal | Replace vulnerable chain, remove exception, rerun raw full audit and complete CI |

Before considering merge: independently approve residual risk and any separate
policy PR, validate evaluator rejection/expiry cases, then run both complete CI
jobs on the resulting exact application commit. Every downstream check must pass;
accepted risk must remain visible rather than reported as a clean raw audit.
Persistence approval remains separate. PR B, live CRM, acquisition activation and
G02-G07 remain deferred/open. This document grants no approval.
