# ResponseOS — Website Executive Findings (external research, reconciled)

**Owner:** AJ Digital LLC / Audio Jones
**Status:** Research input — **not a decision.** Nothing here ratifies an ADR, changes the roadmap, or authorizes a build. Where it conflicts with [`DECISIONS.md`](../DECISIONS.md) or the [platform doctrine](../strategy/responseos-platform-doctrine-v1.md), those win (doctrine §1.2).
**Source:** *A. Executive Findings* (25-page PDF, sections A–R plus sources), supplied by the operator on 2026-09-28. The PDF itself is not committed; this file keeps its substance, IDs, and tables in condensed form.
**What the research looked at:** screenshots of the homepage, `/demo`, `/pricing`, `/trust`, and `/industries/home-services`, plus public competitor material current to September 2026. **The screenshots were taken before the owner's copy redlines ([#163](https://github.com/AudioJones-Dev/responseos/pull/163)) merged**, so several findings describe copy that has already changed.
**Reconciled against:** `master` at `724a3e5` on 2026-09-28. §3 and §12 record what is already addressed, what this PR addressed, and what stays open.

> **Integrity note.** Competitor pricing and features come from the report and were not re-verified for this file. They change quickly; treat every vendor fact as "as reported, Sept 2026 — verify before reuse." The report's own "search alignment" column is a qualitative judgment, not keyword-volume data.

---

## 1. Thesis

ResponseOS's strongest credible position is neither "AI receptionist" nor "another CRM." It is a **demand-to-revenue recovery workflow for service businesses**: it makes one inbound opportunity traceable from a missed or mishandled contact through follow-up, qualification, booking, handoff, and financial attribution.

That framing is only differentiated if the site **shows the chain visually** and **states which links are live, simulated, or planned**. The site's visual identity is not the problem. Its weakness is **evidence density**: it explains the concept in copy and cards, while the buyer needs to see what happens to one missed call across time, systems, people, and revenue.

The report's bottom line: evolve from "a polished thesis site" into "an evidence-led product narrative." The most important change is one inspectable account of a single opportunity moving from missed demand to an accountable outcome, with honest labels on what is live, what is simulated, and what needs production evidence first. More copy, gradients, cards, or stock photography would not do that.

## 2. The fifteen findings (condensed)

1. **Lead with the economic event, then show the chain.** "Missed call" is immediately legible; "revenue recovery operating system" is differentiated but abstract.
2. **The call-answering layer is crowded.** Smith.ai, Goodcall, Podium, Birdeye, ServiceTitan, Workiz, and voice-agent platforms all promise some mix of answering, qualification, scheduling, text-back, and booking. "Reply in seconds," "never miss a call," and "book jobs 24/7" do not differentiate.
3. **The defensible wedge is attribution and operational continuity.** It is not unique by assertion, though: ServiceTitan's voice-agent dashboard already reports call outcomes, booked jobs, booking rate, revenue from booked jobs, recordings, transcripts, and escalation reasons. ResponseOS has to show a clearer, vendor-neutral, cross-workflow version of the chain, or narrow its ICP.
4. **Build one visual "Recovery Record"** (§6) instead of decorative product shots.
5. **Keep the guided demo, but make it product-led.** A labeled seeded walkthrough is safer than a pretend live app. Navattic's 2026 guidance favors 5–13 steps per flow. Build natively now; consider Navattic, Storylane, or Arcade only after real, stable UI exists.
6. **The $1,000 assessment works, but should not be the only main CTA.** Pair it with a lower-friction "see the recovery loop" path.
7. **Pricing must explain the business model more than it must reveal every number.** "Outcome fees" need a defined measurement basis before public copy leans on them.
8. **Vertical pages must change the operating scenario, not just the headline** (§10).
9. **Keep trust communication truthful and layered.** Separate documented architectural controls from certifications; do not imitate SOC 2 / PCI / ISO badge walls.
10. **No generic human imagery as decoration.** Use technician or customer context only when it anchors a specific scenario.
11. **A missed-revenue calculator is viable as a scenario tool, not a revenue promise.** It should use ranges and visible assumptions, and keep "opportunity exposed" separate from "revenue recovered."
12. **The homepage underweights product proof.** The recommended order is outcome → visual proof → specific workflow → fit → evidence/trust → conversion.
13. **Implementation anxiety deserves first-class treatment:** number porting and forwarding, routing, CRM ownership, duplicates, escalation, staff adoption, booking rules, auditability.
14. **Replace social proof with product proof** until production proof exists. That means no logo walls, invented ROI, anonymous testimonials, or synthetic dashboards.
15. **The thesis has real disconfirming evidence.** Suites (ServiceTitan, Podium, Workiz, Housecall Pro) keep extending into calls, SMS, booking, and reporting. ResponseOS must prove superior recovery and attribution execution, faster deployment across incumbent systems, a more focused operator workflow, or a service-model advantage.

