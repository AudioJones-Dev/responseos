# Pricing and Onboarding

> **Commercial status:** The amounts, legacy Recovery-tier names, included
> usage, overages, pilot terms, and default quote in this document are
> provisional planning material—not newly validated or approved public pricing.
> ADR-0028 governs the go-forward pricing-model structure while specific price
> points and contract terms remain open and unpublished. The approved opening
> posture makes clients commercially responsible for attributable variable
> usage, uses direct billing where compatible or pass-through plus an explicit
> administration/platform fee, and defers bundled allowances. The numeric
> qualification figures below are evidence prompts, not automatic gates. The
> conflicting usage, overage, and qualification language is retained as prior
> planning and is superseded by this opening posture. See the
> [client-delivery canon reconciliation](./ops/client-delivery/RESPONSEOS_CANON_RECONCILIATION.md).

Commercial strategy and onboarding workflow for ResponseOS. This is documentation only. None of the pricing, outcome-fee, billing, or invoicing logic described here ships as code in v0.2; that work is roadmapped for v0.5 (see "Roadmap and what is intentionally not built yet" at the end).

> **Two doctrine constraints govern this document.** (1) **Diagnostic-first is immutable** — the assessment must be permitted to conclude *no fit*, *not ready*, *use something simpler*, or *use another vendor*; it is a product-quality and trust mechanism, not a lead-generation tactic ([doctrine §7](./strategy/responseos-platform-doctrine-v1.md)). (2) **Outcome fees are not billable until the attribution and dispute process is operationally validated** — the Revenue Gate in doctrine §18, ratified by ADR-0042. Estimated revenue is not recovered revenue; booked revenue is not collected revenue; influence is not causation. The **public pricing model** is capacity-based Business-Memory tiers per ADR-0028, with the Recovery-tier naming below retained as the engagement/outcome-fee structure; **price points remain open** pending the Phase 3 cost model.

## Why this exists

ResponseOS is sold as a **Business Memory system that delivers revenue recovery** (ADR-0046), not as a generic "AI receptionist install." Public quotes use the **Recovery Core / Pro / Performance** table (matches the shipped site and `EngagementTier`). Memory capacity tiers (ADR-0028) stay planning-only until the v0.5 billing engine. First 1–3 pilots may invoice **manually** (Stripe Dashboard).

That positioning only holds if every engagement starts with proof that revenue is leaking and that the client is operationally ready to plug it. So the commercial motion is two phases, in order:

1. **Phase 1 — ResponseOS Readiness & Revenue Leak Assessment.** A paid diagnostic that decides whether ResponseOS should be implemented at all.
2. **Phase 2 — ResponseOS Implementation + Monthly Revenue Recovery Retainer.** The recurring offer, anchored by a setup fee, a monthly fee, and an optional outcome fee tied to verified results.

Outcome fees are upside, never the entire deal. Performance-only pricing is not offered.

## Phase 1 — Readiness & Revenue Leak Assessment

### Purpose

Before any implementation conversation, the assessment answers two questions:

- Is this business **AI-ready** — operationally, technically, and from a compliance standpoint?
- Is there **enough revenue leakage** to justify implementation cost and earn a clear ROI multiple?

If the answer to either question is no, the engagement stops here. The deliverable is still valuable — the client gets a workflow map, a leak estimate, and a fit/no-fit diagnosis — but ResponseOS does not get installed.

### Pricing

| Item | Amount |
|---|---|
| Standard assessment | **$1,000 flat** |
| Range by size and complexity | $750 – $1,500 |
| Optional credit policy | Apply 100% of the assessment fee toward implementation if client signs within 14–30 days |

The credit policy is optional per engagement. Use it as a closing lever, not a default discount.

### What the assessment evaluates

The diagnostic covers the operational, demand, and compliance shape of the business:

- Missed-call volume.
- After-hours demand.
- Average job value.
- Close rate.
- Current response time.
- Lead sources.
- CRM readiness.
- Booking workflow.
- Quote workflow.
- Follow-up process.
- Calendar readiness.
- Staff escalation process.
- Compliance risk.
- AI-fit / no-fit diagnosis.

### Assessment deliverables

The client receives a written packet covering:

- ResponseOS Readiness Score.
- Revenue Leak Estimate.
- AI Fit / No-Fit Diagnosis.
- Current Workflow Map.
- Recommended Future Workflow.
- Implementation Scope.
- Projected ROI.
- Pricing Proposal.

The Pricing Proposal at the end of Phase 1 is the bridge into Phase 2.

## Phase 2 — Implementation + Monthly Revenue Recovery Retainer

Phase 2 only starts after a passed assessment and a signed Pricing Proposal. It always combines a one-time setup fee with a recurring monthly fee. An optional outcome fee may be layered on top.

### Tiers

#### 1. Recovery Core

- **Setup:** $2,500 – $4,000
- **Monthly:** $750 – $1,250 / month
- **Best for:** Small service businesses with simple missed-call recovery, SMS follow-up, basic intake, and reporting.

