# ResponseOS `<CLIENT_ID>` Client Onboarding Checklist

**Status:** Draft template
**Opportunity identifier:** `<CLIENT_ID>`
**Onboarding owner:** `<AJ_DIGITAL_OWNER>`
**Client operator:** `<CLIENT_OPERATOR>`
**Scope version:** `<SCOPE_VERSION>`

## Entry gate

- [ ] R3 packet approved.
- [ ] Client and AJ Digital responsibilities approved.
- [ ] Implementation `proceed` recorded for the exact scope.
- [ ] Security, data, support, vendor-billing, and rollback boundaries approved.
- [ ] No production deploy or live-provider action is implied by onboarding.

## Control record

| Statement | Type | Evidence/source | Owner | Status |
|---|---|---|---|---|
| unknown | Fact / Client decision / AJ Digital decision / Planning assumption / Unknown | unknown | unknown | unknown |

## Business and policy onboarding

- [ ] Business hours, holidays, and after-hours rules approved.
- [ ] Service area and exclusions approved.
- [ ] Service/request taxonomy approved.
- [ ] Qualification, booking/dispatch, and quote rules approved.
- [ ] Escalation contacts and human exception owners approved.
- [ ] Recording/AI disclosure and consent policy approved.
- [ ] Brand voice, permitted claims, prohibited claims, and fallback language approved.
- [ ] Baseline metrics and attribution definitions approved.

## Systems and ownership

| System/vendor | Purpose | Credential/platform owner | Commercially responsible party | Invoice flow | Access owner | Status |
|---|---|---|---|---|---|---|
| unknown | unknown | unknown | unknown | unknown | unknown | unknown |

- [ ] Provider choices match current ADRs and approved client overrides.
- [ ] Platform-owned A2P/carrier doctrine is preserved unless superseded.
- [ ] Client-owned CRM/calendar connections are approved where applicable.
- [ ] No secrets are recorded in this checklist.
- [ ] Access is least-privilege, time-bounded where practical, and revocable.

## Data and environment

- [ ] Tenant/account identifier provisioned through the approved process.
- [ ] All reads/writes use session-derived `accountId`.
- [ ] Environment and data classification recorded.
- [ ] Synthetic/authorized test data boundary recorded.
- [ ] Retention, deletion/export, recordings, and transcript rules approved.
- [ ] Audit and evidence locations approved.

## Build, QA, and acceptance

- [ ] Implementation plan version recorded.
- [ ] Required repository validation passed.
- [ ] Tenant isolation verified.
- [ ] Webhook signature validation verified before business mutation.
- [ ] Mock fallback verified when credentials are absent.
- [ ] Failure/degraded-mode tests passed.
- [ ] Client acceptance scenarios completed.
- [ ] Open defects have approved disposition.

## Training and launch readiness

- [ ] Client operators trained.
- [ ] Human fallback and exception process rehearsed.
- [ ] Support planning objectives and exclusions acknowledged.
- [ ] Launch owner, rollback owner, and last-known-good state recorded.
- [ ] Telemetry and usage-cost attribution verified.
- [ ] Separate production launch `proceed` recorded.

## Dependencies, blockers, and rollback

| Item | Owner | Effect | Resolution | Rollback/fallback |
|---|---|---|---|---|
| unknown | unknown | unknown | unknown | unknown |

## Approval

| Role | Name | Decision | Date | Evidence |
|---|---|---|---|---|
| Client operator | `<CLIENT_OPERATOR>` | unknown | unknown | unknown |
| Client approver | `<CLIENT_APPROVER>` | unknown | unknown | unknown |
| AJ Digital owner | `<AJ_DIGITAL_OWNER>` | unknown | unknown | unknown |

Stop onboarding if scope, ownership, policy, data handling, or rollback is
unclear. Revert only the bounded onboarding change and restore the last approved
state; do not delete evidence or client data without separate approval.
