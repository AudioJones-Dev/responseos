# ResponseOS — Docs

ResponseOS is the AI Revenue Recovery Platform built by AJ Digital LLC. This `docs/` directory holds the product, architecture, data, API, automation, environment, deployment, governance, and security documentation. `PRD.md`, `ROADMAP.md`, and `DECISIONS.md` remain the operational entry points unless a later approved governance decision changes the canonical hierarchy.

## `RESPONSEOS_*` doc set

A broad go-forward documentation set lives under `product/`, `architecture/`, `ops/`, `brand/`, and `research/`, indexed by **[`product/RESPONSEOS_BUILD_SOURCE.md`](./product/RESPONSEOS_BUILD_SOURCE.md)**. Treat it as detailed product and implementation context, not as permission to override `PRD.md`, `ROADMAP.md`, or `DECISIONS.md`.

The authoritative provider-stack baseline is the decision log: Telnyx primary / Twilio failover; Vapi primary orchestration with OpenAI as the preferred in-Vapi brain and Vapi-owned model selection as fallback; Retell secondary; n8n async; HubSpot default CRM SoR; Calendly as the v0.3 MVP scheduling baseline with Cal.com deferred; Node gateway + Redis deferred, per [ADR-0031/0032/0033/0036/0037](./DECISIONS.md). Some `RESPONSEOS_*` prose docs still carry older Grok/OpenAI-Realtime/Twilio/gateway/Redis framing or mark layers open; where prose docs conflict with ADRs, the ADRs win until a separate reconciliation PR updates them.

| Area | Docs |
|---|---|
| Product | [`BUILD_SOURCE`](./product/RESPONSEOS_BUILD_SOURCE.md) · [`PRD`](./product/RESPONSEOS_PRD.md) · [`ROADMAP`](./product/RESPONSEOS_ROADMAP.md) · [`PHASE_PLAN`](./product/RESPONSEOS_PHASE_PLAN.md) · [`IMPLEMENTATION_PLAN`](./product/RESPONSEOS_IMPLEMENTATION_PLAN.md) · [`BACKLOG`](./product/RESPONSEOS_BACKLOG.md) · [`GTM_ROADMAP`](./product/responseos-gtm-product-roadmap.md) (GTM/brand/voice/pricing planning spec) · [`COMMS_STACK`](./product/responseos-communications-stack.md) (communications stack CTO decision) · [`FOUNDING_PILOT_SCOPE`](./product/responseos-v0.3-founding-pilot-scope.md) (v0.3 Path B freeze + acceptance gates + staged auths) · [`V0_3_AUTH_BRIEF`](./product/responseos-v0.3-authorization-brief.md) (mock-CAL decision checkpoint) · [`DEMO_PLAN`](./product/responseos-demo-narrative-and-asset-plan.md) (demo narrative + asset plan) · [`INTERNAL_DEMO_RECEPTIONIST`](./product/responseos-internal-demo-professional-receptionist.md) (internal demo tenant + professional receptionist, ADR-0046) |
| Architecture | [`SYSTEM_ARCHITECTURE`](./architecture/RESPONSEOS_SYSTEM_ARCHITECTURE.md) · [`MODULE_BOUNDARIES`](./architecture/RESPONSEOS_MODULE_BOUNDARIES.md) · [`FRONTEND_SPEC`](./architecture/RESPONSEOS_FRONTEND_SPEC.md) · [`BACKEND_SPEC`](./architecture/RESPONSEOS_BACKEND_SPEC.md) · [`DATA_MODEL`](./architecture/RESPONSEOS_DATA_MODEL.md) · [`API_CONTRACTS`](./architecture/RESPONSEOS_API_CONTRACTS.md) · [`EVENT_SCHEMA`](./architecture/RESPONSEOS_EVENT_SCHEMA.md) · [`INTEGRATION_MAP`](./architecture/RESPONSEOS_INTEGRATION_MAP.md) |
| Ops | [`CLIENT_DELIVERY`](./ops/client-delivery/README.md) (future-client qualification, discovery, costing, gates, launch, measurement, and templates) · [`OBSERVABILITY_AND_GOVERNANCE`](./ops/RESPONSEOS_OBSERVABILITY_AND_GOVERNANCE.md) · [`SECURITY_AND_COMPLIANCE`](./ops/RESPONSEOS_SECURITY_AND_COMPLIANCE.md) · [`RUNBOOK`](./ops/RESPONSEOS_RUNBOOK.md) · [`STAGING_HOSTING_RUNBOOK`](./ops/RESPONSEOS_STAGING_HOSTING_RUNBOOK.md) (Path A Neon/Clerk/Vercel) · [`QA_VALIDATION_PLAN`](./ops/RESPONSEOS_QA_VALIDATION_PLAN.md) · [`DEPLOYMENT_PLAN`](./ops/RESPONSEOS_DEPLOYMENT_PLAN.md) |
| Brand | [`POSITIONING`](./brand/RESPONSEOS_POSITIONING.md) · [`BRAND_VOICE`](./brand/RESPONSEOS_BRAND_VOICE.md) · [`SALES_NARRATIVE`](./brand/RESPONSEOS_SALES_NARRATIVE.md) · [`WEBSITE_COPY_SPEC`](./brand/RESPONSEOS_WEBSITE_COPY_SPEC.md) |
| Research | [`MARKET_RESEARCH`](./research/RESPONSEOS_MARKET_RESEARCH.md) · [`NAMING_RISK_RESEARCH`](./research/RESPONSEOS_NAMING_RISK_RESEARCH.md) · [`COMPETITOR_RESEARCH`](./research/RESPONSEOS_COMPETITOR_RESEARCH.md) |
| Governance | [`DOCUMENTATION_REMEDIATION_PLAN`](./governance/RESPONSEOS_DOCUMENTATION_REMEDIATION_PLAN.md) · [`PROJECT_CONSTITUTION`](./governance/PROJECT_CONSTITUTION.md) · [`DEFINITION_OF_READY`](./governance/DEFINITION_OF_READY.md) · [`DEFINITION_OF_DONE`](./governance/DEFINITION_OF_DONE.md) · [`DEFINITION_OF_STABLE`](./governance/DEFINITION_OF_STABLE.md) · [`RISK_REGISTER`](./governance/RISK_REGISTER.md) · [`WORKTREE_PLAN`](./governance/WORKTREE_PLAN.md) · [`REQUIREMENTS_TRACEABILITY_MATRIX`](./governance/REQUIREMENTS_TRACEABILITY_MATRIX.md) |

