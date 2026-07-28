# ResponseOS Future-Client Readiness Standard

**Status:** Canonical pre-client operating standard
**Owner:** AJ Digital LLC / Audio Jones
**Applies to:** Future ResponseOS opportunities only

## Current truth

```text
Active ResponseOS client: no
Current phase: pre-client service-system staging
Validated installation hours: no
Validated gross margins: no
Validated support burden: no
Empirical P50/P80: no
Public pricing authorized by this task: no
```

AJ Digital may prepare reusable delivery materials, conduct internal scenario
planning, and qualify a real prospect after it is registered. AJ Digital may
not treat a hypothetical profile as a client actual, quote from the internal
cost model, claim validated unit economics, or begin implementation under this
standard alone.

## Evidence posture

Every readiness claim must be classified using the evidence classes in
[`RESPONSEOS_COST_MODEL_STANDARD.md`](./RESPONSEOS_COST_MODEL_STANDARD.md).
Unsupported values remain `unknown`. A checklist completion is evidence that a
review occurred; it is not evidence that the underlying business fact is true.

## R0 — Internal service readiness

**Purpose:** Confirm AJ Digital can explain, qualify, scope, and govern the
service without implying implementation readiness.

**Entry criteria:**

- ResponseOS product and architecture canon is indexed.
- The client-delivery standards and templates are available.
- No client-specific data has been inserted into reusable templates.

**Required evidence:**

- service definition and anti-scope;
- current qualification heuristics and disqualifiers;
- delivery sequence and approval gates;
- support planning objectives;
- vendor ownership and billing-boundary worksheet;
- risk, evidence, assumptions, cost, and approval templates.

**Owner:** Audio.
**Reviewer:** Codex or another named reviewer.

**Exit criteria:**

- every provisional value is labeled;
- pricing and SLA conflicts are linked to the canon reconciliation;
- templates contain no active-client assumptions;
- the owner records `R0 approved` with date and evidence links.

**Blockers:** unresolved canonical contradiction that would change product
architecture, public pricing, live-provider doctrine, or production readiness.

**Gate:** R0 approval authorizes prospect qualification only. It does not
authorize outreach, quoting, implementation, provider purchase, or deployment.

## R1 — Prospect qualification

**Purpose:** Decide whether a registered prospect should enter discovery.

**Entry criteria:**

- a real opportunity identifier exists;
- a decision-maker and evidence owner are named;
- the qualification intake uses `<CLIENT_ID>` until the identifier is approved.

**Required evidence:**

- business problem and desired outcome;
- demand/channel pattern and available volume evidence;
- current workflow, CRM, scheduling, and source-of-truth posture;
- human exception owner;
- safety, privacy, consent, and regulatory screen;
- access authority and budget posture;
- current heuristics evaluated without treating them as universal thresholds.

The existing `$300+` average-job-value and `20+` missed-calls-per-month figures
are current planning heuristics from the commercial canon. They are not
validated universal thresholds and may not override client actuals or a
documented fit rationale.

**Owner:** Audio.
**Client role:** Prospect decision-maker or authorized operator.

**Exit criteria:** Fit, defer, or no-fit decision with evidence, assumptions,
unknowns, and next action recorded.

**Blockers:** no decision authority, no evidence access, no exception owner,
uncapped-autonomy expectation, unsafe/regulated scope without specialist review,
or an expectation that AJ Digital absorb uncapped variable usage.

**Gate:** `R1 fit` authorizes bounded discovery planning only.

## R2 — Discovery authorization

**Purpose:** Authorize a bounded request for evidence and current-state
diagnosis.

**Entry criteria:**

- R1 fit decision approved;
- discovery scope, fee/approval status, data-minimization boundary, and evidence
  transfer method recorded;
- client and AJ Digital discovery owners named.

**Required evidence:**

- 60–90 days of relevant communication data where available;
- current workflow, handoffs, failure points, and exception examples;
- systems, owners, and sources of truth;
- policies for hours, consent, retention, escalation, and permitted actions;
- baseline definitions and known data-quality limitations.

**Exit criteria:**

- evidence receipt log complete;
- current-state workflow and revenue-leak analysis reviewed;
- risks, contradictions, and missing evidence classified;
- client confirms factual accuracy of the current-state record;
- AJ Digital records fit, defer, or no-fit after discovery.

**Blockers:** unsafe data transfer, missing authority, unresolved source-of-truth
conflict, undocumented policy that cannot be approved, or discovery showing the
process must be repaired before automation.

**Gate:** R2 approval authorizes discovery only. It does not authorize system
writes or implementation.

## R3 — Scope and implementation-readiness decision

**Purpose:** Translate approved discovery evidence into a bounded future-state
design, scope, cost planning proxy, and implementation decision.

**Entry criteria:**

- R2 outputs are approved;
- future-state behavior, prohibited behavior, and human escalation ownership are
  defined;
- applicable security, QA, and deployment authorities are linked.

**Required evidence:**

- future-state workflow and exception taxonomy;
- scope and assumptions register;
- integration and dependency inventory;
- WBS-linked low/most-likely/high effort inputs;
- vendor-cost and commercial-responsibility boundaries;
- support reserve and planning objectives;
- risks, acceptance criteria, rollback, and telemetry plan;
- `P50 planning proxy` and `P80 planning proxy` only if the model supports them.

**Exit criteria:**

- every unsupported value remains `unknown`;
- every estimate has an evidence class and source;
- current canonical platform decisions are preserved;
- client and AJ Digital responsibilities are explicit;
- implementation plan includes validation, stop conditions, and rollback;
- Audio records one decision: authorize a separately scoped build, defer, or
  no-fit.

**Blockers:** unresolved architecture conflict, unapproved public/commercial
terms, missing client policy, unsafe integration boundary, no rollback path, or
an unbounded support/usage commitment.

**Gate:** R3 readiness does not itself authorize a build. A separate explicit
`proceed` tied to the approved implementation scope is required.

## Readiness status record

```text
Opportunity identifier: <CLIENT_ID>
R0 status: unknown
R1 status: unknown
R2 status: unknown
R3 status: unknown
Current blocker: unknown
Evidence package: unknown
AJ Digital decision: unknown
Client decision: unknown
Next authorized action: unknown
Production deployment authorized: no
```
