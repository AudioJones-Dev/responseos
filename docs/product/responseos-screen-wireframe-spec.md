# ResponseOS Screen-by-Screen Wireframe Spec

**Owner:** AJ Digital LLC / Audio Jones
**Product Family:** ResponseOS / Founder Intelligence Systems™
**Status:** Demo Wireframe Specification
**Scope:** Documentation and UX planning only

**Related Docs:**
- [`responseos-demo-narrative-and-asset-plan.md`](./responseos-demo-narrative-and-asset-plan.md)
- [`demo-assets/README.md`](./demo-assets/README.md)

> Documentation / UX-planning only. **No UI implementation, routes, components, runtime code, mock app
> data, provider integrations, migrations, dependencies, env vars, secrets, or deploy changes.** This
> spec defines screen *structure* and *data bindings*; it does not build anything. Aligned to Brand 2.0
> (ADR-0021) and the communications canon (ADR-0031–0034); Business Memory stays Phase-1 event-ledger
> capture (ADR-0034).

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Source assets](#2-source-assets)
3. [Global UX principles](#3-global-ux-principles)
4. [Global layout system](#4-global-layout-system)
5. [Screen 1 — Revenue Recovery Overview](#5-screen-1--revenue-recovery-overview)
6. [Screen 2 — Call Intelligence Detail](#6-screen-2--call-intelligence-detail)
7. [Screen 3 — Business Memory Event](#7-screen-3--business-memory-event)
8. [Screen 4 — Lead / Opportunity View](#8-screen-4--lead--opportunity-view)
9. [Screen 5 — Follow-Up Queue](#9-screen-5--follow-up-queue)
10. [Screen 6 — Integration Status](#10-screen-6--integration-status)
11. [Demo navigation flow](#11-demo-navigation-flow)
12. [Data-binding map](#12-data-binding-map)
13. [Non-goals](#13-non-goals)
14. [Open decisions](#14-open-decisions)
15. [Success criteria](#15-success-criteria)
16. [Suggested follow-up tasks](#16-suggested-follow-up-tasks)

---

## 1. Executive summary

This document defines the intended screen structure for the first ResponseOS demo experience. It
translates the approved demo narrative and mock demo assets into product-screen requirements **without
implementing UI**.

The goal is to make the **revenue recovery loop visible**: missed or inbound call → AI qualification →
CRM sync → Business Memory capture → follow-up visibility → founder action.

## 2. Source assets

Every screen binds to the existing mock-data assets (all `demo_only: true`, no PII):

- [`demo-assets/demo-call-script.md`](./demo-assets/demo-call-script.md)
- [`demo-assets/mock-transcript.md`](./demo-assets/mock-transcript.md)
- [`demo-assets/lead-qualification-output.json`](./demo-assets/lead-qualification-output.json)
- [`demo-assets/business-memory-event.json`](./demo-assets/business-memory-event.json)
- [`demo-assets/hubspot-sync-event.json`](./demo-assets/hubspot-sync-event.json)
- [`demo-assets/founder-intelligence-summary.md`](./demo-assets/founder-intelligence-summary.md)

## 3. Global UX principles

- Lead with **business impact**, not vendor infrastructure.
- Show **what happened, why it matters, and what to do next.**
- Make the dashboard feel like a **revenue command center, not a call-center inbox.**
- Keep **Telnyx, Vapi, HubSpot** and other vendors **invisible** — except on Integration Status.
- Business Memory must appear as **operational context, not RAG/vector jargon.**
- Use **Signal-Yellow `#E8FF5A`** for emphasis and action hierarchy; use critical red / warning amber
  for urgency / revenue-leak moments only.
- Use **blue only for utility / system states.**
- Prioritize **readable executive summaries** over dense tables.

## 4. Global layout system

```
┌───────────────────────────────────────────────────────────────────────────┐
│  TOP STATUS BAR  ·  DemoLift Accessibility Services  ·  [DEMO MODE]         │
│                     sync: ● synced · window: This month · 9:41 AM           │
├──────────┬────────────────────────────────────────────────┬────────────────┤
│          │                                                 │                │
│ COMMAND  │            PRIMARY CONTENT AREA                 │  INSIGHT /      │
│ SIDEBAR  │            (glass cards on true-black)          │  ACTION RAIL    │
│ (nav)    │                                                 │  (where useful) │
│          │     ┌──────── Next Action module ────────┐      │                │
│  • Over- │     └─────────────────────────────────────┘      │                │
│    view  │                                                 │                │
│  • Calls │                                                 │                │
│  • Leads │                                                 │                │
│  • Memory│                                                 │                │
│  • Queue │                                                 │                │
│  • Status│                                                 │                │
└──────────┴────────────────────────────────────────────────┴────────────────┘
```

- **Left command sidebar** (compact) — the six screens; collapses to icon-only on tablet, drawer on mobile (DESIGN.md §4/§13).
- **Top status bar** — business name, **DEMO MODE** badge, CRM/sync state, and the active time window.
- **Primary content area** — glass cards on true-black; large executive metrics on overview screens, detail panels on intelligence screens.
- **Right insight / action rail** — present where useful (overview, detail).
- **"Next Action" module** — a clear, persistent module on **every operational screen** answering "what to do next."
- **Glass + Brand 2.0** — translucent dark cards, hairline borders, Signal-Yellow emphasis, Syne display, no blue brand surfaces (ADR-0021).

---

## 5. Screen 1 — Revenue Recovery Overview

**Purpose.** Show the executive picture: how much revenue ResponseOS protected, how many leads were
captured, and what needs attention now.

**Primary user question.** *What revenue did we protect, and what requires action?*

**Layout regions.**
```
[ Hero: Estimated Revenue Protected (Signal-Yellow) | period delta ]
[ Metric row: Recovered opps · Qualified leads · Appts · Follow-ups due · Missed-call recovery rate ]
[ Left: Recent call/event feed ]      [ Right rail: Founder Intelligence summary card + Top Next Action ]
[ At-risk leads strip (critical/warning accents) ]
```

**Required content.** Recovered opportunities · qualified leads · booked/requested appointments ·
follow-ups due · **estimated revenue protected** · missed-call recovery rate · at-risk leads · Founder
Intelligence summary card · recent call/event feed · **top next action**.

**Data sources.** `lead-qualification-output.json` · `founder-intelligence-summary.md` ·
`business-memory-event.json` · `hubspot-sync-event.json`.

**Primary CTA / action.** "Open top at-risk lead" → jumps to the Call Intelligence Detail / Lead view
for the highest-value urgent item (the Maria Santos demo lead).

**Empty / loading / error states.** Empty: "No recovered demand yet this period — recovered calls and
revenue will appear here." Loading: skeleton metric cards + feed rows (no spinners). Error: "We
couldn't load this period. Retry." Never show `$0`/null without explanation (DESIGN.md §15).

**Brand notes.** Recovered-revenue hero in Signal-Yellow; at-risk strip uses critical/warning treatment sparingly;
everything on true-black glass. Reads as a command center, not an inbox.

**Future implementation notes.** Read-only, mock-bound; the hero + metric row map 1:1 to the existing
`StatCard`/`MetricCard` components. No live data, no provider calls.

---

## 6. Screen 2 — Call Intelligence Detail

**Purpose.** Show one call as an **intelligence object**, not just a transcript.

**Primary user question.** *What happened on this call, and what should we do next?*

**Layout regions.**
```
[ Header: call metadata · disposition badge · urgency badge (critical/warning if high) ]
[ Left (2/3): Transcript (timestamped) ]   [ Right (1/3): AI summary · intent · service · score · consent ]
[ Next Action module (Signal-Yellow CTA) ]
[ Footer chips: CRM sync status · Business Memory capture status (links out) ]
```

**Required content.** Call metadata · transcript · AI summary · caller intent · urgency · service
requested · qualification score · appointment/follow-up status · consent status · **recommended next
action** · CRM sync status · Business Memory capture status.

**Data sources.** `mock-transcript.md` · `lead-qualification-output.json` · `business-memory-event.json`
· `hubspot-sync-event.json`.

**Primary CTA / action.** "Call back to confirm assessment window" (the recommended next action; owner
+ due time from the qualification payload). Secondary: "View in HubSpot" / "View memory event."

**Empty / loading / error states.** Empty (no transcript yet): "Transcript will appear once the call
is processed." Loading: skeleton transcript lines + summary panel. Error: retry + support note; never
expose raw error codes to clients.

**Brand notes.** Urgency badge critical/warning when high; qualification score and next-action CTA in
Signal-Yellow; transcript in readable body type (DM Sans), timestamps in DM Mono.

**Future implementation notes.** Bind to `mock-transcript.md` (transcript + metadata) and the
qualification JSON; status chips derive from the sync + memory payloads. No vendor names surfaced here.

---

## 7. Screen 3 — Business Memory Event

**Purpose.** Show that ResponseOS converts conversations into **structured operational memory.**

**Primary user question.** *What operational context did the business just learn?*

**Layout regions.**
```
[ Header: event ID (mono) · captured-at · "Phase-1 event-ledger capture" label ]
[ Source event card → links to Call Detail ]   [ Entities card (contact · household · business) ]
[ Summary · Operational context · Commercial context ]
[ Next actions list ]   [ Decision/action trail (timeline) ]
[ Gates panel: RAG ✕ · Vector ✕ · Per-tenant knowledge ✕  (all disabled — Phase 1) ]
```

**Required content.** Event ID · source event · entities · summary · operational context · commercial
context · next actions · decision/action trail · **memory gates showing RAG / vector / per-tenant
knowledge disabled for Phase 1** · link back to call detail and CRM event.

**Data sources.** `business-memory-event.json` · `lead-qualification-output.json` · `mock-transcript.md`.

> **Important.** This screen must show **Phase-1 event-ledger capture only.** It must **not** imply
> active RAG, vector memory, or per-tenant knowledge automation. The **gates panel** renders the
> payload's `gates` block (`rag_enabled: false`, `vector_memory_enabled: false`,
> `per_tenant_knowledge_enabled: false`) as an explicit, visible state (ADR-0034; v0.4-gated).

**Primary CTA / action.** "Open the call this came from" + "Open the CRM record." (Memory is context,
not a chat box.)

**Empty / loading / error states.** Empty: "No memory captured yet — operational context from calls
and events appears here." Loading: skeleton cards. Error: retry.

**Brand notes.** Present as calm operational context — neutral type, Signal-Yellow only on the
"next action" items; the gates panel uses neutral/utility styling (not alarming), clearly labeled
"Phase 1."

**Future implementation notes.** Pure render of the event-ledger payload; **no embeddings, vector
index, RAG runtime, or retrieval** is implied or built.

---

## 8. Screen 4 — Lead / Opportunity View

**Purpose.** Show the **commercial record** created from the call.

**Primary user question.** *Is this a real opportunity, and where does it stand commercially?*

**Layout regions.**
```
[ Header: lead name · region · qualification band badge · estimated value (Signal-Yellow) ]
[ Left: Service category · urgency · appointment intent · source attribution ]
[ Right: Deal/opportunity status · HubSpot sync status · follow-up owner ]
[ Related: linked Call Detail + Business Memory event ]
[ Next Action module ]
```

**Required content.** Lead identity · location region · service category · estimated value ·
qualification score · urgency · deal/opportunity status · HubSpot sync status · follow-up owner ·
appointment intent · source attribution · related call and memory event.

**Data sources.** `lead-qualification-output.json` · `hubspot-sync-event.json` ·
`business-memory-event.json`.

**Primary CTA / action.** "Advance the opportunity" (confirm appointment / assign owner) — maps to the
deal stage `qualified_appointment_requested`.

**Empty / loading / error states.** Empty: "No opportunities yet — qualified leads become opportunities
here." Loading: skeleton record. Error: retry.

**Brand notes.** Estimated value in Signal-Yellow; urgency in critical/warning when high; CRM sync shown as
a quiet trust chip (HubSpot named here is acceptable as a status, not the hero).

**Future implementation notes.** Bind lead + commercial fields from the qualification + sync payloads;
"source attribution" surfaces channel (after-hours inbound), with carrier/orchestration names hidden
unless the operator opens Integration Status.

---

## 9. Screen 5 — Follow-Up Queue

**Purpose.** Show **what needs action before revenue leaks.**

**Primary user question.** *Who needs follow-up, by when, and why?*

**Layout regions.**
```
[ Header: "Follow-ups due" count · overdue count (critical/warning) ]
[ Queue table: Lead · Reason · Urgency · Due · Owner · Est. value · CRM status · Suggested action ]
[ Row expand: "Risk if ignored" + one-click suggested action ]
```

**Required content.** Follow-up task list · due time · owner · lead/customer · reason for follow-up ·
urgency · estimated value · CRM status · suggested action · **risk if ignored**.

**Data sources.** `lead-qualification-output.json` · `hubspot-sync-event.json` ·
`founder-intelligence-summary.md`.

**Primary CTA / action.** Per-row "Do this next" (e.g., "Call back to confirm urgent assessment
window") + bulk "Mark contacted." The urgent Maria Santos task (due 9:00 AM) is the demo's hero row.

**Empty / loading / error states.** Empty (good state): "You're all caught up — no follow-ups due." 
Loading: skeleton rows. Error: retry. Overdue items surfaced first.

**Brand notes.** Due/overdue and "risk if ignored" use critical/warning; the suggested-action CTA is
Signal-Yellow. DataTable on glass; tight density per DESIGN.md §9.

**Future implementation notes.** Bind to the task + qualification payloads; "risk if ignored" copy
pulls from the founder-intelligence summary tone. No reminders are actually sent (no provider calls).

---

## 10. Screen 6 — Integration Status

**Purpose.** Show **trust, sync health, and operational reliability.**

**Primary user question.** *Are the systems connected and working?*

**Layout regions.**
```
[ Header: overall health · last successful sync · [DEMO MODE] warning ]
[ Status grid: HubSpot sync · Telephony event delivery · Calendar/scheduling (placeholder) ·
                Business Memory capture · Event bus ]
[ Examples panel: a failed/retry state example (illustrative) ]
```

**Required content.** HubSpot sync status · telephony event delivery status · calendar/scheduling
status placeholder · Business Memory capture status · event bus status · last successful sync ·
**failed/retry state examples** · provider names allowed here only where useful · **demo-mode warning.**

**Data sources.** `hubspot-sync-event.json` · `business-memory-event.json` ·
`lead-qualification-output.json`.

**Primary CTA / action.** "View last sync event" (opens the mock sync payload detail). Read-only trust
view — no reconnect/credential actions in the demo.

**Empty / loading / error states.** Empty: "No integrations connected (demo mode)." Loading: skeleton
status tiles. Error/degraded: a clearly-labeled illustrative retry example, marked demo-only.

**Brand notes.** This is the **one screen where provider names (Telnyx, Twilio, Vapi, HubSpot) may
appear**, as infrastructure status. Healthy = success-green dot; degraded = warning-amber; failed =
critical red. Blue permitted only for neutral/utility "info" states here.

**Future implementation notes.** Pure status render from mock payloads; **no live provider connections,
credentials, or webhooks.** Whether this screen ships in the public prospect demo or stays
operator/admin-only is an [open decision](#14-open-decisions).

---

## 11. Demo navigation flow

**Primary product flow:**
```
Revenue Recovery Overview
    ↓
Call Intelligence Detail
    ↓
Lead / Opportunity View
    ↓
Business Memory Event
    ↓
Follow-Up Queue
    ↓
Integration Status
```

**Alternate founder flow:**
```
Founder Intelligence Summary
    ↓
At-Risk Lead
    ↓
Call Detail
    ↓
Next Action
```

## 12. Data-binding map

| Screen | Primary Asset | Secondary Assets | Key Fields |
|---|---|---|---|
| **1 — Revenue Recovery Overview** | `founder-intelligence-summary.md` | `lead-qualification-output.json`, `business-memory-event.json`, `hubspot-sync-event.json` | revenue protected, qualified count, follow-ups due, at-risk lead, top next action |
| **2 — Call Intelligence Detail** | `mock-transcript.md` | `lead-qualification-output.json`, `business-memory-event.json`, `hubspot-sync-event.json` | call metadata, transcript, `qualification.summary`, `urgency`, `qualification_score`, `recommended_next_action`, `crm_sync.sync_status`, `business_memory.event_id` |
| **3 — Business Memory Event** | `business-memory-event.json` | `lead-qualification-output.json`, `mock-transcript.md` | `event_id`, `source_event`, `entities`, `summary`, `operational_context`, `next_actions`, **`gates.*` (all false)** |
| **4 — Lead / Opportunity View** | `lead-qualification-output.json` | `hubspot-sync-event.json`, `business-memory-event.json` | `lead.*`, `qualification_score`, `commercial_context.estimated_revenue_range_usd`, `deal.dealstage`, `crm_sync.*`, `recommended_next_action.owner` |
| **5 — Follow-Up Queue** | `hubspot-sync-event.json` (`task`) | `lead-qualification-output.json`, `founder-intelligence-summary.md` | `task.title/owner_id/due_at/priority`, `recommended_next_action`, estimated value, risk-if-ignored |
| **6 — Integration Status** | `hubspot-sync-event.json` | `business-memory-event.json`, `lead-qualification-output.json` | `crm.sync_status`, `source_attribution.*`, `business_memory.captured`, last-sync timestamps |

## 13. Non-goals

- Do **not** implement UI components in this task.
- Do **not** create routes.
- Do **not** create production mock data.
- Do **not** import these demo files into the app runtime.
- Do **not** implement Telnyx, Vapi, HubSpot, or calendar integrations.
- Do **not** expose vendor infrastructure as the primary client-facing narrative.
- Do **not** relax v0.4 RAG / vector / per-tenant knowledge gates.
- Do **not** resolve the OpenAI-inside-Vapi or gateway/Redis architecture decisions.

## 14. Open decisions

- Whether **OpenAI remains the LLM brain inside Vapi** or model selection is owned entirely through Vapi configuration. (ADR-0032)
- Whether the **Node.js voice gateway and Redis (ADR-0013/0014)** survive behind or alongside Vapi. (ADR-0032)
- **Which screen becomes the first implemented demo route.**
- Whether the initial demo is **clickable, recorded, or both.**
- Whether the dashboard shows **estimated revenue as a range, a midpoint, or a confidence-adjusted value.**
- Whether **Integration Status** appears in the public prospect demo or remains an internal operator/admin view.

## 15. Success criteria

- A new wireframe specification document exists.
- All six required screens are defined.
- Each screen has purpose, layout, content, data source, CTA, states, brand notes, and implementation notes.
- The spec references the existing demo assets.
- Cross-links are added from the demo narrative and demo-assets README.
- Brand 2.0 and communications canon are respected.
- Business Memory remains Phase-1 event-ledger capture only.
- Open decisions are preserved.
- No UI / runtime code is changed.

## 16. Suggested follow-up tasks

1. Create low-fidelity wireframe sketches or ASCII layout blocks for each screen.
2. Create demo landing-page CTA copy. ✅ [`responseos-demo-landing-page-copy.md`](./responseos-demo-landing-page-copy.md)
3. Create the first clickable static demo route using existing demo assets. 📋 plan: [`responseos-clickable-demo-route-plan.md`](./responseos-clickable-demo-route-plan.md)
4. Create OG image and outlined-Syne wordmark assets.
5. Define screen implementation order for v0.3 demo readiness.

---

*ResponseOS Screen-by-Screen Wireframe Spec — documentation and UX planning only. Brand 2.0 (ADR-0021)
+ communications canon (ADR-0031–0034) respected; Business Memory Phase-1 event-ledger only (ADR-0034);
open decisions preserved.*
