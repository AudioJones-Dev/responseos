# ResponseOS Clickable Static Demo Route — Implementation Plan

**Owner:** AJ Digital LLC / Audio Jones · **Product Family:** ResponseOS / Founder Intelligence Systems™
**Status:** Implementation Plan (pre-build) · **Scope:** Planning doc — **no app code in this artifact**

**Related Docs:**
- [`responseos-screen-wireframe-spec.md`](./responseos-screen-wireframe-spec.md) (screen structure + §12 data-binding map)
- [`responseos-demo-narrative-and-asset-plan.md`](./responseos-demo-narrative-and-asset-plan.md) · [`demo-assets/README.md`](./demo-assets/README.md)
- [`responseos-demo-landing-page-copy.md`](./responseos-demo-landing-page-copy.md) · [`../DESIGN.md`](../DESIGN.md)
- Authorized by **ADR-0035** ([`../DECISIONS.md`](../DECISIONS.md)); mock-first per **ADR-0001**

> This is the plan for the **first non-docs build task** authorized by ADR-0035. **This document
> changes no app code** — it specifies exactly what the build PR will do, so it can be reviewed and
> greenlit before any runtime UI is written.

---

## 1. Objective

A **self-contained, prospect-facing clickable walkthrough** of the ResponseOS revenue-recovery loop,
on **mock data**, that a rep can click through in a sales call (the "clickable" half of the Hybrid
format, ADR-0035). It renders the wireframe-spec screens with Brand 2.0, telling the anchor scenario
(after-hours accessibility-equipment call → recovered opportunity).

**Flow:** `Revenue Recovery Overview → Call Intelligence → Lead / Opportunity → Business Memory → Follow-Up Queue`
(Integration Status optional/last — see §8).

## 2. Hard scope (ADR-0035)

**In:** static, presentational UI on mock data; Brand 2.0; the existing component library.
**Out (do NOT build):** Telnyx · Vapi · HubSpot · SMS · live calls · any provider integration · auth
to real data · DB reads/migrations · deploy · **no relaxing the v0.4 Business-Memory/RAG/vector gates**
· `#44` untouched. The demo **must visibly show the Business Memory gates as disabled** (Phase-1).

## 3. Route architecture

A dedicated **`(demo)` route group** — isolated from the real `(admin)` / `(client)` consoles (which
read the data layer) and from the `(marketing)` site:

```
app/(demo)/
  layout.tsx                 # demo shell: DEMO MODE bar + stepper nav (Brand 2.0)
  demo/walkthrough/
    page.tsx                 # step 1 — Revenue Recovery Overview (entry)
    call/page.tsx            # step 2 — Call Intelligence Detail
    lead/page.tsx            # step 3 — Lead / Opportunity View
    memory/page.tsx          # step 4 — Business Memory Event (gates panel)
    follow-up/page.tsx       # step 5 — Follow-Up Queue
    integrations/page.tsx    # step 6 — Integration Status (optional)
```

