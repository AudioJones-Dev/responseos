# ResponseOS — Docs

ResponseOS is the AI Revenue Recovery Platform built by AJ Digital LLC. This `docs/` directory is the canonical product source of truth: positioning, data models, API contracts, automation flows, environment, deployment posture, and security stance.

## Canonical `RESPONSEOS_*` doc set (go-forward)

A complete canonical documentation set lives under `product/`, `architecture/`, `ops/`, `brand/`, and `research/`, indexed by **[`product/RESPONSEOS_BUILD_SOURCE.md`](./product/RESPONSEOS_BUILD_SOURCE.md)** — start there. The authoritative provider-stack baseline is the decision log: Telnyx primary / Twilio failover; Vapi primary orchestration with OpenAI as the preferred in-Vapi brain and Vapi-owned model selection as fallback; Retell secondary; n8n async; HubSpot default CRM SoR; Cal.com scheduling with Google Calendar compatibility; Node gateway + Redis deferred, per [ADR-0031/0032/0033/0036](./DECISIONS.md). Some `RESPONSEOS_*` prose docs still carry older Grok/OpenAI-Realtime/Twilio/gateway/Redis framing or mark layers open; where prose docs conflict with ADRs, the ADRs win until a separate reconciliation PR updates them.

| Area | Docs |
|---|---|
| Product | [`BUILD_SOURCE`](./product/RESPONSEOS_BUILD_SOURCE.md) · [`PRD`](./product/RESPONSEOS_PRD.md) · [`ROADMAP`](./product/RESPONSEOS_ROADMAP.md) · [`PHASE_PLAN`](./product/RESPONSEOS_PHASE_PLAN.md) · [`IMPLEMENTATION_PLAN`](./product/RESPONSEOS_IMPLEMENTATION_PLAN.md) · [`BACKLOG`](./product/RESPONSEOS_BACKLOG.md) · [`GTM_ROADMAP`](./product/responseos-gtm-product-roadmap.md) (GTM/brand/voice/pricing planning spec) · [`COMMS_STACK`](./product/responseos-communications-stack.md) (communications stack CTO decision) · [`DEMO_PLAN`](./product/responseos-demo-narrative-and-asset-plan.md) (demo narrative + asset plan) |
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
