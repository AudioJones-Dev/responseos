# ResponseOS `<CLIENT_ID>` Discovery Evidence Request

**Status:** Draft template
**Opportunity identifier:** `<CLIENT_ID>`
**AJ Digital owner:** `<AJ_DIGITAL_OWNER>`
**Client evidence owner:** `<CLIENT_EVIDENCE_OWNER>`
**Client approver:** `<CLIENT_APPROVER>`
**Gate:** R2 — Discovery authorization

## Purpose and boundary

Request the minimum evidence needed to understand current operations. Do not
request passwords, API keys, signing secrets, payment credentials, or unrelated
personal data. Discovery authorizes evidence review only—no system writes,
provider setup, implementation, or deployment.

## Approved transfer method

```text
Approved repository/workspace: unknown
Transfer method: unknown
Access list: unknown
Retention/deletion requirement: unknown
Sensitive-data handling decision: unknown
Client decision evidence: unknown
```

## Evidence request

| Category | Requested evidence | Date range | Required? | Owner | Classification expected |
|---|---|---|---|---|---|
| Communications | Call counts/minutes, missed/abandoned calls, voicemail, SMS/email/form volume | `<DATE_RANGE>` | yes | `<CLIENT_EVIDENCE_OWNER>` | Client actual or Unknown |
| Workflow | Representative request reasons, qualification, scheduling, dispatch, follow-up, escalation | current | yes | `<CLIENT_PROCESS_OWNER>` | Client actual/decision |
| Systems | Phone, CRM, calendar, website/forms, email, automations, system owners | current | yes | `<CLIENT_SYSTEM_OWNER>` | Client actual |
| Policies | Hours, consent, recording, retention, emergency/safety, permitted actions | current | yes | `<CLIENT_POLICY_OWNER>` | Client decision |
| Outcomes | Lead, booking, close-rate, job-value, attribution definitions and data quality | `<DATE_RANGE>` | if available | `<CLIENT_DATA_OWNER>` | Client actual or Unknown |
| Support | Current support expectations, exception ownership, after-hours expectations | current | yes | `<CLIENT_APPROVER>` | Client decision |
| Vendor costs | Rate cards, invoices, attributable usage without credentials | `<DATE_RANGE>` | if available | `<CLIENT_FINANCE_OWNER>` | Client actual |

## Receipt and evidence log

| Evidence ID | Description | Source/location | Received | Classification | Confidence | Access restriction | Conflict? |
|---|---|---|---|---|---|---|---|
| `<EVIDENCE_ID>` | unknown | unknown | unknown | Unknown | unknown | unknown | unknown |

## Facts, decisions, assumptions, and unknowns

| Statement | Type | Evidence ID/source | Owner | Disposition |
|---|---|---|---|---|
| unknown | Fact / Client decision / AJ Digital decision / Planning assumption / Unknown | unknown | unknown | unknown |

## Data-minimization and safety review

- [ ] No secrets or credentials requested.
- [ ] Personal data is necessary and minimized.
- [ ] Recording/transcript access is approved and restricted.
- [ ] Client confirms authority to share the evidence.
- [ ] Retention and deletion requirements are recorded.
- [ ] Conflicting sources remain separately identified.
- [ ] Unsafe or unnecessary files are rejected or redacted.

## Dependencies, blockers, and stop conditions

| Item | Owner | Effect if unresolved | Safe action |
|---|---|---|---|
| unknown | unknown | unknown | request clarification / reject / defer |

Stop if the transfer contains credentials, unauthorized sensitive data, unclear
ownership, or evidence outside the approved scope. Rollback means revoking
access and following the approved deletion/return procedure; record what
remains in audit or backup systems.

## Authorization

| Role | Name | Approval | Date | Evidence |
|---|---|---|---|---|
| Client approver | `<CLIENT_APPROVER>` | unknown | unknown | unknown |
| AJ Digital owner | `<AJ_DIGITAL_OWNER>` | unknown | unknown | unknown |

```text
Discovery evidence request approved: no
System writes authorized: no
Implementation authorized: no
```
