# DESIGN.md — ResponseOS Visual System & UX Spine

**Product:** ResponseOS
**Owner:** AJ Digital LLC / Audio Jones
**Version:** 0.1 (Pre-v0.2 Design Freeze)
**Status:** Canonical. All UI implementation must align with this document.

---

## Table of Contents

1. [Design Thesis](#1-design-thesis)
2. [Visual Identity](#2-visual-identity)
3. [Typography](#3-typography)
4. [Layout System](#4-layout-system)
5. [Information Hierarchy](#5-information-hierarchy)
6. [Admin Experience](#6-admin-experience)
7. [Client Portal Experience](#7-client-portal-experience)
8. [Key Page UX](#8-key-page-ux)
9. [Component System](#9-component-system)
10. [Data Visualization Rules](#10-data-visualization-rules)
11. [UX Writing Rules](#11-ux-writing-rules)
12. [Onboarding UX](#12-onboarding-ux)
13. [Responsive Behavior](#13-responsive-behavior)
14. [Accessibility](#14-accessibility)
15. [Empty / Loading / Error States](#15-empty--loading--error-states)
16. [Design Roadmap](#16-design-roadmap)
17. [Non-Negotiables](#17-non-negotiables)

---

## 1. Design Thesis

> ResponseOS should feel like a revenue command center, not a chatbot dashboard.

ResponseOS is a B2B revenue intelligence platform. Every screen exists to answer one question for either an operator or a client:

**"What happened, what is it worth, and what needs action?"**

The visual system must reinforce this at all times. The interface is part of the product trust layer — not cosmetic decoration.

### Tone Reference

| Influence | What We Borrow |
|---|---|
| Apple | Precision, restraint, purposeful density |
| Linear | Keyboard-first, opinionated layout, developer trust |
| Palantir | Operational seriousness, data density done right |

We are not:

- An AI receptionist
- A chatbot company
- A contact center SaaS
- A general automation tool

We are a **revenue recovery operating system**.

---

## 2. Visual Identity

### Design Posture

**Black-first. Glass-structured. High-contrast. Low noise.** Premium, dark, editorial, modern, founder-tech — aligned with `audiojones.com`. The environment is true black; structure comes from translucent glass panels and hairline white borders, not from coloured backgrounds.

The guiding principle is **"signal emerging from black"**:

- **Black** = the environment.
- **Off-white** = clarity (typography).
- **Signal Yellow `#E8FF5A`** = intelligence / primary action.
- **Glass** (translucent dark panels + hairline borders) = modern SaaS structure.
- **Action-orange `#FF4500`** = urgency only.
- **Blue** = utility only — never a brand or background colour.

The visual system should communicate: **this is serious software that produces serious outcomes.** It must **not** read as a generic blue-background SaaS dashboard.

### Color Tokens

```css
/* Base — black canvas + near-black/glass surfaces. NO navy / slate / blue backgrounds. */
--color-base:             #000000;  /* Canvas — page background */
--color-canvas-soft:      #080808;  /* Soft-black band sections */
--color-surface:          #0A0A0C;  /* Card backgrounds (near-black) */
--color-surface-elevated: #101012;  /* Modals, popovers, dropdowns */
--color-surface-deep:     #06060A;  /* Deepest recessed sections */

/* Glass — translucent white over black; pair with backdrop-blur, hairline border, no heavy shadow */
--color-glass:            rgba(255, 255, 255, 0.04);
--color-glass-strong:     rgba(255, 255, 255, 0.07);

/* Borders / hairlines — neutral white at low opacity (the primary structural device on black) */
--color-border:        rgba(255, 255, 255, 0.08);
--color-border-strong: rgba(255, 255, 255, 0.14);

/* Typography — off-white + NEUTRAL greys (no slate/blue tint) */
--color-text-primary:   #FCFDFF;
--color-text-secondary: #A1A4A5;
--color-text-muted:     #888E90;

/* Accent — Brand 2.0 (ADR-0021): Signal Yellow is the PRIMARY signal; orange demoted to secondary action */
--color-accent:       #E8FF5A;  /* Primary signal — CTAs, key metrics, intelligence highlights */
--color-accent-hover: #D4EC3F;  /* TODO: verify hover shade vs Canva kit kAHJkU6n4S8 */
--color-action:       #FF4500;  /* Secondary action-orange — urgency, revenue-leak, diagnostic warnings */
--color-action-hover: #E03D00;

/* Semantic */
--color-success: #22C55E;  /* Booked, recovered, positive */
--color-warning: #F59E0B;  /* Warm lead, needs review */
--color-danger:  #EF4444;  /* Missed, failed, escalated */
--color-neutral: #6B7280;  /* Archived, cold, inactive */
```

> **Note:** Exact tokens may evolve. Visual posture — dark, premium, signal-focused — must not.

### Surface Rules

- Page background: `--color-base` (**true black `#000000`**).
- Cards and data surfaces: `--color-surface` (near-black) — defined by **hairline borders**, not fill contrast.
- Modals / elevated panels: `--color-surface-elevated`; deepest recesses: `--color-surface-deep`.
- Borders are subtle — 8% white opacity by default (range 6–14%). Hairlines are the primary structural device on black.
- **No solid white panels. No navy / slate / blue backgrounds. No light-mode assumptions.**

### Glass

Glass is the structural language for elevated/overlay surfaces (sticky headers, popovers, prominent panels). Use it carefully:

- Translucent dark panel: `--color-glass` / `--color-glass-strong` (white at 4–7% over black), **or** `--color-base` at 70–85% opacity.
- Optional `backdrop-blur` for depth; **always** paired with a hairline border.
- **No heavy shadows.** **No frosted-white overuse** — glass is dark-tinted, not milky white.
- Soft glow (yellow or glass) only when it carries meaning (e.g., a hero CTA or a key metric), never as decoration.

### Accent Usage

- Accent (`#E8FF5A` Signal Yellow) is reserved for: primary CTAs, recovered revenue highlights, active selection states. On a yellow fill, text is **black** for contrast (ADR-0021).
- Action-orange (`#FF4500`) is reserved for urgency / revenue-leak / diagnostic-warning moments — not primary CTAs.
- Do not scatter accent color across decorative elements.
- One dominant accent point per screen.

### Colour Usage Policy — blue is utility only

1. **Blue is not a primary brand or background colour.** The system is black-first with Signal-Yellow accents.
2. **Blue may appear only for rare utility states** — e.g. hyperlinks in long-form copy, an "info" system state, a data-viz series, or native OS/system UI — and only when no token already covers the need.
3. **Never** use full blue panels, blue gradients, generic SaaS blue backgrounds, blue-dominant sections, or `bg-blue-*` / `text-blue-*` / `border-blue-*` utility classes for brand surfaces.
4. If a blue usage is genuinely functional (e.g. an external link colour or a chart series), it must be documented as utility — not brand — at the point of use.
5. Semantic colours (`success` green, `warning` amber, `danger` red, `neutral` grey) cover status; they are not "blue background" usage and are unaffected by this policy.

### Penumbra Signal Adaptation (Brand 2.1)

An approved atmospheric execution layer for Brand 2.0 — registered here per §17.6. It absorbs the **Penumbra** dark-editorial system (onyx surface tiers, 1px hairline structure, flat/restrained elevation, the load-bearing atmosphere card, generous negative space, grotesk-UI + mono pairing) as *atmosphere and structure only*, while preserving every Brand 2.0 / ADR-0021 identity rule: true-black canvas, **Signal Yellow `#E8FF5A`** as the single signal accent (replacing Penumbra's warm-white), the no-blue policy, and **Syne** as the display face (no serif swap). It also adds demo-mode / mock-disabled / memory-disabled / integration-disabled data-state treatments for the clickable demo. Where Penumbra and Brand 2.0 disagree, **Brand 2.0 wins.** Full mapping: [`design/responseos-penumbra-signal-adaptation.md`](./design/responseos-penumbra-signal-adaptation.md).

---

## 3. Typography

### Font Stack

| Role | Font | Fallback |
|---|---|---|
| Headings / Brand moments / wordmark | Syne (Brand 2.0, ADR-0021) | system-ui, sans-serif |
| Product UI / Body | Inter | system-ui, sans-serif |
| Monospace (code, IDs, timestamps) | JetBrains Mono | monospace |

> Avoid decorative fonts. Avoid system fonts as primary selections. Syne (Bold/ExtraBold) is the ResponseOS wordmark + display face per ADR-0021 / GTM §14; if Syne is unavailable, **Space Grotesk** is the approved fallback for headings only.

### Type Scale

```
--text-xs:   0.75rem   / 12px  — Labels, captions, badges
--text-sm:   0.875rem  / 14px  — Table rows, secondary metadata
--text-base: 1rem      / 16px  — Body, descriptions
--text-lg:   1.125rem  / 18px  — Card headings
--text-xl:   1.25rem   / 20px  — Section titles
--text-2xl:  1.5rem    / 24px  — Page titles
--text-3xl:  1.875rem  / 30px  — Dashboard hero metrics
--text-4xl:  2.25rem   / 36px  — Large revenue figures
```

### Hierarchy Rules

- **Page titles:** `--text-2xl`, `--color-text-primary`, Syne
- **Section headings:** `--text-xl`, `--color-text-primary`, Syne
- **Card headings:** `--text-lg`, `--color-text-primary`, Inter Semibold
- **Body / descriptions:** `--text-base`, `--color-text-secondary`, Inter Regular
- **Labels / metadata:** `--text-sm`, `--color-text-muted`, Inter Regular
- **Revenue figures:** `--text-3xl` or `--text-4xl`, `--color-accent` or `--color-success`

---

## 4. Layout System

### Shell Structure

```
┌────────────────────────────────────────────────┐
│  TopBar (global nav, client selector, alerts)  │
├──────────────┬─────────────────────────────────┤
│              │                                 │
│  Sidebar Nav │  Main Content Area              │
│  (240px)     │  (fluid, max-width 1440px)      │
│              │                                 │
│              │  ┌──────┐ ┌──────┐ ┌──────┐    │
│              │  │ Card │ │ Card │ │ Card │    │
│              │  └──────┘ └──────┘ └──────┘    │
│              │                                 │
│              │  ┌────────────────────────────┐ │
│              │  │       Data Table           │ │
│              │  └────────────────────────────┘ │
└──────────────┴─────────────────────────────────┘
```

### Grid

- **Desktop:** 12-column grid, `gap: 24px`
- **Tablet:** 6-column grid, `gap: 16px`
- **Mobile:** 1-column stacked, `gap: 12px`
- **Max content width:** `1440px`, centered
- **Page padding:** `32px` desktop / `16px` mobile

### Sidebar

- Width: `240px` fixed on desktop
- Collapses to icon-only at `<1024px`
- Full-screen drawer on mobile (`<768px`)
- Active state: accent left border + subtle background highlight
- Section groupings with dividers for admin vs system sections

### Cards

- **Background:** `--color-surface`
- **Border:** `1px solid --color-border`
- **Border-radius:** `8px`
- **Padding:** `20px 24px`
- **Hover state:** border brightens to `--color-border-strong`
- **Shadow:** none by default; use only on elevated modals/popovers

### Spacing

- Base unit: `4px`
- Prefer multiples of 4: `8`, `12`, `16`, `20`, `24`, `32`, `48`, `64`
- Generous whitespace between sections; tight density inside data tables

---

## 5. Information Hierarchy

Every screen must prioritize signals in this order:

1. **Recovered revenue** — dollar value recovered this period
2. **Qualified leads** — leads that passed qualification
3. **Booked appointments** — confirmed bookings from recovered leads
4. **Missed calls recovered** — capture rate from missed demand
5. **Response time** — avg time from missed event to first contact
6. **ROI multiple** — recovered revenue vs platform cost
7. **Open opportunities** — leads still in workflow
8. **Urgent escalations** — items needing immediate operator action

Screens that surface lower-priority signals before higher-priority ones are a **design failure**.

---

## 6. Admin Experience

The admin experience is the AJ Digital operator console. It should feel like a command center — dense, clear, actionable.

### Admin Navigation

```
Overview         ← Default landing; portfolio health at a glance
Clients          ← Client list, status, health indicators
Calls            ← All call events across clients
Leads            ← All leads, filterable by client/status/quality
Appointments         ← Confirmed bookings, revenue attribution
Quotes           ← Quote requests in progress or responded
Automations      ← Sequence status, follow-up cadence review
Reports          ← Cross-client performance, ROI summaries
Provider Status  ← Voice/SMS/CRM integration health
Settings         ← (future) account, users, permissions
```

### Admin Dashboard Must Answer

- Which clients need immediate attention?
- Which leads are waiting for review?
- Which calls escalated or failed qualification?
- Which workflows are failing or stalled?
- Which clients are proving ROI?
- Which accounts are at risk of churn?

### Admin Design Rules

- Show client-level health at a glance (status indicators, not just names)
- Urgency surfaced immediately — no hunting through menus
- Operator should be able to review any lead detail in **< 3 clicks**
- Tables should support filter, sort, and quick-action without leaving the page
- Bulk actions where appropriate (mark reviewed, reassign, archive)

---

## 7. Client Portal Experience

The client portal is simpler than admin. Clients are business owners — not operators. The portal should feel reassuring, clear, and focused on outcomes.

### Client Navigation

```
Dashboard   ← Recovered revenue, leads, bookings, ROI at a glance
Calls       ← Call log with outcomes
Leads       ← Lead list with status
Appointments    ← Confirmed bookings
Quotes      ← Quote requests and status
Revenue     ← Recovery attribution and revenue tracking
Reports     ← Monthly / period summaries
Settings    ← (future) preferences, notification settings
```

### Client Dashboard Must Answer

- How many leads did we recover this month?
- How many became bookings?
- What is my estimated recovered revenue?
- What is my ROI multiple?
- Are there any leads that need my input?
- What happened this month compared to last?

### Client Design Rules

- No technical jargon visible to clients (no "webhook", "qualifier score", "route engine")
- Lead status labels should be business-language: **"Recovered"**, **"Booked"**, **"Needs Review"**, **"Archived"**
- Revenue figures should be prominent and accurate
- Every page should have a clear "what to do next" signal
- Avoid data overload — fewer metrics shown with more clarity beats more metrics with less meaning
- Clients should never feel like they are looking at a tool dashboard; they should feel like they are reviewing **business results**

---

## 8. Key Page UX

### Admin Overview

- **Hero row:** portfolio-level recovered revenue, total qualified leads, total bookings, total missed demand captured
- **Clients needing attention:** surface clients with stalled workflows, low response rates, or escalated leads
- **Recent activity feed:** chronological event stream across all clients
- **Provider health bar:** quick status of all connected integrations

### Client Dashboard

- **Hero metric:** Recovered Revenue (large, prominent, current period)
- **Supporting row:** Qualified Leads | Appointments | Response Time | ROI Multiple
- **Lead status summary:** count by status (Recovered / Booked / In Progress / Needs Review)
- **Recent call/lead list:** last 5 events with outcome labels
- **Period comparison:** this month vs last month (simple delta)

### Calls List

- **Columns:** Date/Time | Client | Caller | Duration | Outcome | Lead Created | Action
- **Filters:** Client, Date Range, Outcome, Lead Status
- **Quick-action:** View lead, Play recording (if available), Flag for review
- **Outcome badges:** Qualified | Unqualified | Escalated | After-Hours | Voicemail

### Call Detail

- Caller info, timestamp, duration
- AI qualification summary (what was captured, what was scored)
- Lead created (linked if applicable)
- Follow-up sequence triggered (if applicable)
- Recording playback (if available)
- Manual override options: change qualification, reassign, flag

### Lead Detail

- Lead info: name, contact, source, timestamp
- Qualification result: score, criteria met/failed, output label
- Route taken: Booking / Quote / Nurture / Discarded
- Follow-up sequence: status, next step
- Timeline: full event history from capture to current state
- Actions: Book manually, Send quote, Archive, Escalate

### Booking List

- **Columns:** Date | Client | Lead | Job Type | Value | Status | Source
- **Filters:** Client, Date Range, Status, Job Type
- **Revenue attribution:** linked to source lead and call event
- **Status:** Confirmed | Pending | Cancelled | Completed

### Quote Request Detail

- Requester info, service requested, timestamp
- Quote sent / not sent status
- Estimated job value
- Follow-up history
- Actions: Mark sent, Mark converted, Archive

### Revenue Report

- Period selector (week, month, quarter, custom)
- Total recovered revenue
- Breakdown: by lead source, by job type (if mapped), by outcome
- ROI multiple: recovered revenue ÷ platform cost
- Trend chart: recovered revenue over time
- Source attribution table

### Onboarding / Readiness Assessment

See [Section 12](#12-onboarding-ux).

### Future: Provider Setup

- Step-by-step integration wizard
- Status indicator per provider (connected / disconnected / error)
- Test connection button
- Logs / last event timestamp

### Future: Knowledge Layer

- Business profile summary
- Service area map
- FAQ / objection responses
- Escalation contacts
- Review and edit interface

### Future: Billing / Outcome Fee

- Current billing period
- Outcome-based fees: recovered revenue linked to fee calculation
- Invoice history
- Fee schedule summary

---

## 9. Component System

### MetricCard

- **Purpose:** Display a single KPI with label, value, and optional delta
- **Usage:** Dashboard hero rows, summary panels
- **Tone:** Direct, numerical, outcome-focused
- **Rules:** Always show value prominently. Delta is secondary. Label is descriptive, not clever.

### RevenueMetricCard

- **Purpose:** Same as MetricCard but styled specifically for dollar values
- **Usage:** Recovered revenue, ROI figures, booking values
- **Tone:** High-trust, financial-grade precision
- **Rules:** Use `--color-success` or `--color-accent` for positive revenue values. Never style revenue the same as a generic metric.

### StatusBadge

- **Purpose:** Communicate the current state of a record
- **Usage:** Lead status, booking status, call outcome
- **Variants:** Recovered (success) | Booked (success) | In Progress (warning) | Needs Review (warning) | Escalated (danger) | Archived (neutral) | Failed (danger)
- **Rules:** Never use color alone — always include a text label. Pill-shaped, compact.

### ProviderBadge

- **Purpose:** Show integration provider identity
- **Usage:** Call records, provider status panel
- **Variants:** Retell | Vapi | Bland | Twilio | Google Calendar | Calendly
- **Rules:** Logo/wordmark + status dot. Monochrome logo preferred on dark surfaces.

### LeadQualityBadge

- **Purpose:** Communicate the qualification score/result for a lead
- **Usage:** Lead list, lead detail
- **Variants:** Qualified | Unqualified | Needs Follow-up
- **Rules:** Map directly to Qualify Engine output labels.

### CallOutcomeBadge

- **Purpose:** Summarize the outcome of a captured call event
- **Usage:** Calls list, call detail
- **Variants:** Lead Created | Voicemail | After-Hours | No Answer | Escalated | Spam
- **Rules:** Operator-facing labels. Should be scannable in a table column.

### UrgencyBadge

- **Purpose:** Flag time-sensitive records
- **Usage:** Lead list, admin dashboard, escalations
- **Variants:** Hot | Warm | Cold
- **Rules:** Maps to revenue recovery priority tiers. Hot = accent/danger. Warm = warning. Cold = neutral.

### DataTable

- **Purpose:** Display paginated, filterable lists of records
- **Usage:** Calls, Leads, Appointments, Quotes, Clients
- **Rules:** Sticky header on scroll. Row-level hover highlight. Inline quick-actions (icon buttons, not text links). Filter bar above table, not inside a modal. Sort by column headers.

### DetailPanel

- **Purpose:** Show full record detail in a side panel or full page
- **Usage:** Call detail, Lead detail, Quote detail
- **Rules:** Section groupings with clear headings. Timeline at the bottom. Actions in a sticky footer or top-right.

### Timeline

- **Purpose:** Show chronological history of events on a record
- **Usage:** Lead detail, Call detail
- **Rules:** Reverse chronological (newest first). Each event: timestamp, event type, description. Keep descriptions short and in business language.

### EmptyState

- **Purpose:** Communicate that a view has no data yet
- **Usage:** All major list and dashboard views
- **Rules:** Brief explanation + next best action. Never leave a blank screen. Avoid generic "No data found" — explain why and what to do.

### AlertBanner

- **Purpose:** Surface system-level alerts or urgent notices
- **Usage:** Top of page, inside dashboard cards
- **Variants:** Info | Warning | Danger | Success
- **Rules:** Dismissible. One at a time per context. Never stack more than two globally.

### ActionButton

- **Purpose:** Primary, secondary, and destructive actions
- **Variants:** Primary (accent fill) | Secondary (ghost/outline) | Destructive (danger fill)
- **Rules:** Primary button is the most important action on the page. Only one primary button per context. Destructive actions require confirmation.

### ReportCard

- **Purpose:** Summarize a period's performance metrics
- **Usage:** Revenue report, client summary, weekly email export
- **Rules:** Period label prominent. Metrics in clear order: Revenue > Leads > Appointments > Response Time > ROI.

### WorkflowStepCard

- **Purpose:** Show the state of a workflow step for a lead or follow-up sequence
- **Usage:** Lead detail, automations panel
- **Rules:** Step name + status + timestamp. Status: Complete | Active | Pending | Skipped | Failed.

### ClientSelector

- **Purpose:** Allow admin to switch context between clients
- **Usage:** Admin nav, report pages
- **Rules:** Searchable dropdown. Shows client name + status indicator. Persists selection across pages within a session.

---

## 10. Data Visualization Rules

### Approved Chart Types

| Chart | Use Case |
|---|---|
| Line chart | Recovered revenue trend over time |
| Bar chart | Lead volume by period, booking conversion |
| Bar chart | Missed calls recovered vs total missed |
| Bar chart | Provider cost vs recovered revenue |
| Sparkline | Inline trend on MetricCards |
| Simple stat | ROI multiple — just the number |

### Rules

- Every chart must answer a specific business question stated in its title
- No chart without a labeled axis
- No chart without a visible data source or period
- Chart colors must map to the design token system (success, warning, danger, accent)
- Minimum viable chart — if a number communicates it, don't use a chart

### What To Avoid

- Decorative pie charts showing arbitrary breakdowns
- Vanity activity graphs (calls per hour, agent response distribution)
- Overloaded dashboards with 8+ charts per screen
- Random AI activity visualizations with no revenue connection
- Any chart that cannot answer "what is this worth to the business?"

---

## 11. UX Writing Rules

### Tone

Clear. Confident. Business-focused. Non-hype. Outcome-oriented.

ResponseOS should sound like a senior revenue analyst briefing an owner — not a startup pitching AI features.

### Preferred Labels and Language

| Use | Avoid |
|---|---|
| Recovered Revenue | AI-Generated Revenue |
| Qualified Leads | Smart Leads / AI Leads |
| Booked Opportunities | Wins / Converted AI Contacts |
| Needs Review | Flagged by Bot |
| Escalated | AI Couldn't Handle |
| Verified Outcome | AI Confirmed |
| Missed Demand | Lost Leads |
| Response Speed | AI Speed |

### Avoid

- "AI magic"
- "Autonomous super agent"
- "Set it and forget it"
- "Bot handled everything"
- "Powered by AI" as a headline
- Any language that centers the AI over the business outcome

### Error Messages

- State what happened in plain language
- State what the user can do about it
- Never blame the user
- Example: *"We couldn't load this lead. Try refreshing, or contact support if this continues."*

### Empty States

- Explain why the view is empty
- Suggest the next action
- Example (empty leads list): *"No leads captured yet. Once a missed call is recovered, leads will appear here."*

---

## 12. Onboarding UX

The onboarding flow is a future feature. Design intent defined here.

### Goal

Assess the business's readiness and configure ResponseOS for their specific service model.

### Flow Steps

1. **Business Profile** — name, industry, service type
2. **Service Areas** — geographic coverage (zip codes, cities, radius)
3. **Phone System** — current phone number, call forwarding capability
4. **CRM & Calendar** — existing tools (if any)
5. **Average Job Value** — estimated ticket size for primary service
6. **Missed Call Estimate** — how many calls/week go unanswered (estimate)
7. **Booking Process** — how they currently book (phone, form, calendar)
8. **Quote Process** — do they quote on-call or after-site visit
9. **Escalation Contacts** — who to alert for urgent leads
10. **AI Readiness Score** — system-calculated score based on inputs
11. **Recommended Path** — which implementation tier fits best

### Design Rules

- One step at a time; no overwhelming full-form layout
- Progress indicator visible at all times
- Allow saving and returning to incomplete assessments
- AI Readiness Score should feel like an outcome, not a grade
- Recommended path should explain what will happen next in plain language

---

## 13. Responsive Behavior

### Breakpoints

```
--bp-mobile:  < 768px
--bp-tablet:  768px – 1024px
--bp-desktop: > 1024px
```

### Desktop (>1024px)

- Full sidebar navigation
- 12-column grid
- Full data tables
- Side panels for detail views

### Tablet (768–1024px)

- Sidebar collapses to icon-only
- 6-column grid
- Tables remain but with fewer visible columns
- Detail views go full-page instead of side panel

### Mobile (<768px)

- Sidebar becomes full-screen nav drawer
- Single-column stacked layout
- Tables replaced with stacked card lists
- Focus: alerts, lead review, quick metrics
- Revenue and booking counts always visible at top of dashboard
- Avoid: complex tables, multi-column layouts, dense data views

### Mobile Priority Order

1. Urgent escalations / alerts
2. Recovered revenue (current period)
3. Leads needing review
4. Recent call/lead list
5. Navigation to other sections

---

## 14. Accessibility

### Requirements

- **Color contrast ratio:** minimum 4.5:1 for body text, 3:1 for large text and UI components
- **Visible focus states** on all interactive elements (no `outline: none` without replacement)
- **Full keyboard navigability** — tab order must follow logical reading sequence
- **Semantic HTML** — use `<nav>`, `<main>`, `<section>`, `<article>`, `<button>`, etc. correctly
- **Heading hierarchy** — `<h1>` once per page; `<h2>` for major sections; no skipping levels
- **Readable font sizes** — minimum 14px for any interface text
- **No color-only status communication** — always pair color with a label or icon
- **ARIA labels** on icon-only buttons
- **Form inputs have visible labels** (not just placeholder text)

---

## 15. Empty / Loading / Error States

Every major page must implement all three states. **No exceptions.**

### Empty State

- What to show: icon or illustration (minimal), explanation, next action
- Tone: neutral and helpful, not apologetic
- Must include a CTA or explanation of what triggers data to appear

### Loading State

- Skeleton loaders for card and table content (not spinners)
- Skeleton should match the expected layout of the content
- Loading state must not block the page shell (sidebar/nav remain visible)

### Error State

- Explain what failed in plain language
- Offer a retry action where appropriate
- Offer support contact if the error persists
- Never show raw error codes or stack traces to clients

### Missing Data Explanation

- If a metric is unavailable (not yet integrated, not enough data): explain why
- Example: *"Revenue attribution is not yet configured. Connect your CRM to enable this."*
- Never show a `$0` or `null` without explanation

---

## 16. Design Roadmap

| Version | Design Maturity Goal |
|---|---|
| v0.2 | Clean functional admin and client read views. Data visible, layout correct, component system applied. |
| v0.3 | Provider event and status views. Integration health UI. Webhook/event timeline visible. |
| v0.4 | Knowledge layer UX. Business profile, service area, FAQ, and escalation contact editing. |
| v0.5 | Billing and outcome-fee UX. Invoice views, fee calculation display, outcome attribution. |
| v1.0 | Polished, client-ready SaaS experience. Onboarding flow complete. All views production-grade. White-label-ready. |

This design-maturity ladder maps onto the engineering roadmap documented in [`ROADMAP.md`](./ROADMAP.md) (and historical detail in [`research-report.md`](./research-report.md#roadmap-placement) / [`archive/v0.2-planning-spec.md`](./archive/v0.2-planning-spec.md)): v0.2 DB / auth / data-access foundation → v0.3 Retell / Twilio provider pilot + webhook event ledger → v0.4 client knowledge base + agent grounding layer → v0.5 billing / outcome-fee ledger → v1.0 client-ready Revenue Recovery OS.

---

## 17. Non-Negotiables

These rules do not bend. They are enforced regardless of velocity, deadline, or external pressure.

1. **Do not make ResponseOS look like a generic chatbot tool.** The interface must read as revenue intelligence software, not an AI assistant wrapper.
2. **Do not over-brand around AI.** AI is the mechanism, not the product. The product is recovered revenue.
3. **Do not hide ROI behind vanity charts.** Every visualization must connect directly to a business outcome.
4. **Do not ship dense unreadable dashboards.** Information density must be paired with hierarchy and whitespace.
5. **Do not make client screens feel technical.** Clients are business owners. All client-facing language must be business language.
6. **Do not introduce unapproved visual systems without updating DESIGN.md.** This document is the source of truth. If the design evolves, update it here first.
7. **Do not use light-mode defaults.** The system is dark-first. Light mode, if added, requires a separate design pass and documented tokens.
8. **Do not use placeholder charts for launch.** If data is not available, show an empty state — not a fake chart.
9. **Do not use AI-hype visual language** (glowing brains, robotic icons, "neural" patterns). Trust is built through clarity, not decoration.
10. **Do not skip accessibility requirements.** Every screen ships with proper contrast, focus states, and semantic HTML.

---

*ResponseOS — AI Revenue Recovery Platform*
*AJ Digital LLC / Audio Jones*
*DESIGN.md is a living document. Update it before building, not after.*