## 3. Reconciliation against `master`

What the screenshots showed, what `master` shows now, and where each item stands.

| Report observation (pre-#163 screenshots) | `master` @ `724a3e5` | Status |
|---|---|---|
| Hero "The revenue your service business already earned — recovered." | "Stop losing revenue to missed calls." with a "designed to" subhead — `app/(marketing)/page.tsx` | **Addressed by #163** |
| Primary CTA "Run a revenue audit" everywhere (finding 6, CRO-001, HOME-004) | "Revenue Recovery Demo" is primary and the assessment is secondary, per ADR-0035 and #163 | **Addressed.** The report's three-tier hierarchy (explore / assess / talk implementation) is still open. |
| Stat band "< 60s", "24/7", "1 ledger — Every event tied to recovered revenue" | "Under 60s — *Target* first response", "24/7 — *Designed* coverage", "9 KPIs — what the report is *designed* to track" | **Partly addressed.** The universal attribution claim is gone. "Under 60s" and "24/7" are hedged as targets, but §12 still rates them "not publishable" without production telemetry. **Owner decision.** |
| Pricing hero "Priced against the revenue we recover" | "Priced against the leak, not the hype." | **Addressed by #163** |
| Pricing "Most popular" badge | "Default offer" | **Addressed by #163** |
| Pricing "Earn-on-outcomes structure" / "earn on the revenue we recover" (PRICE-003) | Tier bullet "Earn-on-outcomes structure" and homepage OFFER card "Earn on Outcomes" remain; "the revenue we recover" is gone | **Open — owner decision.** Doctrine §14.3 already forbids charging outcome fees before the Revenue Gate. The report asks public copy to say so. |
| Home-services "Reply in under 30 seconds" | Now "under 60 seconds" | **Addressed by #163** (figure). The present-tense framing was still live; see the next row. |
| Home-services and contractors pages stated mock-backed capabilities in the present tense ("captures the missed call… replies in seconds… books the estimate", "routes inbound to the right estimator") | Reworded to "designed to…" | **Addressed in this PR.** These were leftovers from #163, whose stated intent was "designed rather than live" across the industry pages. |
| Demo FAQ "Will I be locked into one phone or CRM vendor? No… built to route around any single provider" | "ResponseOS uses provider-adapter boundaries to reduce coupling. Actual portability still depends on…" | **Addressed.** Matches doctrine §20.1 and ADR-0043. |
| Demo labeling only in FAQ (DEMO-002) | `DemoDataBanner` renders on every `/demo/walkthrough/*` step | **Addressed** for the walkthrough. The marketing `/demo` page still carries its label in body copy and FAQ, not a persistent banner. |
| Trust page controls stated as current fact (TRUST-002) | Checked against the code for this file (§12). Four of six controls overstated the implementation: the event ledger, per-tenant retention, deletion/export, and the Stripe payment boundary | **Addressed in this PR** for accuracy: each control now says what is in place and what is planned. The trust-center structure and "Implemented / In validation / Not claimed" taxonomy (TRUST-001/002) are still open. |
| No privacy policy or terms linked (§9) | Still none. No privacy, terms, or legal route exists, and `/audit` collects lead contact details through `AuditRequestForm` | **Open — owner action.** The report says to link a real policy before collecting meaningful lead data. |
| Maturity disclosure only in footer (HOME-005, CRO-002) | Footer plus Trust "Where the build is today"; footer now carries the not-HIPAA-certified line (#163) | **Open.** No structured product-status block near the product UI yet. |

**Tensions with ratified decisions** (the report did not see these):

- **ADR-0035** fixes the primary vertical as **General Home Services**, with Florida Ramp & Lift as the anchor case. The report recommends starting with 2–3 deeply differentiated trade pages (HVAC, plumbing, roofing/electrical). These can coexist (trade scenarios *inside* the home-services pitch), but making separate trade pages the primary entry would need an ADR-0035 amendment.
- **ADR-0028** made capacity-based memory tiers the public pricing model, superseding the Recovery Core/Pro/Performance naming. `/pricing` still shows the Recovery tiers. That drift pre-dates this report, and the report's pricing advice (§8) applies to either naming. A pricing & commercial doctrine is in flight separately; do not change `/pricing` structure from this document.
- **Doctrine §6.2** already says "operating system" should not open SMB-facing copy. That matches the report's positioning table (§4).

## 4. Positioning

| Position | Comprehension | Differentiation | Credibility now | Strategic risk |
|---|---|---|---|---|
| AI receptionist + revenue recovery | High | Moderate (crowded) | Moderate while live call behavior is unverified | Collapses into a point tool; invites comparison with cheaper call-answering vendors |
| Revenue recovery platform for service businesses | Moderate | High if visually proven | High when claims are about workflow visibility, not outcome guarantees | Can read as consulting jargon or collections / revenue-cycle software |
| **Missed-demand recovery system** | High once explained | High | **High now** — describes the intended workflow without claiming live autonomy | "Demand" needs a "calls, texts, web leads" clarifier |
| AI revenue operations platform | Low–moderate | Moderate | Low | Too SaaS-heavy; implies Salesforce-style RevOps |
| Revenue recovery operating system | Moderate | High | Moderate | Sounds grand; outruns current maturity |
| Service-business lead recovery platform | High | Moderate | High | Resembles lead-gen or call-center tooling |
| Demand-to-revenue recovery layer | Moderate | High | High for integration-centric buyers | "Layer" is technical; owners do not buy layers |

**Recommended language by stage:**

- **Current-state category statement:** "ResponseOS is a revenue-recovery workflow for service businesses. It helps operators track missed and inbound demand through follow-up, qualification, next action, and revenue evidence — using clearly labeled simulated workflows while production integrations are being validated."
- **Current-state headline candidates:** "When demand slips, ResponseOS keeps the next action — and the evidence — moving." / "Turn missed demand into a tracked recovery workflow."
- **Near term, once live call/CRM/booking behavior is verified:** "The demand-to-revenue recovery platform for service businesses."
- **Future, after production evidence and multi-provider maturity:** "The revenue recovery operating system for service businesses."

Feature claims ("AI answers calls and texts back") are supporting proof, never the category. The **workflow** ("missed demand becomes a qualified, owned, tracked next action") is the primary mechanism. The **outcome** ("recover opportunities that would otherwise disappear") is the primary promise, bounded by transparent language.

## 5. Homepage content order

The report explicitly says **not** to redesign the homepage until product state and visual assets are inventoried. It prescribes content order, not layout:

1. Recognizable commercial problem — "The call ends; the opportunity should not."
2. Product evidence — one seeded Recovery Record showing exactly what happens next.
3. How it works — a five-stage RECOVER loop tied to that visual.
4. Why this is different — answering service vs. CRM vs. ResponseOS.
5. Vertical relevance — HVAC / plumbing / electrical / roofing scenarios.
6. Evidence and governance — what is tracked, what is simulated today, what goes live later.
7. Implementation confidence — routing, CRM, escalation, ownership, onboarding.
8. Conversion choices — see the guided workflow; run the assessment; request an implementation conversation.

Preferred architecture: **problem → outcome → CTA → product proof.** "Outcome → visualization → social proof" is for later, once real proof exists. "Industry pain → consequence → demonstration" is the vertical-page pattern.

## 6. The canonical visual: the Recovery Record

The report calls this "the highest-value missing visual." It is one seeded record, permanently labeled as simulated, reused on the homepage, platform page, demo, industry pages, pricing explanation, and assessment deliverable:

| Timeline | Example state |
|---|---|
| 6:42 p.m. | Incoming call unanswered |
| 6:42:08 p.m. | Response initiated |
| 6:43 p.m. | Caller states need / urgency |
| 6:44 p.m. | Qualification fields captured |
| 6:45 p.m. | Lead assigned / escalation triggered |
| 6:49 p.m. | Appointment requested or booked |
| Later | CRM / FSM record reconciled |
| Later | Revenue state: pending, attributed, not recovered, or unknown |

Its final row should use ADR-0042's revenue states (`ESTIMATED` … `UNATTRIBUTED`), which are themselves `DOCUMENTED_ONLY` today, so a seeded record may show them only as illustrative.

**Mock-data safeguard:** every mock UI surface carries a persistent, readable label such as "Guided product simulation — seeded scenario, not live customer data." It belongs in the UI, not the footer.

**Other missing visuals, in priority order:** missed-call event with timestamp/state; SMS / callback / human-escalation branch; qualification rubric (replacing the bare "0–100" score); CRM/FSM record with field-level provenance; booking / estimate / dispatch outcome; attribution view that keeps unknown states visible; escalation / audit log; a system-boundary diagram of simulated vs. live scope; an assessment-deliverable preview.

Use product UI for what the system records, decides, assigns, or proves. Use diagrams for how systems and people connect. Keep LLMs, APIs, webhooks, and queues out of buyer-facing diagrams until the Trust or implementation page.

## 7. Demo strategy

**Recommended journey:** begin at the missed call, not the dashboard → the exact event (time, source, disposition, caller context) → one response path (SMS, callback task, or escalation — not all at once) → qualification (service area, urgency, job type, contactability, preferred next step) → ownership (who acts, by when) → CRM/record capture → booking **or a clearly labeled unresolved state** → attribution ("booked", "pending", "not recovered", "unknown") → a choice: another scenario, the assessment deliverable, or an implementation conversation.

| Demo type | Fit now | Near term | Future |
|---|---|---|---|
| Native guided demo | **Best choice now** | Strong | Strong |
| Seeded dashboard | Strong, with explicit labels | Strong | Strong |
| Founder-led 60–90 s video | Strong as supporting media | Strong | Strong |
| Embedded interactive (Navattic/Storylane) | Conditional — verified screens only | Strong | Strong |
| Live sales demo | Selectively, for assessment buyers | Strong | Strong |
| Sandbox | Not appropriate | Conditional | Strong for mature flows |
| Free trial / self-serve | Premature | Conditional | Once onboarding is production-grade |

## 8. Pricing findings

The report reads **$1,000 assessment → scoped setup + monthly retainer → optional outcome fee** as commercially plausible for an operator-led implementation offer. It compares to a managed revenue-workflow engagement, not a $79/month AI receptionist. The page still has to answer five questions:

1. **What does $1,000 buy?** An inbound-demand map, baseline assumptions, missed-demand surface, routing/CRM constraints, workflow recommendation, implementation scope, measurement plan, credit terms, exclusions.
2. **What does setup + monthly cover?** Workflow design, provider configuration, QA, operating support, reporting, iteration, training, escalation coverage — whichever are true.
3. **What is the unit of scale?** Calls, locations, channels, CRM complexity, workflows, service areas, users, or support hours. "Sized to your volume" alone is not evaluable.
4. **What counts as "recovered revenue"?** This is the highest-risk term. It needs an attribution rule, time window, duplicate-call logic, rebooked-customer treatment, cancellations and refunds, and a source-of-truth hierarchy. **This is doctrine §14 and ADR-0042; the report reaches the same conclusion independently.**
5. **What is live now?** Pricing must not imply deployment of gated integrations.

**Current-state direction:** keep the published assessment price. Turn "How the retainer works" into an explicit operating model. Replace unbounded outcome language with: *"Outcome-aligned structures are considered only when the workflow, source data, attribution rules, and production measurement are verified."* Add "What happens after the assessment." Use "starting scope" / "custom implementation" rather than invented price bands. **Near term:** publish a starting implementation price only after delivery economics stabilize. **Future:** publish outcome-fee mechanics only after contract terms, attribution, and production evidence exist. That is doctrine §18's Revenue Gate and open decision D-3.

## 9. Trust strategy

- **Current:** publish only controls verified against implementation and tests (§12). Plain-language trust center organized by security, data, payments, privacy, product status. Suggested message: *"Built with account-scoped data boundaries, event history, deliberate payment separation, and data-retention controls. Live provider connections are staged and are not represented as generally available until verified."* Link a real privacy policy and terms **before** collecting meaningful lead data. Avoid "privacy-first" and "enterprise-grade" unless substantiated.
- **Near term:** system diagrams, threat-model summary, subprocessor list, encryption specifics, access-control model, incident contact — only once they exist and are approved.
- **Future:** certifications, audit reports, questionnaires, pen-test summaries, uptime commitments.
- **HIPAA:** keep the direct disclaimer. No healthcare-adjacent marketing until compliance posture, BAAs, and vendor chain are independently validated (ADR-0004). Do not borrow ServiceTitan-style badge architecture.
- **Product maturity** is a strategic asset: move it from fine print into a structured "Product status" block. The report's taxonomy for this is **Implemented / In validation / Not claimed**. It maps onto doctrine §2.1's `SHIPPED` / `PARTIALLY_SHIPPED` / `DOCUMENTED_ONLY`–`ROADMAP`.
- **Proof ladder:** product proof → methodology → pilots → case studies → benchmarks. Design partners are named only with permission.

## 10. Industry page framework

A vertical page is meaningful only if it changes the buyer's operational reality.

| | HVAC | Plumbing | Roofing | Electrical | Landscaping |
|---|---|---|---|---|---|
| Missed-demand scenario | No-cooling / no-heat after hours | Leak, no water, backup | Storm damage / leak / inspection | Power loss / safety / service request | Estimate request / recurring / seasonal backlog |
| Urgency logic | Temperature, vulnerable occupants, outage | Active damage, safety, shutoff | Weather, active leak, insurance timeline | Safety risk, outage, commercial continuity | Route area, service type, season, property size |
| Qualification inputs | System type, issue, zip, urgency, existing customer | Emergency status, water source, property type, area | Roof type, storm date, insurance, photos | Residential/commercial, panel/service issue, safety | Property type, acreage, category, frequency |
| Next action | Emergency dispatch / priority callback / appointment | Emergency escalation / scheduled tech | Inspection / estimate / storm queue | Safety escalation / tech booking | Estimate route / recurring quote / follow-up |
| Key objection | "Can it handle after-hours emergencies?" | "Will it mis-triage urgent calls?" | "What happens during call surges?" | "Will it escalate safety-critical situations?" | "Can it qualify estimates without wasting office time?" |
| UI story | 6:42 p.m. no-cooling call | Active leak call | Storm-day call burst | Electrical safety call | New estimate inquiry |

**Page template:** vertical hero ("When [event] calls after hours, the next action cannot wait") → the leakage scenario → an industry Recovery Record → qualification criteria → escalation and human handoff (what the system does **not** decide alone) → operational integration, only what is available → attribution example, including what remains unknown → vertical FAQ → assessment CTA → proof, verified only.

## 11. Objection matrix (condensed)

| Objection | Website answer needed | Page |
|---|---|---|
| "I already have an answering service." | Answering is one event; show demand through ownership, booking, attribution. Concede that pure call coverage may not need ResponseOS. | Home, platform, FAQ |
| "My office answers the phone." | Show overflow, after-hours, delayed follow-up, context loss, unowned callbacks | Home, industry |
| "Customers don't want to talk to AI." | Human-escalation boundaries, role of SMS/callback, scenario safeguards | Demo, FAQ, trust |
| "What if the AI gets it wrong?" | Confidence boundaries, fallback rules, human handoff, audit history | Platform, demo, trust |
| "Will it mess up my CRM?" | Field mapping, provenance, source-of-truth policy, reconciliation, rollback, staged rollout | Platform, integrations, FAQ |
| "How do I know recovered revenue is real?" | Attribution method, source of truth, time window, unknown/duplicate states, exclusions | Platform, assessment, pricing |
| "Does it work with ServiceTitan / Jobber / GHL?" | Verified integration status only; otherwise an assessment-based compatibility review | Integrations, FAQ |
| "What about emergencies?" | Escalation tree, emergency disclaimers, human transfer, when not to automate | Vertical, trust, FAQ |
| "Is this replacing employees?" | Coverage, consistency, context, routing — not replacement | Home, FAQ |
| "Will I lose my phone number?" | Deployment model: keep number / forwarding / porting / approval stage | Implementation, FAQ |
| "What happens when a caller calls again?" | Identity matching, event history, open-case handling — **only once implemented** | Platform, technical FAQ |
| "How long does setup take?" | Assessment → discovery → test → controlled rollout → acceptance; no exact time claims unless measured | Assessment, implementation |
| "Why not a cheaper AI tool?" | Total workflow scope, accountability, measurement, operator support | Pricing, FAQ |

## 12. Claims risk register, reconciled

"Report verdict" is the report's "can publish now?" column. "Repo evidence" was checked against `master` for this file.

| Claim | Report verdict | Repo evidence (`master` @ `724a3e5`) | Where it appears |
|---|---|---|---|
| "Captures missed calls" | Only as simulated/demo behavior | `PARTIALLY_SHIPPED`: a Telnyx post-call ingest path exists behind `RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED`; carrier, SMS, and voice adapters resolve to mocks (`lib/providers/resolve.ts`) | Home pillars ("land in one place"); industry pages (now "designed to") |
| "Replies in under 30/60 seconds" | No — only as illustrative seeded scenario | No response-time telemetry exists | Home stat "Under 60s — Target…"; home-services card "Target a reply in under 60 seconds" |
| "24/7 coverage" | No for live product | No live telephony | Home stat "24/7 — Designed coverage…" |
| "Books estimates / jobs" | Only as demo scenario / intended workflow | Scheduling is v0.3-gated; the walkthrough creates no appointment | Home subhead ("designed to… book the work") |
| "Recovers revenue" | Use "designed to help recover opportunities" | Doctrine §20.1 `PROHIBITED_CLAIM` | Removed from public copy by #163 |
| "Every event tied to recovered revenue" | No | — | Removed by #163 |
| "AI qualifies leads" | Only as guided simulation / supervised config | A deterministic `leadQualificationScore` exists; the Telnyx normalizer trusts a provider score with literal fallbacks (see the ADR-0058 changelog entry) | Home pillar "Qualify"; home-services card |
| "CRM sync" | No unless a named integration is verified | HubSpot call-sync seam is bounded and gated (doctrine v1.0.1); CRM-1+ gated | Pricing tier summary ("CRM sync… (in development)") |
| "Vendor-agnostic / routes around any provider" | Only as architectural intent | ADR-0043: an interface plus a mock does not prove portability | Demo FAQ, already reworded |
| "Immutable event ledger" | Yes only if implementation verified | **Overstated before this PR.** No unified event model; `AuditLog` is written for user removal (`lib/auth/clerk-sync.ts`), assessment-request status changes (`lib/data/prospectIntakes.ts`), and prospect-bootstrap lifecycle steps (`lib/prospectBootstrap/service.ts`), but not for Clerk membership or role changes. `lib/professional/intake.ts` also writes audit rows, but no route calls it; `LeadEvent` and call, booking, and quote tables are mutable; no migration adds a trigger or `REVOKE`; `WebhookEvent` rows get status updates and payload purges. **Reworded in this PR** to "Audit trail", stating what is recorded and what is planned | Trust page |
| "Tenant isolation by construction" | Yes only if implementation verified | **Holds for tenant roles.** `resolveTenantScope` (`lib/auth/session.ts`) ignores caller input for `client_*` roles; `withTenantScope` covers 24 of 29 `lib/data` modules; tests: `tests/unit/data-tenant-matrix.test.ts` and `tests/integration/data-tenant-matrix.integration.test.ts`. Staff roles are cross-tenant by design. No Postgres RLS | Trust page |
| "Webhook signatures verified" | Frame as enforced requirement | **Partial.** Enforced on Telnyx (Ed25519, `lib/providers/telnyx/webhook.ts`) and Clerk (Svix, `lib/auth/clerk-webhook.ts`), both tested. Stripe, Twilio, Retell, Vapi, GHL, and n8n routes are `TODO` stubs that only acknowledge and mutate nothing. Reworded in this PR to say which are enforced | Trust page (already framed as "the mandatory rule that goes live with each integration") |
| "Card data is never stored" (Stripe hosted pages) | Yes only if payment implementation is live and reviewed | **Not present.** No Stripe SDK in `package.json`; `lib/providers/stripe/` is empty; the webhook route is a `TODO` stub. Reworded in this PR as a design rule, noting billing is not live | Trust page |
| "Per-tenant retention modes" | Verify | **Partial.** `TranscriptRetentionLane { full, redacted_only, metadata_only }` exists on `CallTranscript` only; no per-account field and no enforcement job. `WebhookEvent.payload_expires_at` is set only by the Telnyx prospect-demo routes; Clerk payloads carry no expiry. Reworded in this PR | Trust page |
| "Tenant-scoped deletion and export" | Only if it works as described | **Not present.** No `DELETE` handler under `app/api`; no tenant export or erasure function. The only deletion code is the operator-run prospect PII purge (`scripts/purge-prospect-pii.ts`, disabled in production). Reworded in this PR as planned | Trust page |
| "HIPAA-ready deployment available" | Avoid as a promotional claim | ADR-0004 | Trust page frames it as conditional, not default |
| "HIPAA-certified / -compliant" | No | — | Trust page and footer disclaim it |
| "No live customer data" | Yes, if true | Mock adapters by default; no live provider path is enabled | Footer, demo, trust |
| "Assessment fee applies toward implementation within 30 days" | Yes if the policy is real | Owner confirmed on 2026-09-11 (#163) | Pricing |
| "Outcome fees" | Only as conditional / optional | Doctrine §14.3 and §18: not billable before the Revenue Gate | Pricing tier, home OFFER card |
| "9 KPIs" the monthly report tracks | Not assessed by the report | `DOCUMENTED_ONLY`: the nine are defined only in `docs/brand/RESPONSEOS_SALES_NARRATIVE.md`; `RevenueMetrics` holds a superset that does not map one-to-one | Home stat, hedged as "designed to track" |
| "Secure / enterprise-grade" | Avoid | — | Not used |
| Customer ROI / recovered-revenue figures | No | No customer evidence exists | Not used; demo values labeled illustrative |
| "Works with ServiceTitan / Jobber / GHL" | No unless individually verified | No such adapters | Not used |

**Also premature per the report:** customer-stories pages, logo walls, a live system-status page, an integration directory implying broad connector support, HIPAA vertical positioning, a free trial, an outcome-fee calculator, and an enterprise certification center.

## 13. Site opportunity manifest

The report's IDs and priorities, with current status. **P0 = do first. "Current" means the report considers it publishable at today's product maturity**, which is not authorization to build it.

| ID | Surface | Opportunity | Horizon | Priority | Status on `master` |
|---|---|---|---|---|---|
| HOME-001 | Home | Connected, permanently labeled Recovery Record visual | Current | P0 | **Built** — homepage section after the hero, reusing the DemoLift walkthrough scenario (`app/(marketing)/_components/RecoveryRecord.tsx`) |
| HOME-002 | Home | Sharpen hero category phrasing ("revenue-recovery workflow" + "missed demand") | Current | P0 | Partly — hero now leads with missed calls |
| HOME-003 | Home | "Not just an AI receptionist" contrast: answering service / CRM / ResponseOS | Current | P0 | Open |
| HOME-004 | Home | Two conversion paths (explore vs. assess) | Current | P0 | **Addressed** (ADR-0035, #163) |
| HOME-005 | Home | Structured "What you are seeing" product-status disclosure near UI | Current | P0 | Open |
| HOME-006 | Home | Tie each RECOVER stage to an event in the Recovery Record | Current | P1 | Open — HOME-001 is now built |
| HOME-007 | Home | Conservative financial-exposure scenario module (ranges, assumptions) | Near term | P1 | Open |
| PLATFORM-001 | Platform | Dedicated demand-to-revenue workflow page | Current | P0 | Open — no `/platform` route; the nav "Platform" link points at `/` |
| PLATFORM-002 | Platform | Visualize human escalation and exception paths | Current | P0 | Open |
| PLATFORM-003 | Platform | Source-of-truth / data-provenance model | Near term | P1 | Open — ADR-0050 is the internal basis |
| PLATFORM-004 | Platform | Integrations / compatibility surface, verified only | Near term | P1 | Open — gated by v0.3 |
| DEMO-001 | Demo | Product-first event replay, missed call → attributed state | Current | P0 | Partly — the walkthrough is step-based on persisted fictional records |
| DEMO-002 | Demo | Persistent seeded-simulation labeling | Current | P0 | **Addressed** in the walkthrough (`DemoDataBanner`) |
| DEMO-003 | Demo | Multiple compact scenarios (HVAC after-hours, plumbing emergency, estimate) | Near term | P1 | Open |
| DEMO-004 | Demo | Instrumentation: starts, completion, hotspots, CTA outcomes | Near term | P1 | Open — no analytics package or tracking calls exist |
| DEMO-005 | Demo | Evaluate Navattic/Storylane once UI stabilizes | Near term | P2 | Open |
| PRICE-001 | Pricing | Make assessment deliverables visible, plus "what happens next" | Current | P0 | **Built on `/audit`** — the eight-part packet and both after-paths; `/pricing` still links there rather than repeating it |
| PRICE-002 | Pricing | Name the setup + monthly scale variables | Current | P0 | Open |
| PRICE-003 | Pricing | Bound outcome-fee claims to verified measurement and contract | Current | P0 | Open — owner decision (see §3) |
| PRICE-004 | Pricing | Explain why not per-seat / per-minute | Current | P1 | Partly — "no seat licenses" is stated |
| PRICE-005 | Pricing | Starting implementation ranges once stable | Future | P2 | Gated on D-2 |
| TRUST-001 | Trust | Trust-center structure: security, data, payments, privacy, product status | Current | P0 | Open |
| TRUST-002 | Trust | Implemented / In validation / Not claimed taxonomy | Current | P0 | Partly — control copy corrected in this PR (§12); taxonomy not yet applied |
| TRUST-003 | Trust | Data-lifecycle visualization (intake → retention → export/deletion) | Current | P1 | Open — the export and deletion stages it would show do not exist yet (§12) |
| TRUST-004 | Trust | Formal trust artifacts only when real | Future | P2 | Gated |
| INDUSTRY-001 | Industries | True vertical pages (start HVAC, plumbing, roofing/electrical) | Current | P0 | Open — see the ADR-0035 tension in §3 |
| INDUSTRY-002 | Industries | One call-to-outcome scenario module per vertical | Current | P0 | Open |
| INDUSTRY-003 | Industries | Vertical-specific objection FAQ | Current | P1 | Open |
| INDUSTRY-004 | Industries | Vertical proof only after verified pilots | Future | P1 | Gated |
| CRO-001 | Sitewide | CTA hierarchy: explore workflow / get assessment / talk implementation | Current | P0 | Partly — two tiers exist |
| CRO-002 | Sitewide | Product-state label standard: simulated, supervised, live, planned | Current | P0 | Open — doctrine §2.1 is the internal vocabulary |
| CRO-003 | Sitewide | "How deployment works" implementation-confidence page | Near term | P1 | Open |
| CRO-004 | Sitewide | Assessment landing page: method, deliverables, fit/not-fit, credit policy | Current | P0 | **Built** — `/audit` now carries price and credit, deliverables, method, fit signals and no-fit reasons, and what happens after. No duration is stated because none is defined |
| CRO-005 | Sitewide | Fair alternative-comparison pages | Near term | P2 | Open |
| SEO-001 | Resources | Problem-led content cluster | Near term | P1 | Open |
| SEO-002 | Tools | Range-based missed-demand calculator | Near term | P2 | Open |
| PROOF-001 | Sitewide | Proof ladder | Current | P0 | Open |
| OPS-001 | Internal | Claims inventory with owner, evidence, review date, status | Current | P0 | Partly — doctrine §20 and §12 above; no maintained per-claim inventory |

## 14. What not to copy

1. Generic "AI employee" language without workflow accountability.
2. Commodity receptionist claims as the central story ("never miss a call", "answers 24/7", "responds in seconds").
3. Unqualified recovered-revenue promises. Duplicate callers, existing customers, delayed bookings, cancellations, multi-channel journeys, and offline sales all complicate causality.
4. Fake dashboards. A dashboard reflecting invented outcomes does more harm than a plainly labeled seeded one.
5. Logo walls, "trusted by" badges, anonymous ratings, or fabricated testimonials.
6. Certification theater (SOC 2 / ISO / PCI badge clusters that are not held).
7. Stock contractors as decorative filler.
8. A giant feature wall ("AI, CRM, automation, analytics, memory, SMS").
9. Overly broad vertical claims ("built for all service businesses").
10. Complex technical language too early. Event ledgers, webhook signatures, and provider abstraction belong on the Trust and implementation pages, not in the hero.
11. Aggressive outcome-fee language before attribution maturity.
12. Free-trial pressure before onboarding (routing, CRM setup, safety boundaries, measurement) is ready.

## 15. Market map (as reported, Sept 2026 — verify before reuse)

| Company | Category | Pricing model (reported) | Differentiation |
|---|---|---|---|
| Smith.ai | AI + human receptionist | Per-call plans; AI tiers from a free test tier | Hybrid human + AI coverage |
| Goodcall | AI phone agent | Per-agent monthly tiers ($79 / $129 / $249) with customer-volume limits | Usage framed by unique customers, not minutes |
| Podium | Local-business comms / "AI employee" | Quote / bundled | Unified comms; home-services booking and dispatch framing |
| Birdeye Receptionist | Reputation / CX platform | Not established | Missed-call forwarding into a messaging inbox |
| ServiceTitan Voice Agent | FSM with AI phone agent | Enterprise / quote-led | Dashboard ties calls to booked jobs, revenue, transcripts, escalations; native system of record |
| Housecall Pro | FSM | Tiered; published from $59/mo annual; free trial | Easy all-in-one suite |
| Jobber | Field-service management | Tiered subscription | Quote-to-payment |
| Workiz | FSM plus phone/AI | Tiered; trial | FSM expanding into answering |
| Retell AI | Voice-AI infrastructure | PAYG, $0.07–$0.31/min | Configurable voice-agent infrastructure |
| Bland AI | Voice-AI platform | Usage tiers + enterprise | Bundled per-minute voice economics |
| Synthflow | No-code / enterprise voice AI | PAYG; enterprise from $30k/yr | Voice agents without code |
| GoHighLevel | CRM / agency automation | Platform subscription | Customizable automation stack |
| FieldEdge, Service Fusion | FSM | Subscription / quote | Mechanical-service focus; affordability |
| Navattic, Storylane | Interactive-demo infrastructure | Navattic paid from ~$500/mo | Guided demos; Storylane adds HTML sandboxes |

**Pattern takeaways:** an outcome-led hero, a labeled product-screenshot hero, a restrained inspectable timeline, a transcript plus next action, and transparent entry pricing are all "high now." Dashboard crops, calculators, and integration walls are "near term," and integration walls must use verified integrations only. Customer-proof bands are "future."

## 16. Content and SEO hypotheses

These are intent hypotheses. **No keyword volumes are claimed**, and they need keyword-tool validation before editorial prioritization.

- **High-intent:** AI receptionist for HVAC / plumbers / electricians; after-hours answering for home services; HVAC missed-call solution; ServiceTitan AI voice agent alternative; GoHighLevel missed-call text-back implementation.
- **Comparison:** AI receptionist vs. answering service / voicemail / CRM; missed-call text-back vs. AI call handling; per-call vs. per-minute pricing. Keep these fair and source-verified.
- **Problem-aware:** missed calls costing HVAC businesses; after-hours lead handling; speed to lead; why CRM leads go cold.
- **Methodology:** how call attribution works; measuring recovered revenue without double counting; human escalation in AI call workflows; CRM field mapping for inbound calls.
- **Tools:** missed-call revenue, speed-to-lead, and after-hours exposure calculators. Every result must be scenario-based, assumption-led, and non-guaranteed.

"Revenue recovery" is probably not the phrase buyers search for. Build entry points around known problems (missed calls, after-hours, speed to lead, text back, booking), then introduce the category language inside the page.

## 17. Principal sources cited by the report

ServiceTitan voice-agents dashboard (help.servicetitan.com/release-hub) · security.servicetitan.com · podium.com missed-calls article · homeservices.podium.com (communications, plumbing-ai) · smith.ai and /pricing/ai-receptionist · goodcall.com/pricing · retellai.com/pricing · housecallpro.com/pricing and /tools/rate-checker · workiz.com · support.birdeye.com (call-forwarding setup) · synthflow.ai/pricing · docs.bland.ai/platform/billing · Navattic *State of the Interactive Product Demo 2026* · storylane.io/sandbox-demo. The full list of 93 references is in the source PDF.
