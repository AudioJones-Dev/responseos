# ResponseOS `<CLIENT_ID>` Revenue-Leak Model

**Status:** Draft planning template
**Opportunity identifier:** `<CLIENT_ID>`
**Evidence period:** `<DATE_RANGE>`
**Prepared by:** `<AJ_DIGITAL_OWNER>`
**Client data owner:** `<CLIENT_DATA_OWNER>`

## Purpose and limits

Estimate the size and location of missed demand using explicit evidence and
formulas. This model is not a revenue guarantee, public price, or verified
outcome report.

## Input register

| Input | Value | Unit | Classification | Evidence/source | Date | Confidence |
|---|---:|---|---|---|---|---|
| Inbound opportunities | unknown | count/period | Unknown | unknown | unknown | unknown |
| Missed/unworked opportunities | unknown | count/period | Unknown | unknown | unknown | unknown |
| Qualified share | unknown | percent | Unknown | unknown | unknown | unknown |
| Average job/order value | unknown | USD | Unknown | unknown | unknown | unknown |
| Close rate | unknown | percent | Unknown | unknown | unknown | unknown |
| Current response time | unknown | duration | Unknown | unknown | unknown | unknown |
| Follow-up completion | unknown | percent | Unknown | unknown | unknown | unknown |
| Duplicate/invalid share | unknown | percent | Unknown | unknown | unknown | unknown |

## Segmentation

| Channel / workflow | Volume | Missed/unworked | Qualified | Outcome value | Evidence/source |
|---|---:|---:|---:|---:|---|
| unknown | unknown | unknown | unknown | unknown | unknown |

## Calculation methods

Use only formulas supported by the available evidence.

```text
Qualified missed opportunities
= missed/unworked opportunities × qualified share

Estimated recoverable opportunities
= qualified missed opportunities × achievable recovery assumption

Estimated revenue opportunity
= estimated recoverable opportunities × average value × close-rate assumption
```

Every assumption in a formula must appear in the assumptions register. Do not
present estimated revenue opportunity as recovered or verified revenue.

## Results

| Result | Value | Label | Method | Confidence |
|---|---:|---|---|---|
| Observed missed/unworked demand | unknown | Client actual / Unknown | unknown | unknown |
| Estimated qualified missed demand | unknown | Calculated derivative | unknown | unknown |
| Estimated revenue opportunity | unknown | Planning estimate | unknown | unknown |
| Verified recovered revenue | unknown | Client actual only | ledger/evidence required | unknown |

## Facts, decisions, assumptions, and unknowns

| Statement/input | Type | Evidence/source | Owner | Sensitivity |
|---|---|---|---|---|
| unknown | Fact / Client decision / AJ Digital decision / Planning assumption / Unknown | unknown | unknown | unknown |

## Risks, dependencies, and safety

| Item | Effect | Owner | Control / rollback |
|---|---|---|---|
| Attribution quality | unknown | unknown | preserve event-level evidence; do not claim verified |
| Missing baseline | unknown | unknown | keep output unknown or scenario-only |
| Sensitive data | unknown | unknown | minimize/redact and restrict access |

## Decision use

```text
Supports fit/no-fit decision: unknown
Supports scope planning: unknown
Supports public ROI claim: no
Supports customer price: no
Next evidence required: unknown
```

## Approval

| Role | Name | Decision | Date | Evidence |
|---|---|---|---|---|
| Client data owner | `<CLIENT_DATA_OWNER>` | unknown | unknown | unknown |
| AJ Digital reviewer | `<AJ_DIGITAL_OWNER>` | unknown | unknown | unknown |
