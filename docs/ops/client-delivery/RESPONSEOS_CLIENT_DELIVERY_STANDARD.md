# ResponseOS Client Delivery Standard

**Status:** Canonical future-client delivery process
**Owner:** AJ Digital LLC / Audio Jones
**Applies to:** Registered future opportunities after the applicable readiness gate

## Delivery sequence

```text
Qualification
→ Paid or approved discovery
→ Evidence intake
→ Current-state workflow and revenue-leak analysis
→ Fit / no-fit decision
→ Future-state design
→ Scope and assumptions register
→ Cost-model planning proxy
→ Implementation authorization
→ Build and QA
→ Client acceptance
→ Launch
→ Hypercare
→ Managed service
→ Telemetry and retrospective
```

No stage authorizes the next stage by implication. The named approval and exit
evidence must exist.

## Stage controls

| Stage | Entry criteria | Primary owners | Required evidence and exit criteria | Blockers and approval gate | Rollback / safe stop |
|---|---|---|---|---|---|
| Qualification | Registered `<CLIENT_ID>` and named decision-maker | Audio; prospect owner | Qualification intake; problem, authority, human exception owner, constraints, facts/assumptions/unknowns; fit/defer/no-fit decision | Unsafe/regulated scope without review, no authority, no evidence owner; R1 fit approves discovery planning only | Close as no-fit or defer without system access |
| Paid or approved discovery | R1 fit and discovery terms approved | Audio; client approver | Discovery objective, scope, fee/approval status, data-transfer method, owners, stop conditions | No client approval or unsafe evidence-transfer method; R2 discovery authorization | Withdraw request; retain only approved records |
| Evidence intake | Approved evidence request | Client evidence owner; AJ Digital reviewer | Receipt log, sources, dates, evidence classes, access restrictions, missing items | Credentials or unnecessary sensitive data supplied; stop and remediate transfer | Reject, quarantine, or request redacted evidence; do not copy secrets |
| Current-state workflow and revenue-leak analysis | Minimum evidence available | Audio; client process owner | Approved current-state map, system/source-of-truth register, leak model, data-quality limits | Contradictory sources, missing policy, unreliable baseline | Preserve conflicting evidence and mark unresolved |
| Fit / no-fit decision | Discovery findings reviewed | Audio; client approver acknowledges facts | Decision rationale, constraints, next evidence, and whether design may begin | Automation would scale a broken process or ROI path is not measurable | No-fit or defer; no proposal or build |
| Future-state design | Fit after discovery | Audio; solution owner; client policy owner | Desired workflow, intent/exception boundaries, human handoffs, data fields, prohibited actions, dependencies | Unapproved policy, unsafe autonomy, missing exception owner | Return to current-state/design review |
| Scope and assumptions register | Future state reviewed | Audio; client approver | In/out scope, deliverables, responsibilities, assumptions, unknowns, dependencies, acceptance and change control | Scope depends on unresolved architecture or client policy | Version the scope; revert to last approved version |
| Cost-model planning proxy | Scoped WBS and evidence available | Audio; finance/operations reviewer | Low/most-likely/high inputs, evidence classes, vendor responsibility, support reserve, P50/P80 planning proxies if supported | Unsupported hours, rates treated as prices, hidden variable usage | Preserve `unknown`; do not calculate or quote |
| Implementation authorization | R3 packet complete | Audio; client approver; technical owner | Approved implementation plan, branch/environment, security, QA, rollback, telemetry, acceptance, stop conditions | Load-bearing conflict, live-provider/deploy gate, secrets, destructive change | No build until scope-bound explicit `proceed` |
| Build and QA | Scope-bound `proceed` and repo/provider gates satisfied | Named technical owner; QA/security reviewers | Versioned work record; required repo validation; tenant isolation; signature validation; mock fallback; risk dispositions | Scope expansion, security issue, unresolved failures, missing rollback | Stop, revert bounded changes, restore last known good profile/build |
| Client acceptance | QA evidence complete | Client acceptance owner; AJ Digital owner | UAT scenarios, defects and dispositions, acceptance record, training/readiness gaps | Critical defect, unsupported behavior, incomplete client policy | Return to build/QA; no launch |
| Launch | Separate launch/deploy approval and readiness packet | Audio; technical release owner; client operator | Release record, smoke test, telemetry, operator training, rollback checkpoint, support boundaries | No production authorization, no tested rollback, ownership ambiguity | Abort launch or restore last-known-good route/profile/deploy |
| Hypercare | Launch accepted | AJ Digital support owner; client operator | Time-bounded log, daily exception review, incidents, usage, decisions, exit criteria | Undefined window, after-hours expectation, uncontrolled scope | Pause feature, route to human fallback, extend only by approval |
| Managed service | Hypercare exit approved and commercial/support boundaries accepted | AJ Digital service owner; client owner | Service review, incident/change records, usage reconciliation, knowledge/policy changes, outcome evidence | Unfunded support burden, uncapped usage, unresolved recurring defect | Degrade/pause bounded features; invoke change control or termination plan |
| Telemetry and retrospective | Attributable delivery/usage/support data available | Audio; operations/data reviewer; client reviewer where applicable | Estimated-vs-actual review, benchmark replacements, decisions, follow-ups, archived evidence | Data not comparable or not attributable | Keep values unknown; do not promote to portfolio actuals |

## Owners and approval roles

Each engagement records named people for:

- AJ Digital engagement owner;
- client decision-maker;
- client process/evidence owner;
- technical implementation owner;
- QA and security reviewers;
- client acceptance owner;
- launch and rollback owner;
- managed-service and exception owners.

One person may fill multiple roles, but the role and approval must still be
recorded.

## Evidence discipline

Each material statement is one of:

- fact supported by Client actual or AJ Digital actual;
- client or AJ Digital decision;
- external benchmark or calculated derivative;
- planning assumption;
- unknown.

Evidence records include source, date, owner, confidence, access restriction,
and contradiction status. Client-specific evidence never becomes global canon
without a separate review.

## Implementation safety

All implementation work inherits the platform canon:

- tenant isolation on every read/write;
- webhook signature validation before mutation;
- event-ledger-first behavior;
- mock fallback when provider credentials are absent;
- no secrets in the repo;
- no Firebase;
- no production deployment until the repo's readiness gates and a separate
  human approval clear;
- ResponseOS is not represented as HIPAA-certified.

The client implementation plan links to the existing security, QA, runbook,
deployment, and observability authorities instead of copying them.

## Change and rollback control

- Version scope, assumptions, policies, profiles, and acceptance evidence.
- Treat new requirements as change requests; do not hide them in defect work.
- Use the least-destructive containment option first.
- Record what can be reverted, the last-known-good state, the rollback owner,
  the validation after rollback, and any irreversible residue.
- Deletion, destructive migration, production routing, credentials, public
  commitments, and material commercial changes require separate explicit
  approval.

## Completion definition

An engagement is not "complete" merely because a build launched. Completion
requires client acceptance, hypercare exit, managed-service or offboarding
decision, attributable telemetry, retrospective, and an archived decision trail.
