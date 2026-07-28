# ResponseOS Client Delivery

**Status:** Canonical documentation for future-client delivery preparation.
**Owner:** AJ Digital LLC / Audio Jones
**Current phase:** Pre-client service-system staging
**Active ResponseOS client:** No

This directory defines how AJ Digital qualifies, discovers, scopes, authorizes,
implements, launches, supports, and measures a future ResponseOS engagement.
It does not create an active client, authorize public pricing, validate unit
economics, authorize live providers, or authorize production deployment.

## Authority and precedence

1. [`../../DECISIONS.md`](../../DECISIONS.md) governs load-bearing product,
   platform, provider, ownership, and sequencing decisions.
2. [`../../product/RESPONSEOS_BUILD_SOURCE.md`](../../product/RESPONSEOS_BUILD_SOURCE.md) indexes
   the go-forward product and architecture canon.
3. Existing security, QA, runbook, deployment, and observability documents
   govern their respective platform controls.
4. The standards in this directory govern the reusable client-delivery process.
5. Completed client artifacts govern only the named engagement and never become
   global canon without review.

When evidence conflicts, record the conflict. Do not average it, silently choose
a winner, or convert an assumption into an actual.

## Standards

- [`RESPONSEOS_CLIENT_DELIVERY_STANDARD.md`](./RESPONSEOS_CLIENT_DELIVERY_STANDARD.md)
  — end-to-end delivery sequence, owners, evidence, gates, blockers, and rollback.
- [`RESPONSEOS_COST_MODEL_STANDARD.md`](./RESPONSEOS_COST_MODEL_STANDARD.md) —
  evidence classes, provisional internal inputs, planning proxies, and
  benchmark-replacement rules.
- [`RESPONSEOS_FUTURE_CLIENT_READINESS_STANDARD.md`](./RESPONSEOS_FUTURE_CLIENT_READINESS_STANDARD.md)
  — current pre-client state and readiness gates R0–R3.
- [`RESPONSEOS_CANON_RECONCILIATION.md`](./RESPONSEOS_CANON_RECONCILIATION.md)
  — overlap, conflicts, current authorities, treatments, and unresolved owners.

## Templates

- [`RESPONSEOS_PROSPECT_QUALIFICATION_INTAKE_TEMPLATE.md`](./templates/RESPONSEOS_PROSPECT_QUALIFICATION_INTAKE_TEMPLATE.md)
- [`RESPONSEOS_DISCOVERY_EVIDENCE_REQUEST_TEMPLATE.md`](./templates/RESPONSEOS_DISCOVERY_EVIDENCE_REQUEST_TEMPLATE.md)
- [`RESPONSEOS_CURRENT_STATE_WORKFLOW_TEMPLATE.md`](./templates/RESPONSEOS_CURRENT_STATE_WORKFLOW_TEMPLATE.md)
- [`RESPONSEOS_READINESS_ASSESSMENT_TEMPLATE.md`](./templates/RESPONSEOS_READINESS_ASSESSMENT_TEMPLATE.md)
- [`RESPONSEOS_REVENUE_LEAK_MODEL_TEMPLATE.md`](./templates/RESPONSEOS_REVENUE_LEAK_MODEL_TEMPLATE.md)
- [`RESPONSEOS_SCOPE_ASSUMPTIONS_REGISTER_TEMPLATE.md`](./templates/RESPONSEOS_SCOPE_ASSUMPTIONS_REGISTER_TEMPLATE.md)
- [`RESPONSEOS_COST_MODEL_TEMPLATE.md`](./templates/RESPONSEOS_COST_MODEL_TEMPLATE.md)
- [`RESPONSEOS_IMPLEMENTATION_PLAN_TEMPLATE.md`](./templates/RESPONSEOS_IMPLEMENTATION_PLAN_TEMPLATE.md)
- [`RESPONSEOS_RISK_COMPLIANCE_REGISTER_TEMPLATE.md`](./templates/RESPONSEOS_RISK_COMPLIANCE_REGISTER_TEMPLATE.md)
- [`RESPONSEOS_CLIENT_ONBOARDING_CHECKLIST_TEMPLATE.md`](./templates/RESPONSEOS_CLIENT_ONBOARDING_CHECKLIST_TEMPLATE.md)
- [`RESPONSEOS_LAUNCH_HYPERCARE_TEMPLATE.md`](./templates/RESPONSEOS_LAUNCH_HYPERCARE_TEMPLATE.md)
- [`RESPONSEOS_TELEMETRY_RETROSPECTIVE_TEMPLATE.md`](./templates/RESPONSEOS_TELEMETRY_RETROSPECTIVE_TEMPLATE.md)

Every template uses `<CLIENT_ID>` and must start with unsupported values marked
`unknown`. Do not create a client directory until a real opportunity is
registered and the operator approves its location and data-handling boundaries.

## Existing canon reused instead of duplicated

| Need | Existing authority |
|---|---|
| Platform security and compliance controls | [`../RESPONSEOS_SECURITY_AND_COMPLIANCE.md`](../RESPONSEOS_SECURITY_AND_COMPLIANCE.md) |
| Code and feature validation | [`../RESPONSEOS_QA_VALIDATION_PLAN.md`](../RESPONSEOS_QA_VALIDATION_PLAN.md) |
| Incident response and provider failure procedures | [`../RESPONSEOS_RUNBOOK.md`](../RESPONSEOS_RUNBOOK.md) |
| Deployment and rollback topology | [`../RESPONSEOS_DEPLOYMENT_PLAN.md`](../RESPONSEOS_DEPLOYMENT_PLAN.md) |
| Telemetry and governance | [`../RESPONSEOS_OBSERVABILITY_AND_GOVERNANCE.md`](../RESPONSEOS_OBSERVABILITY_AND_GOVERNANCE.md) |
| Product implementation sequencing | [`../../product/RESPONSEOS_PHASE_PLAN.md`](../../product/RESPONSEOS_PHASE_PLAN.md) |
| Provider and credential ownership | [`../../architecture/RESPONSEOS_INTEGRATION_MAP.md`](../../architecture/RESPONSEOS_INTEGRATION_MAP.md) plus governing ADRs |

These links are intentional omissions from the template count: the client
delivery system records engagement-specific evidence and approvals while the
existing documents continue to define platform behavior.