#### 2. Recovery Pro

- **Setup:** $5,000 – $8,500
- **Monthly:** $1,500 – $2,500 / month
- **Best for:** The default offer. Includes AI voice intake, missed-call text-back, booking workflow, quote request workflow, CRM/calendar integration, lead scoring, escalation rules, and ROI reporting.

#### 3. Recovery Performance

- **Setup:** $8,500 – $15,000+
- **Monthly:** $2,500 – $5,000+ / month
- **Best for:** Higher-volume clients where ROI is obvious and measurable.

### Optional outcome / performance fees

Pick **one** of the following structures per engagement, layered on top of setup and monthly. Do not stack multiple outcome fees on the same client.

- $25 – $150 per qualified booked appointment.
- $25 – $100 per verified recovered lead.
- 3% – 8% of verified recovered revenue.
- $500 – $2,000 bonus after an agreed booked-job threshold.

**Hard rule:** there is no performance-only pricing. Every engagement carries a base setup fee and a base monthly fee. Outcome fees are upside.

## Founding Client Pilot

An optional early-client package designed for the first cohort of pilots. Use it to lock in case studies and reference accounts.

| Item | Amount |
|---|---|
| Assessment | $1,000 |
| Implementation | $3,500 |
| Monthly | $1,250 / month |
| Pilot length | 90 days |
| Optional outcome fee | $50 per qualified booked appointment after the first 10 per month |

**Pilot scope includes:**

- Readiness assessment.
- Missed-call recovery.
- AI intake / answering pilot.
- Lead qualification workflow.
- Booking or quote request flow.
- Monthly revenue recovery report.
- Two optimization cycles.

## Usage and pass-through cost policy

> **Opening-policy override:** The bundled allowances and percentage margin
> below are retained as prior planning and are not approved opening terms.
> Current planning uses compatible direct client billing or pass-through plus
> an explicit administration/platform-management fee. The fee amount remains
> unknown pending separate approval.

Voice, SMS, and AI usage is real money. The policy is to either bundle it with a fair-use cap or bill it through transparently with a management margin.

### Suggested included usage

| Tier | Included AI voice minutes / month |
|---|---|
| Recovery Core | up to 300 |
| Recovery Pro | up to 750 |
| Recovery Performance | up to 1,500 |

### Overage and alternatives

- **Overage:** cost + 20% management margin.
- **Alternative:** software / usage billed separately at cost + management fee.

The choice between bundled-with-cap and pass-through-with-margin is per engagement. Document which model is in force on each Pricing Proposal.

## Client qualification gates

> **Opening-policy interpretation:** The numeric figures below are evidence
> prompts, not automatic pass/fail gates. Fit/no-fit requires engagement-specific
> evidence and approval.

ResponseOS implementation only proceeds when the client clears the minimum gates. These gates are checked during the assessment and recorded in the AI Fit / No-Fit Diagnosis.

- Average job value preferably **$300+**.
- Meaningful missed-call volume — ideally **20+ missed calls / month**.
- Clear booking or quote process.
- Owner / staff buy-in.
- CRM / calendar access available.
- Compliance risk low for first clients.
- Measurable ROI path exists.

### Verticals to avoid for first pilots

Do not run first pilots in:

- Medical.
- Legal.
- HIPAA-regulated workflows.
- Sensitive regulated workflows.

These verticals are off the menu unless the compliance lane is explicitly hardened and reviewed (BAA chain in force, recording / retention policy reviewed, jurisdictional consent rules confirmed). See `docs/SECURITY.md` and `docs/product-spec.md` "Vertical roadmap" for the gating rules.

## Client-facing positioning

Use this paragraph verbatim or near-verbatim in sales conversations and proposals:

> "Before I recommend AI automation, I run a ResponseOS Readiness Assessment. The goal is to determine whether your business is actually ready for AI response automation and whether the ROI is strong enough to justify implementation. If the numbers make sense, we install ResponseOS to capture missed demand, qualify leads, trigger follow-up, route booking or quote requests, and report recovered revenue monthly."

## Recommended default quote

When in doubt, this is the quote to send.

| Phase | Item | Amount |
|---|---|---|
| Phase 1 | ResponseOS Readiness Assessment | $1,000 |
| Phase 2 | ResponseOS Recovery Pro Implementation | $5,000 setup |
| Phase 2 | Monthly retainer | $1,500 / month |
| Optional | Outcome fee | $50 per qualified booked appointment after the first 10 per month |

## Roadmap and what is intentionally not built yet

This document is **commercial strategy only**. The following are explicitly out of scope for v0.2:

- Pricing engine.
- Stripe billing implementation.
- Outcome-fee ledger.
- Client invoice logic.
- In-app pricing tier selectors.

These belong in a later milestone — currently roadmapped for **v0.5** — once the v0.2 data foundation, the v0.3 live integrations, and at least one production pilot are in place. See `docs/ROADMAP.md` for the v0.2 boundary and the v0.3 preview, and `docs/client-facing-offer.md` for the buyer-facing summary of these tiers.
