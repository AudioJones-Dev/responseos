# RESPONSEOS_WEBSITE_COPY_SPEC.md — Marketing Site Copy Specification

**Product:** ResponseOS
**Owner:** AJ Digital LLC / Audio Jones
**Status:** Canonical brand doc. Page-by-page copy spec for the marketing site (`app/(marketing)/`). Update via PR.
**Companion docs:** [`./RESPONSEOS_POSITIONING.md`](./RESPONSEOS_POSITIONING.md) · [`./RESPONSEOS_BRAND_VOICE.md`](./RESPONSEOS_BRAND_VOICE.md) · [`./RESPONSEOS_SALES_NARRATIVE.md`](./RESPONSEOS_SALES_NARRATIVE.md) · [`../client-facing-offer.md`](../client-facing-offer.md) · [`../pricing-and-onboarding.md`](../pricing-and-onboarding.md) · [`../DESIGN.md`](../DESIGN.md)

---

## Purpose

This is the copy spec for every public marketing page. It defines goal, audience, hero, section blocks, CTAs, proof, SEO, and the primary conversion action per page — plus global components and copy guardrails. All copy must pass the [voice review checklist](./RESPONSEOS_BRAND_VOICE.md#9-voice-review-checklist). Headline options are provided where useful; pick one per surface and keep it consistent.

### Routes in scope (already scaffolded)

| Page | Route | Phase |
|---|---|---|
| Home / landing | `/` | MVP |
| Pricing | `/pricing` | MVP |
| Industries — Home services | `/industries/home-services` | MVP |
| Industries — Contractors | `/industries/contractors` | MVP |
| Industries — Med spas | `/industries/med-spas` | Phase 2+ (compliance-gated) |
| Audit / assessment | `/audit` | MVP |
| Demo | `/demo` | MVP |

### Global guardrails (apply to every page)

- Lead with the business outcome; the AI is the mechanism, named last.
- No banned language (see [`./RESPONSEOS_BRAND_VOICE.md`](./RESPONSEOS_BRAND_VOICE.md) §3). No "Powered by AI" headlines, no "set it and forget it," no glowing-brain imagery.
- No technical jargon on these pages (no "webhook," "tenant," "state machine").
- No fabricated logos, testimonials, or stats. Any number is real or labeled illustrative/example.
- No HIPAA or compliance claim that isn't true. **ResponseOS is not HIPAA-certified.**
- Sentence-case headlines, active voice, no exclamation points.
- Primary conversion across the site funnels to **Book the Readiness Assessment** (`/audit`); secondary is **See a demo** (`/demo`).

---

## 1. Home / landing — `/`

- **Goal:** Establish the category and the leak; drive to the assessment.
- **Audience:** Owner/operator or office manager of a founder-led service business (cold).
- **Primary conversion action:** Book the Readiness Assessment.

**Hero**

- Headline options:
  - A. "Stop paying for marketing that walks into voicemail."
  - B. "Recover the revenue your business is already losing."
  - C. "Revenue Recovery Infrastructure for founder-led service businesses."
- Subhead: "ResponseOS captures every call, qualifies the lead, books the work, and reports the recovered revenue — across phone, text, and web. The receptionist is one input; ResponseOS is the recovery layer on top."
- CTAs: Primary "Book the Readiness Assessment" → `/audit`. Secondary "See a demo" → `/demo`.

**Section blocks**

1. **The leak** — "Calls during jobs, after-hours inquiries, web leads nobody worked. You paid to make the phone ring; the revenue leaks silently." (Plain, no fear-mongering.)
2. **The reframe** — "It's not an answering problem. It's a recovery problem." Short contrast with hiring/voicemail/AI-receptionist apps.
3. **How it works — the RECOVER loop** — seven compact stages in buyer language: Revenue Leak Detection · Engagement Automation · Call Capture System · Outcome-Based Booking · Verification + Qualification · Economic ROI Tracking · Reporting + Retention. One line each.
4. **What you get** — four outcome cards: missed-call response under 60s; AI inbound answering on your rules; self-schedule + self-quote; verified monthly ROI report.
5. **The proof** — the 9 KPIs as a labeled grid (no fabricated values; show as "what we report," not "results we got").
6. **Why not just an AI receptionist** — short block restating: a receptionist answers, ResponseOS recovers and proves it. Link to industries.
7. **How we work** — two phases: paid assessment first, then implementation + retainer. No performance-only pricing.
8. **Closing CTA banner** — "See what you're leaving in voicemail. Book the Readiness Assessment."

**Proof elements:** 9-KPI grid, the two-phase model, the under-60s response claim, framework transparency (RECOVER). No logos/testimonials until real ones exist (mark as a Future slot).

**SEO**

- Title: "ResponseOS — Revenue Recovery Infrastructure for Service Businesses"
- Meta: "ResponseOS captures missed calls, qualifies leads, books appointments, and reports recovered revenue for founder-led service businesses. Start with a Readiness Assessment."

---

## 2. Pricing — `/pricing`

- **Goal:** Make the two-phase motion legible and qualify-in serious buyers.
- **Audience:** Owner/operator evaluating cost vs the leak (warm).
- **Primary conversion action:** Book the Readiness Assessment.

**Hero**

- Headline: "Priced against the leak, not the hype."
- Subhead: "Every engagement starts with a paid assessment that proves the revenue is there. Then implementation plus a monthly recovery retainer — with optional fees tied to verified results. No performance-only pricing."

**Section blocks**

1. **Phase 1 — Readiness & Revenue Leak Assessment** — $1,000 flat ($750–$1,500 by size/complexity). Deliverables list: Readiness Score, Revenue Leak Estimate, AI Fit/No-Fit Diagnosis, current + recommended workflow maps, implementation scope, projected ROI, Pricing Proposal. Note the optional credit toward implementation if signed within 14–30 days.
2. **Phase 2 — Implementation + Monthly Recovery Retainer** — the three-tier table:

   | Tier | Setup | Monthly | Best for |
   |---|---|---|---|
   | Recovery Core | $2,500–$4,000 | $750–$1,250 | Simple missed-call recovery + reporting |
   | **Recovery Pro** (default) | $5,000–$8,500 | $1,500–$2,500 | AI intake, booking, quoting, CRM sync, ROI reporting |
   | Recovery Performance | $8,500–$15,000+ | $2,500–$5,000+ | Higher-volume, obvious ROI |

3. **Outcome fees** — explain plainly: optional, pick one structure, applies only to verified results above a baseline, layered on top of a base fee. State the hard rule: no performance-only pricing.
4. **Founding Client Pilot** — 90 days: $1,000 assessment + $3,500 implementation + $1,250/mo (optional $50 per qualified booked appointment after the first 10/month).
5. **What's included by tier** — reuse the feature matrix from [`../client-facing-offer.md`](../client-facing-offer.md).
6. **FAQ** — sourced from the objection table in [`./RESPONSEOS_SALES_NARRATIVE.md`](./RESPONSEOS_SALES_NARRATIVE.md) (CRM, "we don't miss that many," outcome fees, compliance).
7. **CTA banner** — "Not sure it's worth it? That's what the assessment is for."

**Proof elements:** transparent ranges, the no-performance-only rule, the credit policy, the feature matrix.

**SEO**

- Title: "ResponseOS Pricing — Readiness Assessment + Recovery Retainer"
- Meta: "Transparent two-phase pricing: a paid Readiness Assessment, then implementation and a monthly recovery retainer in three tiers. Optional outcome fees on verified results."

---

## 3. Industries — Home services — `/industries/home-services`

- **Goal:** Make the primary vertical see itself; convert to assessment.
- **Audience:** HVAC, roofing, plumbing, electrical, landscaping owners/office managers.
- **Primary conversion action:** Book the Readiness Assessment.

**Hero**

- Headline: "Every missed call is a job that went to the next contractor."
- Subhead: "ResponseOS answers, qualifies, and books inbound demand for home-services businesses — during jobs, after hours, and on weekends — then reports the recovered revenue."

**Section blocks**

1. **The home-services leak** — crew on a job, phone rings, voicemail, homeowner calls the next name on the list. Concrete and specific.
2. **The recovery loop, your way** — your hours, service area, pricing rules, escalation contacts.
3. **Built for high-ticket jobs** — average job value makes each recovered call worth real money (frame with the ROI method from the sales narrative; mark any figure illustrative).
4. **Self-quote + self-schedule** — quotes by SMS/email, deposits captured, bookings on your calendar.
5. **Your monthly recovery report** — the 9 KPIs in home-services terms.
6. **CTA banner** — "Find out how many jobs you're losing to voicemail."

**Proof elements:** RECOVER loop, 9 KPIs, the under-60s claim, fit for high-ticket jobs.

**SEO**

- Title: "ResponseOS for Home Services — Recover Missed Calls into Booked Jobs"
- Meta: "Missed-call recovery, AI intake, self-scheduling, and verified ROI reporting for HVAC, roofing, plumbing, electrical, and landscaping businesses."

---

## 4. Industries — Contractors — `/industries/contractors`

- **Goal:** Speak to general contractors and trades with project-based, high-value work.
- **Audience:** Contractor owner/operator, often the estimator and the dispatcher.
- **Primary conversion action:** Book the Readiness Assessment.

**Hero**

- Headline: "You're in the field. Your phone shouldn't cost you the bid."
- Subhead: "ResponseOS captures every inbound while you're on site, qualifies the project, and routes quote requests and bookings — so leads don't go cold before you can call back."

**Section blocks**

1. **The contractor leak** — estimating and running crews means the phone goes unanswered; bids are won on response speed.
2. **Quote-request intake** — capture project scope, route to your quoting process, follow up automatically.
3. **Qualify before you drive** — service type, geography, urgency, budget — so you spend windshield time on real jobs.
4. **Escalation to you** — high-value or complex jobs route straight to a human.
5. **Recovered revenue, proven** — the 9 KPIs framed for project work.
6. **CTA banner** — "Stop losing bids to a missed call."

**Proof elements:** quote-request intake, qualification, escalation, ROI reporting.

**SEO**

- Title: "ResponseOS for Contractors — Capture Leads and Quote Requests"
- Meta: "Answer, qualify, and route inbound project leads while you're in the field. ResponseOS recovers missed calls and quote requests and reports the revenue."

---

## 5. Industries — Med spas — `/industries/med-spas` (Phase 2+, compliance-gated)

- **Goal:** Present med-spa fit honestly, gated on privacy hardening. Do not over-promise.
- **Audience:** Med-spa owner/operator or front-desk manager.
- **Primary conversion action:** Book the Readiness Assessment (explicitly framed as a fit check).

> **Status note (visible to internal/copy team, not necessarily on-page):** Med spas require privacy-hardened mode, vetted disclosure scripts, and jurisdictional consent rules before launch. Do not publish performance claims for this vertical until a privacy-hardened pilot is live. **ResponseOS is not HIPAA-certified.**

**Hero**

- Headline: "Book more consultations without missing a call."
- Subhead: "ResponseOS answers inbound inquiries, qualifies interest, and books consultations for med spas — with privacy-aware handling and disclosure language configured to your jurisdiction."

**Section blocks**

1. **The front-desk leak** — calls during treatments and after hours go unanswered; prospective clients book elsewhere.
2. **Consultation booking** — qualify interest and book directly to your calendar.
3. **Privacy-aware by design** — configured disclosure language and consent handling. State plainly what ResponseOS is and is not certified for; no HIPAA claim.
4. **Recovered bookings, reported** — the 9 KPIs in med-spa terms.
5. **CTA banner** — "See if ResponseOS is a fit for your practice."

**Proof elements:** consultation booking, privacy-aware configuration, honest compliance posture, ROI reporting.

**SEO**

- Title: "ResponseOS for Med Spas — Capture Inquiries, Book Consultations"
- Meta: "Answer and qualify inbound inquiries and book consultations for med spas, with privacy-aware handling and jurisdiction-aware disclosures. ResponseOS is not HIPAA-certified."

---

## 6. Audit / assessment — `/audit`

- **Goal:** Sell the Readiness & Revenue Leak Assessment as the obvious first step.
- **Audience:** Warm owner ready to size the leak.
- **Primary conversion action:** Book / request the assessment (the site's main conversion).

**Hero**

- Headline: "Find out what you're leaving in voicemail."
- Subhead: "The ResponseOS Readiness & Revenue Leak Assessment sizes your missed demand, scores your AI-readiness, and gives you a straight fit/no-fit answer before any install."

**Section blocks**

1. **What it is** — a paid diagnostic; $1,000 flat ($750–$1,500 by complexity). Optional credit toward implementation if you sign within 14–30 days.
2. **What we evaluate** — missed-call volume, after-hours demand, average job value, close rate, current response time, lead sources, CRM/booking/quote/follow-up workflows, compliance risk, AI fit/no-fit.
3. **What you walk away with** — Readiness Score, Revenue Leak Estimate, AI Fit/No-Fit Diagnosis, current + recommended workflow maps, implementation scope, projected ROI, Pricing Proposal.
4. **The honest part** — "If the numbers don't justify implementation, we tell you. You keep the workflow map and the leak estimate either way."
5. **The verbatim positioning paragraph** — use the assessment paragraph from [`./RESPONSEOS_SALES_NARRATIVE.md`](./RESPONSEOS_SALES_NARRATIVE.md) §7.
6. **CTA** — "Book your Readiness Assessment."

**Proof elements:** the deliverable list, the fit/no-fit honesty, transparent price + credit policy.

**SEO**

- Title: "ResponseOS Readiness & Revenue Leak Assessment"
- Meta: "A paid diagnostic that sizes your missed demand, scores AI-readiness, and gives a fit/no-fit answer before any implementation. Deliverables include a leak estimate and projected ROI."

---

## 7. Demo — `/demo`

- **Goal:** Let a hesitant buyer see the mechanism before committing to the assessment.
- **Audience:** Owner who wants to see it work first.
- **Primary conversion action:** Request a demo; secondary nudge to the assessment.

**Hero**

- Headline: "See the recovery loop in action."
- Subhead: "Watch ResponseOS answer a missed call, qualify the lead, book the appointment, and post the recovered revenue to the report — using example data."

**Section blocks**

1. **What you'll see** — a walkthrough of Respond → Evaluate → Capture → Offer → Verify → Escalate → Report, with example data clearly labeled.
2. **The operator and client views** — the operator console (what AJ Digital runs) and the client portal (what you'd see), without internal jargon.
3. **From demo to your numbers** — the demo shows the mechanism on example data; the assessment shows your real leak. Bridge to `/audit`.
4. **CTA** — Primary "Request a demo." Secondary "Or book the Readiness Assessment."

**Proof elements:** the RECOVER loop shown end to end, the 9-KPI report view, clearly-labeled example data (no fabricated client results).

**SEO**

- Title: "ResponseOS Demo — Watch the Revenue Recovery Loop"
- Meta: "See how ResponseOS recovers a missed call into a booked, reported job — from response to ROI — using example data."

---

## 8. Global components copy

### Navigation

- Items: Home · Industries (Home services, Contractors, Med spas) · Pricing · How it works (anchor to RECOVER on `/`) · Demo · **Book the assessment** (primary button).
- Logo links to `/`. Primary nav button is the assessment CTA in the accent color.

### Footer

- Tagline: "Revenue Recovery Infrastructure for founder-led service businesses."
- Columns: Product (Home, Demo, Pricing) · Industries · Company (About AJ Digital, Contact) · Legal (Privacy, Terms).
- Legal/compliance line: "ResponseOS is built by AJ Digital LLC. ResponseOS is not HIPAA-certified." (Keep this line accurate and visible.)
- Copyright: "© [year] AJ Digital LLC."

### CTA banners (reusable)

- Primary: "See what you're leaving in voicemail." → Book the Readiness Assessment.
- Secondary: "Want to see it first?" → See a demo.
- Pricing-context: "Not sure it's worth it? That's what the assessment is for."

### Microcopy

- Form success: "Thanks — we'll be in touch to schedule your assessment."
- Form error: "We couldn't submit that. Check your details and try again, or email us."
- Loading: keep neutral and brief; no hype.

---

## 9. Copy guardrails (summary)

All copy must comply with [`./RESPONSEOS_BRAND_VOICE.md`](./RESPONSEOS_BRAND_VOICE.md). The non-negotiables for this site:

- Outcome first; AI is the mechanism, named last.
- Use the lexicon's Use column; nothing from the Avoid/banned lists.
- No technical jargon on public pages.
- Numbers are real or clearly labeled illustrative/example. No fake logos, testimonials, or stats.
- No HIPAA/compliance claims that aren't true.
- Sentence-case headlines, active voice, no exclamation points.
- Funnel converges on the Readiness Assessment.

---

## 10. MVP vs Phase 2 vs Future

| Item | Phase | Notes |
|---|---|---|
| Home, Pricing, Home-services, Contractors, Audit, Demo copy | **MVP** | Ship with the public marketing surface |
| Med-spas page live with claims | **Phase 2+** | Gated on privacy-hardened pilot; fit-check framing only until then |
| White-label / partner marketing surfaces | **Phase 2** | Branded portals land in v0.3+; partner-facing copy is a separate spec |
| Real customer logos / testimonials / case studies | **Future** | Only after real, attributable results exist; placeholder slots stay empty |
| Additional verticals (auto repair, real estate, legal/medical) | **Future** | Each gated on its compliance lane (see [`../product-spec.md`](../product-spec.md)) |
| Interactive ROI calculator on `/audit` | **Future** | Must label outputs illustrative until backed by real benchmarks |

---

## Assumptions

- The seven routes above are the full public marketing surface for MVP; no blog/resources hub in scope yet.
- The assessment is the single primary conversion site-wide; demo is the secondary path.
- Visual system (dark-first, Signal Yellow primary with critical/warning urgency states) is governed by [`../DESIGN.md`](../DESIGN.md); this spec covers copy only.

## Open questions

- Does `/industries/med-spas` ship in MVP as a fit-check page, or stay unlinked until the privacy-hardened pilot is live? (Recommendation: build the copy now, gate the live link until the pilot.)
- Do we want a dedicated "how it works" page, or keep RECOVER as an anchor section on the home page? (Default today: anchor section.)
- Should pricing show full ranges publicly or gate exact numbers behind the assessment? (Default today: show ranges; exact quote lives in the Pricing Proposal.)