- **Public + clearly labeled "DEMO MODE"** (it's a sales/marketing surface). It is **already a public
  path** under the Clerk proxy (`/demo/*` is in the `isPublicPath` allowlist from PR #41) — no auth
  work needed; confirm the `walkthrough` sub-paths inherit that. *(Public vs gated is an [open
  decision](#11-open-decisions).)*
- The existing `/demo` marketing page stays as-is and **links into** `/demo/walkthrough`.

## 4. Demo data — in-app module, NOT the docs assets

The wireframe spec §13 and `demo-assets/README.md` say **do not import the `docs/` demo files into the
app runtime.** So the route gets its **own co-located demo-data module** that *mirrors* the asset
content (Maria Santos / DemoLift / Pembroke Pines / $1,500–$4,500):

```
app/(demo)/_data/scenario.ts   # typed, in-app, demo_only — mirrors the docs demo-assets
```

- It re-encodes the equivalent fields (call metadata, transcript lines, qualification, memory event +
  **gates**, CRM-sync mock, follow-up task, founder-summary points). Pure constants, no fetch.
- The `docs/product/demo-assets/*` files remain the **spec source of truth**; the in-app module is the
  runtime mirror. (Keeps docs decoupled from runtime per the non-goals.)

## 5. Components

**Reuse** the existing Brand 2.0 library (`components/ui/*`): `Card`, `PageHeader`, `MetricCard`,
`StatCard`, `StatusBadge`, `Table`, `EmptyState`, `AlertBanner`, `ButtonLink`. **Add** a few
demo-presentational pieces under `app/(demo)/_components/`:
- `DemoStepper` (prev/next + progress through the 5–6 steps)
- `TranscriptView` (timestamped lines from the mock transcript)
- `MemoryGatesPanel` (renders `rag/vector/per_tenant_knowledge = false` as an explicit Phase-1 state)
- `KeyValuePanel` / `RecordHeader` as needed

No new dependencies; inline SVG/icons as already used.

## 6. Screen build list (maps to wireframe spec + data-binding map)

| Step | Screen | Binds (from `scenario.ts`) | Notes |
|---|---|---|---|
| 1 | Revenue Recovery Overview | metrics, founder-summary points, at-risk lead, top next action | hero "revenue protected" in Signal-Yellow |
| 2 | Call Intelligence Detail | transcript, AI summary, urgency, score, consent, next action, sync+memory chips | transcript left, summary right |
| 3 | Lead / Opportunity View | lead identity, value, qual score, deal stage, CRM sync, owner, attribution | value in Signal-Yellow |
| 4 | Business Memory Event | event id, source, entities, summary, op/commercial context, next actions, **gates panel (all false)** | gates rendered as visible Phase-1 state |
| 5 | Follow-Up Queue | the urgent Maria Santos task: due, owner, reason, value, risk-if-ignored, suggested action | due/overdue in action-orange |
| 6 | Integration Status *(optional)* | HubSpot/telephony/memory/event-bus status, last sync, demo-mode warning | the one screen vendor names may appear |

Cross-screen links follow the wireframe spec's navigation flow.

## 7. Brand & UX

True-black/glass, Signal-Yellow emphasis, action-orange for urgency/leak, Syne display, neutral type —
straight from `DESIGN.md` (post-Brand-2.0 tokens, already in `app/globals.css`). Every step has the
"Next Action" module; the stepper makes it a guided click-through. CTA "Revenue Recovery Demo"
(ADR-0035) links back to the marketing demo/booking surface.

## 8. Open decisions (to confirm at build time)

- **Public vs gated:** ship the walkthrough fully public (it's already a public path) or behind a light
  gate for sales-only. *(Recommend: public + DEMO MODE label; revisit if needed.)*
- **Integration Status (step 6):** include in the public click-through or keep it operator-only? (Wireframe spec flagged this.)
- **Reuse vs fork console screens:** the plan **forks** lightweight demo screens (cleanest, fully
  decoupled from the data layer) rather than reusing `(admin)`/`(client)` pages. Confirm.
- **Recorded demo:** out of scope for this build (it's a capture of the clickable flow — a later task).
- **(Architecture — preserved, untouched here):** OpenAI-in-Vapi; gateway/Redis (ADR-0032).

## 9. Validation plan (for the build PR)

`lint` · `typecheck` · `build` green; every `(demo)` route prerenders on mock data (no DB/secrets);
visual check of each step (render to PNG via the existing `sharp`-+-`Read` method or the preview
server); zero console errors; confirm `/demo/walkthrough/*` resolve and stay public.

## 10. PR breakdown

Recommend **one focused PR** (`feat/clickable-demo-walkthrough`): the `(demo)` route group + shell +
`scenario.ts` + the 5 core screens (+ optional step 6) + the few demo components + a CHANGELOG entry.
If it grows, split: PR A = shell + data + Overview + Call; PR B = Lead + Memory + Follow-Up (+ Integrations).

## 11. Success criteria

- A clickable `/demo/walkthrough` flow exists, prospect-facing, on mock data.
- All 5 (or 6) wireframe screens render with Brand 2.0, bound to the in-app demo module.
- Business Memory gates are visibly **disabled** (Phase-1) — no RAG/vector implied.
- No provider integrations, no live data, no deploy; v0.4 gates intact; `#44` untouched.
- lint/typecheck/build green; routes prerender; zero console errors.

---

*Implementation plan only — no app code changed by this document. Authorized by ADR-0035; mock-first
(ADR-0001); Brand 2.0 (ADR-0021); Business Memory Phase-1 gates intact (ADR-0034); ADR-0032
architecture decisions preserved.*
