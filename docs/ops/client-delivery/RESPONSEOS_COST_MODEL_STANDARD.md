# ResponseOS Cost Model Standard

**Status:** Canonical internal planning standard
**Owner:** AJ Digital LLC / Audio Jones
**Public pricing:** Not established by this document

## Purpose

This standard separates internal delivery-cost planning from public pricing.
It provides an auditable way to model a future engagement without manufacturing
client facts, AJ Digital actuals, or statistical certainty.

## Evidence classes

| Class | Definition | Permitted use |
|---|---|---|
| External benchmark | Published market, labor, utilization, or vendor evidence | Provisional reference with citation and access date |
| Calculated derivative | Arithmetic derived from cited inputs | Planning input with formula |
| AJ Digital decision | Approved internal commercial or operating policy | Boundary after approval |
| Planning assumption | Necessary provisional value without direct actual evidence | Scenario only |
| AJ Digital actual | Measured AJ Digital delivery, usage, or support data | Preferred portfolio input |
| Client actual | Measured client-specific operating data | Preferred client input |
| Client decision | Approved client policy, responsibility, or boundary | Required where client authority controls the choice |
| Unknown | Unsupported value | Must remain `unknown` |

For comparable numerical inputs, use the strongest applicable evidence:

```text
Client actual or AJ Digital actual
  > high-confidence external benchmark
  > calculated derivative
  > planning assumption
  > unknown
```

Client and AJ Digital decisions set boundaries; they do not become measured
actuals. Conflicting actuals require investigation rather than automatic
precedence.

## Provisional internal inputs

These values are preliminary modeling inputs, not market facts, approved public
prices, client estimates, or AJ Digital actuals.

| Input | Provisional value | Evidence posture |
|---|---:|---|
| Founder replacement-cost range | `$100–$124/hour` | Calculated derivative |
| Founder modeling midpoint | `$112/hour` | Planning convention |
| Expected founder delivery capacity | `18 hours/week` | Planning assumption |
| Working weeks | `46/year` | Planning assumption |
| Annual expected delivery capacity | `828 hours/year` | Calculated derivative |
| After-hours human support | Excluded | Preliminary AJ Digital decision |

Contractor rates and all effort hours remain provisional or `unknown` until
supported in the completed cost template. No client total may be calculated
from labor rates alone.

## Work-breakdown model

Estimate only applicable work in the delivery sequence:

1. qualification and risk screen;
2. discovery and evidence intake;
3. current-state and revenue-leak analysis;
4. future-state, exception, and policy design;
5. scope, architecture, dependencies, and implementation planning;
6. build/configuration after authorization;
7. QA, security, and client acceptance;
8. launch and hypercare;
9. managed operations and retrospective.

Every work row must contain: work-package ID, owner role, low/most-likely/high
hours or `unknown`, rate and evidence class, dependency, confidence, completion
evidence, and rework/blocked-time treatment.

## Cost structure

```text
Founder labor
= founder hours × founder replacement-cost rate

Contractor labor
= sum(hours by role × approved role rate)

Direct non-labor
= vendor setup + registration + implementation-specific infrastructure

Total delivery cost
= founder labor
 + contractor labor
 + direct non-labor
 + QA
 + measured rework
 + hypercare
 + approved overhead allocation
 + approved contingency
```

Do not apply a generic rework percentage when measured remediation hours exist.
Founder replacement cost remains in the model even when no cash payroll is
issued.

## Planning scenarios and P50/P80

Start with transparent low, most-likely, and high scenarios. Use Monte Carlo only
when every material input has a documented distribution and correlation
decision.

Until sufficiently comparable AJ Digital delivery data exists, approved labels
are:

- `P50 planning proxy`
- `P80 planning proxy`

Do not use `P50 actual`, `P80 actual`, `empirical percentile`, or
`statistically validated percentile`.

Every proxy output must include method, evidence mix, confidence, material
correlations, major cost drivers, and largest unknowns.

## Variable vendor billing

The opening posture is preliminary and must be reconciled per engagement with
the platform ownership canon.

1. **Preferred where practical:** client-owned accounts.
2. **Secondary:** pass-through billing plus an explicit
   administration/platform-management fee.
3. **Bundled usage:** deferred until AJ Digital has comparable attributable
   usage history.
4. **Excluded:** fully absorbed, uncapped variable usage in the standard offer.

Record four different questions separately:

| Dimension | Question | Governing authority |
|---|---|---|
| Credential/platform ownership | Whose account, registration, number, and key technically operate the service? | ADRs and Integration Map |
| Client commercial responsibility | Which costs does the client contractually bear? | Approved engagement terms |
| Vendor invoicing flow | Who receives and pays the vendor invoice before any reimbursement? | Approved billing register |
| Usage allowance policy | Is usage pass-through, capped, bundled, or excluded? | Approved commercial policy |

Client-owned billing does not override ADR-0036's platform-owned MVP A2P
registration or the platform-owned carrier/voice-key baseline. Conversely,
platform-owned credentials do not by themselves require AJ Digital to absorb
variable usage. Any substantive change to either doctrine requires a separate
decision.

## Support planning objectives

These are preliminary planning objectives, not validated SLA performance or
client commitments:

| Severity | Initial-response objective |
|---|---|
| P1 | Within 4 business hours |
| P2 | Within 1 business day |
| P3 | Within 2 business days |
| P4 | Best effort |

Business hours are Monday–Friday, 9:00 a.m.–5:00 p.m. Eastern. After-hours
human coverage is excluded. Resolution-time guarantees are excluded where
third-party dependencies are involved.

Internal incident paging and containment targets in the canonical runbook are
operational controls, not customer-facing support promises.

## Benchmark replacement

Replace provisional inputs only with traceable evidence. At minimum capture:

- labor and rework by work-package ID;
- blocked and approval-wait time;
- vendor cost by client and interaction;
- automated completion and exception rates;
- human minutes per exception;
- hypercare and monthly support burden;
- estimated-versus-actual variance.

Recalculate planning proxies after each comparable installation. Eligibility for
empirical percentiles requires a methodology review; no fixed sample count is
declared by this standard.

## Approval boundary

This standard authorizes internal modeling only. Public pricing, a proposal,
bundled usage, a support commitment, vendor purchase, production configuration,
or deployment each require their own approval.
