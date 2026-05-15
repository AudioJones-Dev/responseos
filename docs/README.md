# ResponseOS — Docs

ResponseOS is the AI Revenue Recovery Platform built by AJ Digital LLC. This `docs/` directory is the canonical product source of truth: positioning, data models, API contracts, automation flows, environment, deployment posture, and security stance.

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
