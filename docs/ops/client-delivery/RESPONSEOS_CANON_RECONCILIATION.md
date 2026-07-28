# ResponseOS Client-Delivery Canon Reconciliation

**Status:** Canonical conflict and overlap register
**Owner:** AJ Digital LLC / Audio Jones
**Policy:** No silent overwrite
**Opening-policy decision:** Approved by Audio on 2026-07-28 for PR #103

## Authority rule

ADRs govern load-bearing decisions. The `RESPONSEOS_*` set governs go-forward
product, architecture, and operations where consistent with the ADRs. Existing
commercial documents remain historical/current planning inputs where not
superseded, but their numeric terms are not made approved public pricing by this
client-delivery work.

## Source-pack reconciliation

| Source file | Conflicting or overlapping existing doc | Current canonical authority | Proposed treatment | Decision owner | Blocks onboarding-pack readiness? |
|---|---|---|---|---|---|
| `RESPONSEOS_DELIVERY_WBS_AND_COST_MODEL_SPEC.md` | Product Phase Plan, QA plan, Runbook, Deployment Plan, Integration Map | Existing platform docs and ADRs | Synthesize only the client-delivery process and cost evidence rules; link platform controls; discard the instruction to select a real planning client because no active client exists | Audio | No |
| `RESPONSEOS_CLIENT_COST_MODEL_PLANNING_WORKSHEET.md` | `docs/pricing-and-onboarding.md`; GTM pricing sections | ADR-0028 for model structure; price points remain open; new cost standard for internal evidence | Convert to a client-agnostic internal template; no customer-facing price or unsupported totals | Audio | No |
| `RESPONSEOS_FUTURE_CLIENT_READINESS_BASELINE_v0.2.md` | Product onboarding UX and Phase Plan | Product canon for runtime/milestones; new readiness standard for service delivery | Preserve pre-client correction and R0–R3 service gates without changing runtime scope or roadmap | Audio | No |

## Existing-canon conflicts

| Topic / source | Conflict or overlap | Current authority | Treatment in this package | Decision owner | Blocks readiness? |
|---|---|---|---|---|---|
| `docs/pricing-and-onboarding.md` | Recovery Core/Pro/Performance names, specific assessment/setup/retainer amounts, included minutes, and default quote conflict with ADR-0028 and unvalidated economics | ADR-0028 governs capacity-based model structure; specific price points remain open/v0.5-gated | Preserve the document; keep all price figures unpublished; mark bundled allowances as superseded by the approved pass-through opening posture | Audio | No; blocks public pricing |
| `docs/client-facing-offer.md` | Repeats legacy prices and included usage; says after-hours P1 response is 1 hour | ADR-0028 for pricing structure; the Cost Model Standard governs the approved internal opening posture | Preserve the document; mark price figures, bundled allowances, and legacy SLA defaults as superseded planning material; no contractual SLA is created | Audio | No; blocks contractual SLA/public price |
| `docs/product/responseos-gtm-product-roadmap.md` | Contains working prices, bundled limits, and historical provider/CRM conflict text | ADR-0022/0028/0031/0032/0033/0036/0037 | Treat cost and price figures as TODO-verify; provider decisions defer to current ADRs; link, do not copy stale stack prose | Audio | No |
| `docs/product/RESPONSEOS_BUILD_SOURCE.md` | Platform-owned carrier/voice credentials and provider canon differ from the source pack's broad client-owned preference | ADR-0031/0032/0036 and Build Source | Preserve platform/credential ownership; client bears variable usage; use direct billing where compatible or pass-through plus an explicit administration fee | Audio for commercial policy; architecture ADRs for platform ownership | No; substantive ownership change would block |
| `docs/architecture/RESPONSEOS_INTEGRATION_MAP.md` | Historical provider names are stale, but its platform-vs-tenant credential model remains the detailed ownership map | Current ADRs supersede provider names; ownership doctrine remains unless a later ADR changes it | Reference it with the ADRs; do not rewrite it in this scoped PR | Architecture owner | No |
| `docs/PRD.md` and `docs/brand/RESPONSEOS_SALES_NARRATIVE.md` | `$300+` average job value and `20+` missed calls/month appear as qualification gates | Cost Model Standard for delivery qualification; product positioning remains unchanged | Retain as evidence prompts only; neither figure is an automatic pass/fail gate; require evidence-based fit/no-fit rationale | Audio | No |
| `docs/product/RESPONSEOS_PRD.md` and Frontend Spec | Two-phase assessment and onboarding flow overlap qualification/discovery templates | Product canon | Templates capture service-delivery evidence; they do not specify runtime UI or change product scope | Product owner | No |
| `docs/ops/RESPONSEOS_RUNBOOK.md` | Internal P0/P1 paging and update timing differ from client support planning objectives | Runbook governs internal incident operations; Cost Model Standard governs opening support planning | Keep internal incident objectives separate; use business-hours planning objectives with no after-hours human coverage; require separate contractual approval | Audio / operations owner | No |
| `docs/ops/RESPONSEOS_QA_VALIDATION_PLAN.md` | Already defines code, integration, tenant, signature, and provider gates | QA plan | Reuse by link; client templates record only engagement-specific test/acceptance evidence | QA owner | No |
| `docs/ops/RESPONSEOS_SECURITY_AND_COMPLIANCE.md` | Already defines platform security/compliance and states ResponseOS is not HIPAA-certified | Security canon | Reuse by link; client risk template records applicability and approvals without claiming compliance | Security owner | No |
| `docs/ops/RESPONSEOS_DEPLOYMENT_PLAN.md` | Already defines platform release/rollback topology | Deployment canon | Reuse by link; implementation and launch templates record engagement-specific authorization and checkpoint | Release owner | No |
| `docs/ops/RESPONSEOS_OBSERVABILITY_AND_GOVERNANCE.md` | Already defines platform telemetry, Git, and PR gates | Observability/governance canon | Reuse by link; retrospective template captures attributable client and AJ Digital actuals | Operations owner | No |

## Ratified opening decisions

Audio approved the following internal posture on 2026-07-28:

1. Public pricing remains unpublished.
2. Clients bear attributable variable vendor usage; use direct billing where
   compatible or pass-through plus an explicit administration/platform fee.
3. Bundled usage is deferred pending comparable attributable usage history.
4. Support uses Monday–Friday, 9:00 a.m.–5:00 p.m. Eastern planning objectives,
   with P1 within 4 business hours, P2 within 1 business day, P3 within
   2 business days, P4 best effort, and no after-hours human coverage.
5. The `$300+` / `20+` figures are qualification heuristics, not automatic
   gates.

These decisions govern internal opening-offer planning. They do not publish
prices, create a contractual SLA, alter provider ownership, or authorize an
engagement.

## Remaining decisions and unknowns

- Final price points, setup fees, contract terms, overages, and publication
  timing remain unknown and require separate approval.
- The evidence threshold and method for introducing bundled allowances remain
  unknown.
- The administration/platform-management fee amount, tax/accounting treatment,
  invoicing mechanics, and client disclosure language remain unknown.
- Each client proposal and contractual support schedule requires separate
  approval; the opening objectives are not validated SLA performance.
- Qualification heuristics may be revised or made vertical-specific only after
  evidence review.

## ADR determination

No ADR is required for this package. It adds a delivery-control and evidence
layer without changing architecture, provider selection, platform ownership,
milestone sequencing, billing implementation timing, or public pricing.

The ratified opening posture does not require an ADR because it preserves
platform ownership/provider doctrine and ADR-0028's pricing-model structure. A
future change to either requires an ADR or an update to the relevant ADR-backed
commercial canon.