## Start here

0. [`strategy/responseos-platform-doctrine-v1.md`](./strategy/responseos-platform-doctrine-v1.md) — **the platform doctrine.** Strategic source of truth: what ResponseOS is and is not, verified current-state truth, the nine-layer architecture, the intelligence flywheel, moat and build-vs-buy doctrine, provider strategy, revenue-attribution states, trust infrastructure, roadmap phases with evidence gates, and the public-claims policy. Read this before proposing product or architecture changes. *(Proposed — pending operator ratification.)*
1. [`PRD.md`](./PRD.md) — short product source of truth (what it is, who it's for, current scope).
2. [`ROADMAP.md`](./ROADMAP.md) — version table and milestone status (v0.1 → v0.2 → v0.3 → …).
3. [`CHANGELOG.md`](./CHANGELOG.md) — per-PR history.
4. [`DECISIONS.md`](./DECISIONS.md) — architecture decisions (ADRs).
5. [`reference/DOCUMENTATION_INDEX.md`](./reference/DOCUMENTATION_INDEX.md) — AJ Digital OS governance-stack map. Draft navigation only; it does not rename files or promote a final canonicalization model.

## Product + architecture

5. [`product-spec.md`](./product-spec.md) — long form: positioning, MVP scope, buy-vs-build, success metrics.
6. [`architecture.md`](./architecture.md) — event-ledger-first design, three deployment lanes, provider abstraction.
7. [`data-schema.md`](./data-schema.md) — 11 v0.1 models + v0.2 expansion + planning-only v0.4 knowledge tables.
8. [`api-spec.md`](./api-spec.md) — REST routes, webhook contracts, canonical envelope, idempotency rules.
9. [`automation-flows.md`](./automation-flows.md) — the seven RECOVER playbooks.

## Visual + experience

10. [`DESIGN.md`](./DESIGN.md) — visual system, UX spine, design maturity ladder.
11. [`client-facing-offer.md`](./client-facing-offer.md) — buyer-facing summary.
12. [`pricing-and-onboarding.md`](./pricing-and-onboarding.md) — provisional commercial strategy and qualification gates; numeric terms remain unvalidated for publication.
13. [`ops/client-delivery/README.md`](./ops/client-delivery/README.md) — canonical future-client delivery standards, reconciliation, and reusable templates.

## Environment, deployment, security

14. [`env-spec.md`](./env-spec.md) — environment variables.
15. [`DEPLOYMENT.md`](./DEPLOYMENT.md) — three deployment lanes, CI/CD, SLOs, rollback plan.
16. [`SECURITY.md`](./SECURITY.md) — secrets, webhook signatures, tenant isolation, BAA matrix, incident response.

## Governance, quality, and reference

17. [`governance/RESPONSEOS_DOCUMENTATION_REMEDIATION_PLAN.md`](./governance/RESPONSEOS_DOCUMENTATION_REMEDIATION_PLAN.md) — remediation sequence and remaining canonicalization decisions.
18. [`governance/PROJECT_CONSTITUTION.md`](./governance/PROJECT_CONSTITUTION.md) — draft project constitution.
19. [`governance/DEFINITION_OF_READY.md`](./governance/DEFINITION_OF_READY.md), [`DEFINITION_OF_DONE.md`](./governance/DEFINITION_OF_DONE.md), [`DEFINITION_OF_STABLE.md`](./governance/DEFINITION_OF_STABLE.md) — draft governance gates.
20. [`governance/RISK_REGISTER.md`](./governance/RISK_REGISTER.md), [`WORKTREE_PLAN.md`](./governance/WORKTREE_PLAN.md), [`REQUIREMENTS_TRACEABILITY_MATRIX.md`](./governance/REQUIREMENTS_TRACEABILITY_MATRIX.md) — draft risk, worktree, and traceability controls.
21. [`quality/ACCEPTANCE_TEST_PLAN.md`](./quality/ACCEPTANCE_TEST_PLAN.md), [`PERFORMANCE.md`](./quality/PERFORMANCE.md), [`FAILURE_MODES.md`](./quality/FAILURE_MODES.md) — draft quality baselines.
22. [`reference/DOCUMENTATION_INDEX.md`](./reference/DOCUMENTATION_INDEX.md), [`GLOSSARY.md`](./reference/GLOSSARY.md), [`OPEN_QUESTIONS.md`](./reference/OPEN_QUESTIONS.md), [`CODING_STANDARDS.md`](./reference/CODING_STANDARDS.md) — draft reference baselines.
23. [`research-report.md`](./research-report.md) — curated summary of the canonical product + architecture research.

## Archive

Historical implementation briefs whose work has shipped. Kept for provenance; may contain stale relative links.

- [`archive/v0.2-planning-spec.md`](./archive/v0.2-planning-spec.md) — v0.2 strategic direction and acceptance criteria.
- [`archive/v0.2-implementation-spec.md`](./archive/v0.2-implementation-spec.md) — DB / auth / data-layer implementation spec.
- [`archive/v0.2-phase-d-brief.md`](./archive/v0.2-phase-d-brief.md) — integration tests + CI hardening brief.

## Frameworks

- **OFFER** = Philosophy. Outcomes First / Front the Work / Framework Driven / Earn on Outcomes / ROI-Aligned Partnerships.
- **RECOVER** = Service Delivery. Seven stages, operator-mapped: Respond / Evaluate / Capture / Offer / Verify / Escalate / Report. Buyer-facing translation: Revenue Leak Detection / Engagement Automation / Call Capture System / Outcome-Based Booking / Verification + Qualification / Economic ROI Tracking / Reporting + Retention.

ResponseOS is the software layer where OFFER + RECOVER lives.
