# Release-baseline gap register — 2026-10-31

Status: `DOCUMENTED_ONLY`. This is a current-state register for the first client launch. It is not a production certification and it authorizes nothing. It covers step 1 of the launch path: reconcile the baseline, secure staging (Gate A), supervised live pilot (Gate B), one client, then expand. [Gate definitions](./RESPONSEOS_V0_3_READINESS_GATES.md) and the [client readiness standard](./client-delivery/RESPONSEOS_FUTURE_CLIENT_READINESS_STANDARD.md) govern.

## Baseline

| Item | Value | How verified |
|---|---|---|
| `master` | `329b6e38a7e00f75847e6856c3b4e6d339847af5` (#219 merge) | GitHub branch API, 2026-10-31 |
| Production deployment | `dpl_12D5iWkrbt41f7Py53DQee3L4iJp`, commit `523e179`, created 2026-10-29 02:04:46 UTC | Vercel project `targets.production`, read-only |
| Master commits not deployed | `1df510a` (#216), `329b6e3` (#219) | No Vercel deployment since `dpl_12D5…` |
| Open PRs | 24 (16 draft, 8 ready) | `gh pr list` |
| Registered worktrees | 87 | `git worktree list` |

## Facts settled today (read-only)

| Question | Answer | Source |
|---|---|---|
| Vercel production branch (`responseos`) | `master` | Vercel project API `link.productionBranch` |
| Ignored Build Step | Not set on any of the three ResponseOS projects | `commandForIgnoringBuildStep: null` |
| Git-triggered deployments | Blocked by repository `vercel.json` `git.deploymentEnabled: false` (#100, 2026-07-27). Every open PR branch carries it. | Vercel project API; `git cat-file` per open branch |
| Deploy hooks | None on the three projects | Vercel project API |
| Deployment protection | Vercel authentication on all deployments except custom domains, on all three projects (verified 2026-10-31) | Vercel project API `ssoProtection` |
| Diagnostic readout | One authorized `200` at **2026-10-29 02:43:09 UTC** on `responseos.pro`, `dpl_12D5…`. Removal deadline **2026-11-05 02:43 UTC (2026-11-04 22:43 EDT)**. | Vercel request logs, `requestPath:*database-target*` |
| Assessment price | **$1,500 flat**, ADR-0083 (accepted 2026-10-26). Public pages and `tests/unit/assessment-price.test.ts` agree. Six planning docs were stale. | `git grep` |

## Gap register

Status values follow doctrine §2. "Owner" is who acts. Audio approves anything touching credentials, providers, deployment or commercial terms.

### Step 1 — baseline

| ID | Gap | Status | Evidence | Closes it | Owner | Blocker |
|---|---|---|---|---|---|---|
| B1-01 | Readiness doc says staging has zero deployments | Fixed in this change | Gates doc now carries a dated note pointing at runbook runs `32659300496` / `32663419658` | Merge this change | Codex review | — |
| B1-02 | Dashboard task `14` says no staging URL | Fixed in this change | `dashboard-data.json` | Merge this change | — | — |
| B1-03 | 24 open PRs with no disposition | Open | Table below | Audio picks keep / supersede / close for each | Audio | — |
| B1-04 | Two migration lineages: master ends at `0013`; the FRL pilot stack (#221, #222, `C:/dev/responseos-frl-live`) carries `0014`–`0028`. The FRL live-demo database has `0014`–`0017` applied. | **Decided 2026-10-31: master (`0001`–`0013`) first.** Pilot migrations stay on their branch until separately reviewed and merged. New master migrations use dated names so they never collide with pilot `00xx` names. | `git ls-tree prisma/migrations`; `docs/database/README.md:14` | Apply only master's chain to the release target | Codex | — |
| B1-05 | FRL pilot authorization (2026-10-21) and credential containment (2026-10-22) are not recorded on master | Open | Operator notes only | Record both as ADR or ops entries, with the open containment items | Audio | — |
| B1-06 | ADR-0085 still reads "Proposed, not accepted" although the route was deployed and read | Recorded on `chore/remove-database-target-diagnostic` | `8b1ccef` | Operator records acceptance evidence or the gap | Audio | — |

### Step 2 — launch offer

| ID | Gap | Status | Evidence | Closes it | Owner |
|---|---|---|---|---|---|
| B2-01 | PRD and five other docs said $1,000 with a $750–$1,500 range | Fixed in this change | ADR-0083; `PRD.md`, `product-spec.md`, `pricing-and-onboarding.md`, `client-facing-offer.md`, `brand/RESPONSEOS_WEBSITE_COPY_SPEC.md` | Merge this change | — |
| B2-02 | Founding Client Pilot assessment price | **Decided 2026-10-31: $1,500, same as standalone.** Pilot bundle docs updated | `pricing-and-onboarding.md`, `client-facing-offer.md`, `brand/RESPONSEOS_WEBSITE_COPY_SPEC.md` | — | — |
| B2-03 | Setup and retainer terms | **Decided 2026-10-31 (ADR-0087): default $5,000 setup and $1,500 per month,** adjustable by signed agreement; internal, not public copy. Tier names stay retired from public copy. | ADR-0087, ADR-0028 | Reflect in the first agreement template | Codex |
| B2-04 | Canon reconciliation says public pricing is unpublished; ADR-0083 published $1,500 | Open | `RESPONSEOS_CANON_RECONCILIATION.md:45`; readiness standard `:16` | Update both after B2-02/B2-03 | Codex |

### Step 3 — Gate A (secure staging)

| ID | Gate | Status | Closes it | Owner |
|---|---|---|---|---|
| A1–A8 | Authorization, dedicated target, environment policy, auth flags, credential absence, Neon attestation, migrate deploy, exact SHA | Implemented with recorded hosted runs | Re-run on the release candidate SHA | Codex; Audio approves run |
| A9 | Public `/demo` reachable, protected routes deny anonymous users | `UNVERIFIED_HOSTED` (demo passed; auth pending re-certification) | Authorized read-only `verify-staging-hosted.yml` run passing both 307 probes | Audio + Codex |
| A10 | Invalid Clerk signature mutates nothing | `UNVERIFIED_HOSTED` (unit tests exist) | Staging delivery evidence | Codex |
| A11 | Tenant user sees only the mapped staging account | `UNVERIFIED_HOSTED` (17-case integration matrix) | Authenticated staging smoke | Audio + Codex |
| A12 | Rollback exercised | `MISSING` | Written staging rollback procedure plus a recorded drill | Codex; Audio approves |
| A-DB | Runtime privileges, RLS, backup schedule, RPO/RTO, restore drill | `MISSING` / proposed (ADR-0070 not accepted) | Accept ADR-0070, apply grants on staging, run an authorized restore drill | Audio + Codex |
| A-SEC | Credential containment (2026-10-22): old readiness/signing trust in Vercel `31a58bd` builds and Railway, Railway service variables, pre-reset sessions | Open per operator notes | Close each item; never restore a revoked credential | Audio |

### Step 4 — bounded customer journey

| ID | Gap | Status | Closes it | Owner |
|---|---|---|---|---|
| J-01 | Non-qualified calls get no follow-up task and nothing routes them to a human | **ADR-0086 accepted 2026-10-31 (Option A).** Implementation prepared locally on `feat/human-follow-up-queue` | Review, CI, merge | Codex review |
| J-02 | No escalation, failed-transfer or unresolved outcome is modeled | `MISSING` | Model under ADR-0086 §3 | Codex |
| J-03 | `lib/notifications` is empty | `MISSING` | Separate decision after ADR-0086 | Audio |
| J-04 | CRM retry is manual; `next_attempt_at` has no scheduler | `PARTIALLY_SHIPPED` | Scheduler or documented manual runbook with an owner | Codex |
| J-05 | `/audit` intake stays off until path-scoped WAF shows an observed 429 (ADR-0047 §6) | `UNVERIFIED_HOSTED` | WAF evidence | Audio + Codex |

### Step 5 — Gate B (supervised live proof)

| ID | Gate | Status | Closes it |
|---|---|---|---|
| B1 | Written provider-stage authorization | OWNER_DECISION | Signed Stage D (+G) record |
| B2 | Gate A cleared | Blocked by A9–A12, A-DB, A-SEC | — |
| B3–B7 | Contracts, signature-before-mutation, mock fallback, idempotency, server-owned tenant | Implemented locally for Telnyx/HubSpot; hosted proof outstanding | Isolated-lane invalid/stale/replay and duplicate-effect drills |
| B8 | Production credential posture ADR | OWNER_DECISION | Accepted ADR plus secret-store evidence |
| B9 | Errors, alerts, retry, kill switch, spend limits | `MISSING` (env-flag kill switch only) | Monitoring wiring, alert route, spend limits, failure drill |
| B10 | Outside-number rehearsal and go/no-go | `MISSING` | Evidence packet and recorded decision |
| B-GROK | Readiness-loss cutoff is acceptable only for invited supervised demos | Owner decision 2026-10-20 | Never label customer-ready until a reviewed human fallback replaces it |

### Steps 6–8

| ID | Gap | Status | Owner |
|---|---|---|---|
| R0 | Internal service readiness approval | OWNER_DECISION (status unknown) | Audio |
| R1–R3 | FRL opportunity record, discovery authorization, scope decision | `MISSING` | Audio |
| C-01 | Inactive FRL account preparation | Local successor `292a5fe` validated; independent review pending | Codex review |
| C-02 | Controlled production promotion, monitoring, incident owner | Not started | Audio + Codex |

## Time-boxed items

| Deadline | Item | Prepared | Needs |
|---|---|---|---|
| **2026-11-05 02:43 UTC** | Remove the database-target diagnostic (ADR-0085) | Local branch `chore/remove-database-target-diagnostic` at `8b1ccef` | Review and merge; manual production deployment; confirm the digest variable is absent from production; contain route-carrying deployments and rollback candidates. Each is an Audio approval. |

## Open PR dispositions (Audio decides)

| PR | State | Suggested category | Why |
|---|---|---|---|
| #231 | draft | Supersede with local `work/frl-inactive-successor-20261031` after review | Successor fixes locking, number matching and evidence binding |
| #228 | draft | Review and merge or close | Cutover evidence record |
| #224 | ready | Merge after dashboard conflict check | Automation sync |
| #222, #221 | draft (stacked) | Decide with B1-04 | Carries migrations `0014`–`0028` |
| #217 | ready | Review | Neon/Doppler authority reconciliation |
| #210, #209, #195, #194, #193 | draft | Decide with B1-04 and ADR-0086 | FRL ledger, routing and follow-up preparation |
| #197 | draft | Review for Gate A | Packaging and remediation gates |
| #184 | ready | Reconcile with ADR-0083, then merge or close | Pricing canon predates ADR-0083 |
| #181, #180 | ready | Review | Qualification validation and scoring |
| #177 | ready | Decide with ADR-0086 | Supervised review and follow-up |
| #172 | draft | Review | Review and merge policy |
| #146 | ready | Merge or close | Housekeeping |
| #132, #123, #119, #118, #115, #107 | draft or ready, Aug–Sep | Close candidates unless the first signed scope needs them | Out of first-launch scope per the plan |

## Local branches prepared on 2026-10-31 (none pushed)

| Branch | Head | Content | Validation |
|---|---|---|---|
| `chore/remove-database-target-diagnostic` | `8b1ccef` | Route removal, retirement record, CHANGELOG, dashboard | Exact-SHA isolated run |
| `docs/release-baseline-20261031` | this change | This register, ADR-0086 proposal, ADR-0083 doc alignment, stale-state notes, characterization test | Exact-SHA isolated run |
| `work/frl-inactive-successor-20261031` | `b0f0c2c` (tested `292a5fe`) | Inactive FRL account preparation successor | Recorded in its own readout |
