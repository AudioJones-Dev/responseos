# ResponseOS Demo Narrative & Asset Plan

**Owner:** AJ Digital LLC / Audio Jones
**Product Family:** ResponseOS / Founder Intelligence Systems™
**Status:** ADR-0025 Asset Phase Spec
**Scope:** Documentation and asset planning only

> Documentation-only spec. No runtime code, UI components, routes, provider integrations, migrations,
> dependencies, secrets, env vars, or deploy changes. It defines what a prospect sees in the
> ResponseOS demo and the assets required to build it, aligned to the ratified canon (Brand 2.0
> ADR-0021; communications stack ADR-0031–0034; Business Memory ADR-0034). Companion:
> [`responseos-communications-stack.md`](./responseos-communications-stack.md),
> [`responseos-gtm-product-roadmap.md`](./responseos-gtm-product-roadmap.md), [`../DESIGN.md`](../DESIGN.md).

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Demo goal](#2-demo-goal)
3. [Core demo storyline](#3-core-demo-storyline)
4. [Product narrative principles](#4-product-narrative-principles)
5. [Required demo scenes](#5-required-demo-scenes)
6. [Required product screens](#6-required-product-screens)
7. [Required demo data model](#7-required-demo-data-model)
8. [Visual and brand requirements](#8-visual-and-brand-requirements)
9. [Asset inventory](#9-asset-inventory)
10. [Non-goals](#10-non-goals)
11. [Open decisions](#11-open-decisions)
12. [Success criteria](#12-success-criteria)
13. [Suggested follow-up tasks](#13-suggested-follow-up-tasks)

---

## 1. Executive summary

ResponseOS should **not** demo as "just an AI receptionist." The demo must show the full **revenue
recovery loop**: inbound call capture, AI qualification, CRM sync, Business Memory capture, and
revenue / follow-up visibility.

**The AI receptionist is the wedge. The product value is recovered revenue, operational memory, and
founder intelligence.** A prospect should leave the demo understanding that ResponseOS turns missed
demand and scattered context into recovered revenue and clear next actions — not that "it answers the
phone."

## 2. Demo goal

A prospect should understand **within 30 seconds** that ResponseOS helps founder-led service
businesses stop losing revenue from **missed calls, weak follow-up, scattered context, and poor
visibility.**

The 30-second test: by the end of Scene 1 → Scene 6 skim, the viewer can state "this catches the
calls I miss, qualifies them, files them where my business runs, and shows me the money I'd have lost."

## 3. Core demo storyline

1. A high-intent lead calls after hours or during a busy workday.
2. ResponseOS answers or triggers missed-call recovery.
3. The AI receptionist qualifies the caller.
4. The caller requests service or booking.
5. ResponseOS captures transcript, summary, intent, urgency, and next action.
6. The event syncs to **HubSpot** as commercial activity.
7. **Business Memory** stores the operational context.
8. The dashboard shows the recovered opportunity, follow-up status, and estimated revenue impact.

## 4. Product narrative principles

- Lead with **business pain**, not AI novelty.
- Show **recovered revenue before** showing technical architecture.
- Make the product feel like **operational clarity**, not another inbox.
- Keep provider names out of client-facing demo screens unless necessary.
- Present **Telnyx, Vapi, HubSpot**, and other vendors as **invisible infrastructure**.
- Business Memory should appear as **useful context**, not as RAG/vector jargon.
- The dashboard must communicate **"what happened, what matters, what to do next."**

## 5. Required demo scenes

### Scene 1 — Missed Revenue Moment
Show: missed or incoming call · caller intent · source channel · estimated opportunity value · risk
if no response happens.

### Scene 2 — AI Receptionist Interaction
Show: AI greeting · caller problem · qualification questions · urgency · appointment intent ·
consent/compliance copy where needed.

### Scene 3 — Lead Qualification Output
Show structured output: contact name · phone number · service requested · urgency · qualification
score · appointment status · follow-up required · summary.

### Scene 4 — HubSpot Sync
Show: contact created or updated · activity logged · call summary attached · deal or opportunity
created · follow-up task created.

### Scene 5 — Business Memory Capture
Show: transcript stored · summary stored · customer context stored · next action stored · operational
note stored.

> **Phase-1 Business Memory is event-ledger capture, not full vector/RAG memory** (ADR-0034). Show it
> as structured, recallable operational context — never as embeddings/vector/RAG jargon. Advanced
> per-tenant knowledge / retrieval stays v0.4-gated.

### Scene 6 — Revenue Recovery Dashboard
Show: missed calls recovered · qualified leads · booked appointments · follow-ups due · estimated
revenue protected · conversion trend · unresolved opportunities.

### Scene 7 — Founder Intelligence View
Show: what changed today · what needs attention · which leads are at risk · where money is leaking ·
what action the founder should take next.

## 6. Required product screens

| Screen | Purpose | Must Show |
|---|---|---|
| **Revenue Recovery Overview** | Executive dashboard | recovered calls, qualified leads, bookings, follow-up risk, estimated revenue |
| **Call Intelligence Detail** | One call/event view | transcript, summary, caller intent, qualification, urgency, next action |
| **Business Memory Event** | Operational memory view | structured event, source, context, decision/action trail |
| **Lead / Opportunity View** | Commercial record | contact, company, service need, deal value, CRM sync status |
| **Follow-Up Queue** | Action view | leads needing callback, booking, quote, reminder, owner |
| **Integration Status** | Trust / ops view | HubSpot sync, calendar sync, telephony status, event delivery |

## 7. Required demo data model

Mock demo entities (mock-only; **not** production data in the app):

```txt
Business:       South Florida service business
Vertical:       contractor / home service / accessibility equipment / HVAC / plumbing / legal intake
Lead:           high-intent caller
Call scenario:  missed call or after-hours inbound request
Revenue value:  estimated opportunity range
CRM:            HubSpot
Memory:         Phase-1 event-ledger capture
```

**Example demo scenarios (at least three):**

1. **After-hours emergency service call** — high-urgency inbound after close; ResponseOS answers,
   qualifies, books/escalates; dashboard shows protected revenue that would otherwise be lost overnight.
2. **Missed call during workday** — owner on a job, call missed; missed-call text-back recovers the
   lead, qualifies via SMS/callback, syncs to HubSpot; dashboard shows a recovered opportunity.
3. **Follow-up failure prevented by ResponseOS** — a quote/booking that would have gone cold; the
   Follow-Up Queue surfaces it with the next action and owner before it leaks.

## 8. Visual and brand requirements

Use **Brand 2.0** (ADR-0021, [`../DESIGN.md`](../DESIGN.md)):

- True-black / glass interface.
- **Signal-Yellow `#E8FF5A`** as primary emphasis.
- **Syne** typography.
- Blue only for utility states, never core brand.
- High-contrast dashboard cards.
- Premium editorial SaaS feel.
- Avoid generic chatbot styling.

> Screens should feel like a **revenue command center, not a call-center inbox.** Recovered-revenue
> figures carry the Signal-Yellow emphasis; action-orange `#FF4500` is reserved for urgency / leak
> moments only.

## 9. Asset inventory

| Asset | Purpose | Status |
|---|---|---|
| Demo call script | Used for recorded or simulated AI receptionist call | Needed |
| Transcript sample | Powers call intelligence screen | Needed |
| Lead qualification JSON sample | Powers structured output screen | Needed |
| HubSpot sync mock | Shows commercial SoR workflow | Needed |
| Business Memory event mock | Shows Phase-1 memory capture | Needed |
| Revenue dashboard mock data | Powers executive dashboard | Needed |
| Product screen wireframes | Guides UI implementation | Needed |
| CTA copy | Supports demo page and sales flow | Needed |
| Founder Intelligence summary sample | Shows daily executive insight | Needed |

> Brand mark + favicons are already delivered (ADR-0025 asset phase). The assets above are the
> *demo-content* assets that follow.
>
> **First demo-content batch delivered:** the call script, mock transcript, lead-qualification JSON,
> Business Memory event JSON, HubSpot sync JSON, and Founder Intelligence summary now exist as
> mock-data assets in [`demo-assets/`](./demo-assets/README.md) (anchor scenario: after-hours
> accessibility / mobility-equipment service call). Remaining: screen wireframes, demo landing-page
> CTA copy.

## 10. Non-goals

- Do **not** build the UI in this task.
- Do **not** implement Telnyx, Vapi, HubSpot, or calendar integrations.
- Do **not** add live demo credentials.
- Do **not** create production mock data in the app.
- Do **not** relax v0.4 Business Memory / RAG / vector gates.
- Do **not** expose vendor-specific infrastructure as the primary product narrative.
- Do **not** make the demo about AI novelty rather than revenue recovery.

## 11. Open decisions

- Whether **OpenAI remains the LLM brain inside Vapi**, or whether model selection is owned entirely
  through Vapi configuration. (ADR-0032)
- Whether the **Node.js voice gateway and Redis architecture from ADR-0013/ADR-0014 survive behind or
  alongside Vapi.** (ADR-0032)
- Whether the **first public demo** should be a recorded AI call, a clickable product walkthrough, or
  both.
- Which **vertical anchors the first demo**: accessibility equipment, HVAC, plumbing, legal intake, or
  general home services.
- Whether **estimated revenue** should be manually entered, inferred from service type, or synced from
  CRM / deal data.

## 12. Success criteria

This task is complete when:

- A new demo narrative and asset plan document exists.
- The document explains the product narrative clearly.
- The demo flow reflects the current ADR canon.
- Required scenes and screens are defined.
- Demo mock data requirements are defined.
- Asset inventory is listed.
- Brand 2.0 requirements are included.
- Non-goals prevent premature implementation.
- Open decisions remain explicit.

## 13. Suggested follow-up tasks

1. Create demo call script.
2. Create mock transcript and lead qualification JSON.
3. Create screen-by-screen wireframe spec.
4. Create product demo landing page copy.
5. Create HubSpot sync mock event.
6. Create Business Memory event sample.
7. Create Founder Intelligence daily summary sample.

---

*ResponseOS Demo Narrative & Asset Plan — documentation and asset planning only. Aligned to ADR-0021
(Brand 2.0) and ADR-0031–0034 (communications stack). Open decisions preserved; v0.4 knowledge/RAG
gates intact.*
