# ResponseOS — Docs

ResponseOS is the AI Revenue Recovery Platform built by AJ Digital LLC. This `docs/` directory is the canonical product source of truth: positioning, data models, API contracts, automation flows, environment, deployment posture, and security stance.

## Canonical `RESPONSEOS_*` doc set (go-forward)

A complete canonical documentation set lives under `product/`, `architecture/`, `ops/`, `brand/`, and `research/`, indexed by **[`product/RESPONSEOS_BUILD_SOURCE.md`](./product/RESPONSEOS_BUILD_SOURCE.md)** — start there. It defines the go-forward stack (Twilio edge · Node.js voice gateway · Grok Voice primary / OpenAI Realtime fallback · n8n async · HubSpot CRM SoR · Redis · PostHog/Sentry/Better Stack · Obsidian SOP layer) and is reconciled against the original docs via [ADR-0011 → ADR-0018](./DECISIONS.md). Where the new set conflicts with an earlier prose doc, the new ADRs win; the original `docs/*.md` files below remain authoritative for anything the new set does not restate.

| Area | Docs |
|---|---|
| Product | [`BUILD_SOURCE`](./product/RESPONSEOS_BUILD_SOURCE.md) · [`PRD`](./product/RESPONSEOS_PRD.md) · [`ROADMAP`](./product/RESPONSEOS_ROADMAP.md) · [`PHASE_PLAN`](./product/RESPONSEOS_PHASE_PLAN.md) · [`IMPLEMENTATION_PLAN`](./product/RESPONSEOS_IMPLEMENTATION_PLAN.md) · [`BACKLOG`](./product/RESPONSEOS_BACKLOG.md) · [`GTM_ROADMAP`](./product/responseos-gtm-product-roadmap.md) (GTM/brand/voice/pricing planning spec) |
| Architecture | [`SYSTEM_ARCHITECTURE`](./architecture/RESPONSEOS_SYSTEM_ARCHITECTURE.md) · [`MODULE_BOUNDARIES`](./architecture/RESPONSEOS_MODULE_BOUNDARIES.md) · [`FRONTEND_SPEC`](./architecture/RESPONSEOS_FRONTEND_SPEC.md) · [`BACKEND_SPEC`](./architecture/RESPONSEOS_BACKEND_SPEC.md) · [`DATA_MODEL`](./architecture/RESPONSEOS_DATA_MODEL.md) · [`API_CONTRACTS`](./architecture/RESPONSEOS_API_CONTRACTS.md) · [`EVENT_SCHEMA`](./architecture/RESPONSEOS_EVENT_SCHEMA.md) · [`INTEGRATION_MAP`](./architecture/RESPONSEOS_INTEGRATION_MAP.md) |
| Ops | [`OBSERVABILITY_AND_GOVERNANCE`](./ops/RESPONSEOS_OBSERVABILITY_AND_GOVERNANCE.md) · [`SECURITY_AND_COMPLIANCE`](./ops/RESPONSEOS_SECURITY_AND_COMPLIANCE.md) · [`RUNBOOK`](./ops/RESPONSEOS_RUNBOOK.md) · [`QA_VALIDATION_PLAN`](./ops/RESPONSEOS_QA_VALIDATION_PLAN.md) · [`DEPLOYMENT_PLAN`](./ops/RESPONSEOS_DEPLOYMENT_PLAN.md) |
| Brand | [`POSITIONING`](./brand/RESPONSEOS_POSITIONING.md) · [`BRAND_VOICE`](./brand/RESPONSEOS_BRAND_VOICE.md) · [`SALES_NARRATIVE`](./brand/RESPONSEOS_SALES_NARRATIVE.md) · [`WEBSITE_COPY_SPEC`](./brand/RESPONSEOS_WEBSITE_COPY_SPEC.md) |
| Research | [`MARKET_RESEARCH`](./research/RESPONSEOS_MARKET_RESEARCH.md) · [`NAMING_RISK_RESEARCH`](./research/RESPONSEOS_NAMING_RISK_RESEARCH.md) · [`COMPETITOR_RESEARCH`](./research/RESPONSEOS_COMPETITOR_RESEARCH.md) |

## Start here

1. [`PRD.md`](./PRD.md) — short product source of truth (what it is, who it's for, current scope).
2. [`ROADMAP.md`](./ROADMAP.md) — version table and milestone status (v0.1 → v0.2 → v0.3 → …).
3. [`CHANGELOG.md`](./CHANGELOG.md) — per-PR history.
4. [`DECISIONS.md`](./DECISIONS.md) — architecture decisions (ADRs).

## Product + architecture

5. [`product-spec.md`](./product-spec.md) — long form: positioning, MVP scope, buy-vs-build, success metrics.
6. [`architecture.md`](./architecture.md) — event-ledger-first design, three deployment lanes, provider abstraction.
7. [`data-schema.md`](./data-schema.md) — 11 v0.1 models + v0.2 expansion + planning-only v0.4 knowledge tables.
8. [`api-spec.md`](./api-spec.md) — REST routes, webhook contracts, canonical envelope, idempotency rules.
9. [`automation-flows.md`](./automation-flows.md) — the seven RECOVER playbooks.

## Visual + experience

10. [`DESIGN.md`](./DESIGN.md) — visual system, UX spine, design maturity ladder.
11. [`client-facing-offer.md`](./client-facing-offer.md) — buyer-facing summary.
12. [`pricing-and-onboarding.md`](./pricing-and-onboarding.md) — commercial strategy and qualification gates.

## Environment, deployment, security

13. [`env-spec.md`](./env-spec.md) — environment variables.
14. [`DEPLOYMENT.md`](./DEPLOYMENT.md) — three deployment lanes, CI/CD, SLOs, rollback plan.
15. [`SECURITY.md`](./SECURITY.md) — secrets, webhook signatures, tenant isolation, BAA matrix, incident response.

## Reference

16. [`research-report.md`](./research-report.md) — curated summary of the canonical product + architecture research.

## Archive

Historical implementation briefs whose work has shipped. Kept for provenance; may contain stale relative links.

- [`archive/v0.2-planning-spec.md`](./archive/v0.2-planning-spec.md) — v0.2 strategic direction and acceptance criteria.
- [`archive/v0.2-implementation-spec.md`](./archive/v0.2-implementation-spec.md) — DB / auth / data-layer implementation spec.
- [`archive/v0.2-phase-d-brief.md`](./archive/v0.2-phase-d-brief.md) — integration tests + CI hardening brief.

## Frameworks

- **OFFER** = Philosophy. Outcomes First / Front the Work / Framework Driven / Earn on Outcomes / ROI-Aligned Partnerships.
- **RECOVER** = Service Delivery. Seven stages, operator-mapped: Respond / Evaluate / Capture / Offer / Verify / Escalate / Report. Buyer-facing translation: Revenue Leak Detection / Engagement Automation / Call Capture System / Outcome-Based Booking / Verification + Qualification / Economic ROI Tracking / Reporting + Retention.

ResponseOS is the software layer where OFFER + RECOVER lives.
