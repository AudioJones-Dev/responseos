# ResponseOS `<CLIENT_ID>` Cost Model

**Status:** Draft internal planning template
**Opportunity identifier:** `<CLIENT_ID>`
**Model version:** `<MODEL_VERSION>`
**Scope version:** `<SCOPE_VERSION>`
**Prepared by:** `<AJ_DIGITAL_OWNER>`
**Client approver:** `<CLIENT_APPROVER>`
**Public/customer price established:** No

## Evidence availability

| Evidence | Available? | Classification | Source/link | Confidence |
|---|---|---|---|---|
| Client communication volume | unknown | Unknown | unknown | unknown |
| Client handling/exception time | unknown | Unknown | unknown | unknown |
| Approved scope and policies | unknown | Unknown | unknown | unknown |
| AJ Digital comparable hours | no | AJ Digital actual | unknown | unknown |
| Contractor estimate/invoice | unknown | Unknown | unknown | unknown |
| Vendor rates/usage | unknown | Unknown | unknown | unknown |

## Provisional internal rates

These are planning inputs only. Override only with stronger evidence and record
the source.

| Role/input | Low | Most likely | High | Classification | Source/override |
|---|---:|---:|---:|---|---|
| Founder | $100 | $112 | $124 | Calculated derivative / planning convention | Cost Model Standard |
| Architecture/strategy | unknown | unknown | unknown | Unknown | unknown |
| Automation/implementation | unknown | unknown | unknown | Unknown | unknown |
| Development | unknown | unknown | unknown | Unknown | unknown |
| QA | unknown | unknown | unknown | Unknown | unknown |
| Security | unknown | unknown | unknown | Unknown | unknown |
| Technical PM | unknown | unknown | unknown | Unknown | unknown |

```text
Expected founder delivery capacity: 18 hours/week
Working weeks: 46/year
Classification: Planning assumption
```

## WBS effort

Add one row for every applicable delivery work package. Mark non-applicable
items `N/A` with a reason.

| WBS ID | Work package | Owner role | Low hours | Most-likely hours | High hours | Rate | Classification | Evidence/source | Dependency | Confidence |
|---|---|---|---:|---:|---:|---:|---|---|---|---|
| `<WBS_ID>` | unknown | unknown | unknown | unknown | unknown | unknown | Unknown | unknown | unknown | unknown |

## Vendor and non-labor inputs

| Vendor/input | Platform/credential owner | Commercially responsible party | Invoice flow | Unit | Unit cost | Usage | Allowance policy | Classification/source |
|---|---|---|---|---|---:|---:|---|---|
| unknown | unknown | unknown | unknown | unknown | unknown | unknown | pass-through / capped / bundled / excluded / unknown | Unknown |

Do not infer commercial responsibility from credential ownership. Preserve
platform-owned A2P/carrier doctrine unless a governing decision changes it.

## Support and managed-service inputs

```text
Support window planning objective:
Monday–Friday, 9:00 a.m.–5:00 p.m. Eastern

P1 initial-response planning objective:
within 4 business hours

P2:
within 1 business day

P3:
within 2 business days

P4:
best effort

After-hours human support:
excluded

Resolution-time guarantee with third-party dependencies:
excluded
```

| Input | Low | Most likely | High | Classification/source |
|---|---:|---:|---:|---|
| Hypercare hours | unknown | unknown | unknown | Unknown |
| Monthly monitoring | unknown | unknown | unknown | Unknown |
| Monthly exception review | unknown | unknown | unknown | Unknown |
| Monthly support reserve | unknown | unknown | unknown | Unknown |

## Scenario results

| Cost component | Low | Most likely | High | Formula/evidence |
|---|---:|---:|---:|---|
| Founder labor | unknown | unknown | unknown | hours × rate |
| Contractor labor | unknown | unknown | unknown | sum by role |
| Direct non-labor | unknown | unknown | unknown | vendor/setup inputs |
| QA and measured rework | unknown | unknown | unknown | hours × rate |
| Hypercare | unknown | unknown | unknown | labor + variable usage |
| Approved overhead/contingency | unknown | unknown | unknown | approved method |
| **Total delivery cost** | unknown | unknown | unknown | sum above |

## P50/P80 planning proxy

```text
P50 planning proxy: unknown
P80 planning proxy: unknown
Method: deterministic scenarios / Monte Carlo / unknown
Empirical percentile: no
Confidence: unknown
Material correlations: unknown
Top cost drivers: unknown
Largest unknowns: unknown
```

## Facts, decisions, assumptions, and unknowns

| Statement/input | Type | Evidence/source | Owner | Model effect |
|---|---|---|---|---|
| unknown | Fact / Client decision / AJ Digital decision / Planning assumption / Unknown | unknown | unknown | unknown |

## Risks, dependencies, safety, and rollback

| Item | Effect | Owner | Mitigation | Safe rollback |
|---|---|---|---|---|
| unknown | unknown | unknown | unknown | restore prior model version; do not quote |

## Decision and approvals

```text
Model supports scope decision: unknown
Model supports implementation authorization: unknown
Model supports public pricing: no
Production deployment authorized: no
Next evidence required: unknown
```

| Role | Name | Decision | Date | Evidence |
|---|---|---|---|---|
| Client approver (facts/responsibilities only) | `<CLIENT_APPROVER>` | unknown | unknown | unknown |
| AJ Digital model owner | `<AJ_DIGITAL_OWNER>` | unknown | unknown | unknown |
| AJ Digital margin/commercial reviewer | `<AJ_DIGITAL_COMMERCIAL_REVIEWER>` | unknown | unknown | unknown |
