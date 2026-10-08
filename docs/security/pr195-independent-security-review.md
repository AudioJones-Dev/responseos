# PR 195 independent security review package

Status: **AWAITING INDEPENDENT REVIEW — exception inactive, merge blocked.**
Prepared October 8, 2026 UTC. Owner assignment is based on the human request in
this chat, not a legal-identity or contractual-authority verification.

## Roles and authorization

| Role | Assignment / status |
| --- | --- |
| Accountable business risk owner | Human requester, self-identified sole owner of ResponseOS; personal/legal name not supplied |
| Engineering owner | Same human owner, with Codex assisting |
| Independent security reviewer | Qualified human reviewer to be appointed; no review or approval recorded |
| CI implementation | Codex only after explicit authorization following security approval |
| Final merge authority | Human owner, subject to required checks and separate PR review |

Assigning ownership does not accept this exception. Business-risk acceptance,
technical security approval, policy implementation authorization and merge
authorization are separate pending decisions. Any contractual/organizational
requirement for another authority must be confirmed by the owner. This package
and Codex's recommendations are not independent certification. No reviewer has
been contacted or commissioned by Codex.

## Decision requested

Approve, conditionally approve or reject temporary acceptance of
GHSA-vfj7-8cjw-p6xm solely in this development dependency chain:

`eslint-config-next@16.3.4 → @next/eslint-plugin-next@16.3.4 → fast-glob@3.3.1 → micromatch@4.0.8 → braces@3.0.3`.

Business justification: unblock complete validation and review of the isolated
persistence foundation without removing lint coverage or adopting an incompatible
replacement. This does not authorize release, deployment, a worker or CRM writes.
Proposed expiration: **2026-10-14T23:59:59Z**, with no automatic renewal.

Reviewed application/dependency state: 41a0468; PR head verified before preparing
this documentation: b119e8ca9582c706a177ccbab5f158e1b2950518. That head only adds
documentation/dashboard changes over 41a0468. Lockfile SHA-256:
`eda48be9078f6a00480d683dd7f305ceebaa36cbc8a5f3a84038043b3fb26f2d`.

## Evidence index

- [Disposition and proposed exception](./pr195-braces-disposition.md).
- [Dependency/advisory ledger](./pr195-dependency-evidence.md), including linked before/after raw audits.
- [Instrumented execution evidence and reproducible probe](./pr195-braces-execution-evidence.json).
- [Local validation and limitations](../readiness/frl-ledger-persistence-validation.md): 668 unit, 174 database and 52 projection tests; builds and migration recovery checks passed locally, not CI approval.
- [Exact b119e8c CI](https://github.com/AudioJones-Dev/responseos/actions/runs/37708731248): both jobs failed audit after successful installation; downstream checks skipped.
- [Current CI policy](../../.github/workflows/ci.yml): full high-threshold audit in both jobs, no exception facility.
- Failed direct tinyglobby trial: separate local branch codex/braces-compatibility-trial, commit 911f831. Not included in PR 195 and not published remotely. Supplied alongside this package as `trial/pr195-tinyglobby-trial.md`, raw results and probe; 3/13 Windows cases match. Linux and replacement regressions were not run after failure.
- [Primary advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): stack-exhaustion denial of service; no published patched version at the last readback.

## Assessment for independent challenge

Provisional engineering classification: **Moderate contextual residual risk;
advisory severity remains High.** Lint loads the affected code, but no monitored
parser/expansion calls occurred in the recorded local run. Configured rootDir
patterns are the identified entry point; none is configured. No customer-input
route was found. Repository/configuration input could become hostile or change
reachability. Process/job failure and developer disruption remain credible.

Dev-only lockfile flags, absent application imports and 193 local build traces
support limited production exposure, not universal non-reachability. Deployed
artifacts, Linux dynamic paths and transitive installation execution were not
independently verified. No exploit success or complete safety claim is made.

Implemented controls: hosted Ubuntu runners, contents-read token permission,
synthetic test DB, unchanged lint/typecheck/test/build requirements and disabled
automatic Git deployments. Proposed controls, not implemented: explicit job
timeouts; verification that CI receives no production/provider credentials;
reviewed lint/workflow/dependency configuration; protected approval records;
production-artifact exclusion verification before any separately authorized deploy.

## Proposed enforcement, not executable policy

If separately authorized, retain the full raw npm audit and evaluate only the
exact advisory causes, five approved lockfile nodes/versions, dev-only flags and
lockfile hash. Do not blanket-ignore package names. Any new advisory cause on an
otherwise approved package must remain subject to the existing security gate.
Block every other high/critical finding; retain lower-severity findings visibly.
Fail closed on expiry, missing approval, malformed/unknown audit output, registry
errors or scope drift. Keep the raw finding visible as accepted risk, not a clean
audit. The evaluator and approval record must not be self-authorizable by an
untrusted PR. No severity reduction, omit-dev audit, continue-on-error or blanket
suppression is permitted.

Before merge eligibility: approved controls and separately reviewed evaluator;
tests covering mixed advisories, scope drift, expiry, absent approvals and scanner
failure; both complete CI jobs passing on the resulting exact commit; independent
persistence review. Reassess daily during the exception and before merge.
Revoke on new exposure, incident, control failure, changed scope/configuration,
or availability of a verified compatible fix. Remove the exception after repair.

## Human decision record — intentionally blank

| Required field | Reviewer/owner to complete |
| --- | --- |
| Risk-owner identity and confirmation of authority | PENDING |
| Independent reviewer identity, qualifications and independence | PENDING |
| Technical decision: approve / conditional / reject | PENDING |
| Assessment of production and CI exposure; accepted uncertainties | PENDING |
| Required controls and evidence of their completion | PENDING |
| Approved advisory, nodes, hash and expiration | PENDING |
| Business-risk acceptance, signature/reference and timestamp | PENDING |
| Technical approval, signature/reference and timestamp | PENDING |

After this record is completed, explicit authorization is still required before
Codex changes CI policy. PR 195 stays draft. PR B, workers, live HubSpot writes and
production changes remain unauthorized; G02-G07 remain open.
