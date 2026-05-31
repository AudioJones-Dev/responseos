# ResponseOS Penumbra Signal Adaptation

**Internal name:** Brand 2.1 — Penumbra Signal Adaptation
**Product:** ResponseOS · **Parent brand:** AJ Digital / Audio Jones
**Category:** Founder Intelligence Systems / Revenue Recovery
**Status:** Design direction (docs only). Extends — does **not** replace — [`DESIGN.md`](../DESIGN.md) (Brand 2.0, ADR-0021).
**Source foundation:** Penumbra design system (alpha) — used as atmosphere + structure, not adopted unchanged.

> **One-line thesis:** *Penumbra's restraint + ResponseOS signal + AJ Digital founder-intelligence positioning.*
> Penumbra is the atmospheric base. ResponseOS adds signal, revenue intelligence, operational urgency, and product identity.

---

## 1. Why this document exists

ResponseOS already has a canonical visual system ([`DESIGN.md`](../DESIGN.md), Brand 2.0 / ADR-0021): black-first, glass-structured, Signal-Yellow signal, Syne display. **Penumbra** — a quiet editorial dark system built on onyx surfaces, hairline borders, restrained elevation, and negative-space hierarchy — is an extremely close atmospheric match and a useful execution reference for the upcoming clickable demo.

This doc records **how Penumbra is absorbed into ResponseOS** so the `/demo/walkthrough` build reads as *premium, controlled, operational, founder-facing* — not as raw Penumbra, and not as generic Brand 2.0 cards missing the atmospheric layer.

Per **DESIGN.md §17.6** ("Do not introduce unapproved visual systems without updating DESIGN.md"), this adaptation is registered in `DESIGN.md` §2. It is **not** a new brand and does **not** relitigate ADR-0021 — every Brand 2.0 non-negotiable (true-black canvas, Signal Yellow `#E8FF5A`, no-blue policy, Syne display, dark-first) is preserved.

---

## 2. Adaptation principle

| Layer | Owner | What it provides |
| --- | --- | --- |
| **Atmosphere & structure** | Penumbra | Onyx surface tiers, hairline borders, restrained/flat elevation, generous negative space, calm premium tone, pill/card/button structure |
| **Signal & identity** | ResponseOS / AJ Digital | Signal Yellow emphasis, revenue-recovery language, operational-intelligence framing, "signal emerging from black" motif, demo-mode clarity, product-specific data states |

The deliverable is a **derivative** — *ResponseOS Penumbra Signal* — never "Penumbra" presented directly. Where Penumbra and Brand 2.0 disagree, **Brand 2.0 wins** (it is the ratified ResponseOS identity); Penumbra contributes spacing discipline and surface logic, not brand color or type identity.

---

## 3. Token adaptation

Mapping is **Penumbra token → ResponseOS token** (CSS custom properties from [`DESIGN.md`](../DESIGN.md) §2). ResponseOS tokens are the source of truth; the Penumbra column shows the influence and the divergence.

### 3.1 Preserve (Penumbra mood → existing ResponseOS tokens)

| Penumbra | Hex | → ResponseOS token | Hex | Note |
| --- | --- | --- | --- | --- |
| `background` | `#08080A` | `--color-base` | `#000000` | ResponseOS goes **truer black** (black-first, ADR-0021) |
| `surface` | `#101013` | `--color-surface` | `#0A0A0C` | Graphite cards/panels |
| `surface-inset` | `#17171C` | `--color-surface-elevated` | `#101012` | Inputs, recessed/elevated regions |
| `surface-raised` | `#1B1B21` | `--color-surface-elevated` (+ glass) | `#101012` | Floating menus, hover; pair with `--color-glass` |
| `border` | `#23232A` | `--color-border` | `rgba(255,255,255,.08)` | Hairline — the primary structural device |
| `border-strong` | `#2E2E36` | `--color-border-strong` | `rgba(255,255,255,.14)` | Emphasis border (hover/focus) |
| `on-surface` | `#F4F4F5` | `--color-text-primary` | `#FCFDFF` | Primary text |
| `on-surface-muted` | `#9BA0AB` | `--color-text-secondary` | `#A1A4A5` | Secondary text |
| `tertiary` | `#5C6068` | `--color-text-muted` | `#888E90` | Helper / disabled text |
| `error` | `#E47C7C` | `--color-danger` | `#EF4444` | Inline validation / true error only |

**Preserved Penumbra mechanics (carry over as-is):**
- **Hairline borders, 1px max** — emphasis comes from border *value*, never stroke weight (Penumbra Shapes; DESIGN.md Glass).
- **Flat elevation** — surface-tier step + hairline, not drop shadows. Penumbra `inset-highlight` (1px top-edge highlight) is adopted for signature cards and the primary CTA lip.
- **Restrained radius scale** — Penumbra `2 / 6 / 10 / 14 / 20 / 999`. Cards `md (10px)`, signature surfaces/modals `lg (14px)`, pills `full`.
- **Spacing discipline** — Penumbra 4px base, geometric scale, `gutter 24px`, `section 96px`, **≤1200px** page max-width for comfortable line length.
- **Mono for metadata** — JetBrains Mono for timestamps, transcript IDs, system states, revenue deltas (shared by both systems).

### 3.2 Override / add (the ResponseOS divergence)

Penumbra intentionally has **no chromatic accent** — its warm-white `primary` (`#E8E5DC`) does all highlighting. **This is exactly where ResponseOS diverges:** the single accent becomes **Signal Yellow**, used as *signal*, not decoration.

| New / overridden token | Value | Role |
| --- | --- | --- |
| `--signal-yellow` *(= `--color-accent`)* | `#E8FF5A` | Primary emphasis: active states, proof points, recovered-revenue figure, one primary CTA per screen. Text on yellow is **black** (ADR-0021). |
| `--signal-yellow-muted` | `#E8FF5A` @ ~55% / `#C7D94F` | De-emphasized signal: small active dots, sublabels, inactive-but-available accents |
| `--signal-yellow-glow` | `0 0 0 6px rgba(232,255,90,.10)` | Accent ring — **only** on primary-CTA hover and focused inputs (replaces Penumbra's warm-white glow). Never decorative. |
| `--revenue-positive` *(→ `--signal-yellow`)* | `#E8FF5A` | The recovered / protected **revenue number** itself renders in Signal Yellow |
| `--revenue-risk` *(→ `--color-action`)* | `#FF4500` | Lost / at-risk revenue, leak, urgency — restrained action-orange, **not** loud red |
| `--demo-mode` *(→ `--color-accent` on hairline)* | `#E8FF5A` text on `--color-glass` | "DEMO MODE" labels / banner — yellow text, hairline border, no fill |
| `--mock-disabled` *(→ `--color-neutral`)* | `#6B7280` | "MOCK DATA" / mocked provider — muted neutral pill, hairline, muted text |
| `--memory-disabled` *(→ `--color-neutral`)* | `#6B7280` | Business Memory RAG / vector / per-tenant gates shown **Not active** |
| `--integration-disabled` *(→ `--color-neutral`)* | `#6B7280` | Disabled integration rows |

> Status semantics from Brand 2.0 are unchanged: `--color-success #22C55E` (booked), `--color-warning #F59E0B` (warm/review), `--color-danger #EF4444` (missed/error), `--color-neutral #6B7280` (archived/inactive). The new tokens above are **aliases/treatments**, deliberately avoiding any *new* chroma — only Signal Yellow is added to Penumbra's monochrome base.

---

## 4. Color rules

1. Keep Penumbra's black/graphite **surface system** unchanged (truer-black base per Brand 2.0).
2. Replace Penumbra's warm-white-only accent behavior with **Signal Yellow** for active states, proof points, and revenue-recovery emphasis. Warm-white is *not* reintroduced as an accent.
3. **Use yellow sparingly as "signal," not decoration** — one dominant accent point per screen (Penumbra "one accent" discipline + DESIGN.md Accent Usage agree here).
4. The **recovered / lost revenue number** is the highest-priority signal: recovered → Signal Yellow; at-risk/lost → action-orange (`--revenue-risk`), restrained.
5. **No blue** — per DESIGN.md "blue is utility only." No blue panels, gradients, or `bg-blue-*` brand surfaces.
6. **No generic AI gradients, no saturated multicolor dashboards, no duotone.** Hierarchy from value + type + negative space (Penumbra) reinforced by a single signal (ResponseOS).
7. Risk indicators use restrained warning styling; **loud red is reserved for actual error states** only (`--color-danger`).

---

## 5. Typography rules

ResponseOS type identity (Brand 2.0 / ADR-0021) is **preserved**; Penumbra contributes editorial *calm and spacing*, not a new font identity.

| Role | Face | Source | Rule |
| --- | --- | --- | --- |
| Display / hero / major section headers | **Syne** (fallback Space Grotesk) | Brand 2.0 (ADR-0021) | The ResponseOS display face stays. Penumbra's "editorial display" influence = generous size, tight tracking, negative space — **not** a serif swap. |
| Product UI / body | **Inter** | Both systems | Clean grotesk for all product surfaces and dense panels |
| Metadata / IDs / timestamps / states / revenue deltas / mock labels | **JetBrains Mono** | Both systems | Mono gives system states distinctive texture |

- **Do not** introduce Penumbra's Instrument Serif as a working UI face — that would contradict ADR-0021 and the hard exclusion "do not remove existing Brand 2.0 constraints."
- **Optional, ADR-gated:** a single editorial-serif *accent* for marketing hero copy (recorded-demo / landing only) could be evaluated later. It is **out of scope** here and must not appear in product or the clickable demo without a ratifying ADR updating DESIGN.md §3.
- **Do not overuse display type inside dense dashboard panels** — Inter carries density; Syne is for hero/section moments (both systems agree).
- Eyebrow style (uppercase, ~0.16em tracking) sits above headlines/atop cards — shared convention, keep it.

---

## 6. Component adaptation

How Penumbra components become ResponseOS components. Structure from Penumbra; signal + product semantics from ResponseOS.

| Component | Penumbra base | ResponseOS adaptation |
| --- | --- | --- |
| **Button — primary** | Pill (999px), 40px tall, warm-white fill, inset highlight | **Signal-Yellow fill, black text** (ADR-0021), pill, inset-highlight lip; `--signal-yellow-glow` on hover. One per screen. |
| **Button — secondary** | Transparent, hairline border, on-surface text | Transparent, hairline border, **muted** text — for navigation / lower-priority actions |
| **Button — ghost** | Borderless, muted | Unchanged — tertiary actions only |
| **Card** | Graphite `surface`, 10px radius, hairline, 24px padding, eyebrow above title | Same structure on `--color-surface`; **subtle top-edge highlight** (inset) for signature/hero panels |
| **Atmosphere / hero card** | Graphite card + concentric dot medallion over clouded radial vignette (load-bearing, ≤2×/page) | Keep as the **"signal emerging from black"** hero surface; the medallion/vignette stays *monochrome*, with Signal Yellow reserved for the single proof point (e.g. recovered-revenue figure) |
| **Demo cards** | — | Add **"DEMO MODE"** and **"MOCK DATA"** labels where appropriate (`--demo-mode` / `--mock-disabled` treatments) |
| **Integration status panel** | — | Rows render **mock / disabled / captured** explicitly via muted neutral pills (`--integration-disabled`, `--mock-disabled`) — never implied as live |
| **Business Memory gate panel** | — | RAG / vector / per-tenant knowledge shown **Not active** (`--memory-disabled`); Phase-1 capture only (ADR-0034) — must never imply otherwise |
| **Revenue highlight** | — | Recovered/protected number in **Signal Yellow** (`--revenue-positive`); lost/at-risk in restrained action-orange (`--revenue-risk`) |
| **Risk indicator** | — | Restrained warning styling; loud red only on true error |
| **Input** | 40px, 6px radius, slate fill, hairline; focus = ring + glow | Same; focus ring + `--signal-yellow-glow` |
| **Tabs** | Underline on hairline base; active promoted with 1px underline | Same; active underline uses Signal Yellow |
| **Icons** | Lucide, 1.5px outline, `currentColor` | Unchanged — single icon library, inherits text/accent tokens. **No AI-hype glyphs** (DESIGN.md §17.9). |

---

## 7. Clickable demo implications

When `/demo/walkthrough` is built (or restyled) against this adaptation, it should feel:

- **Premium · controlled · operational · founder-facing · sales-ready**
- **Not** a generic SaaS dashboard, **not** a chatbot UI, **not** a call-center product

Concretely: onyx canvas, hairline-bordered cards, one Signal-Yellow proof point per screen (the revenue number), mono for IDs/timestamps/states, generous section spacing, a clearly-labeled **DEMO MODE** bar, explicit **MOCK / DISABLED** integration states, and Business Memory gates visibly **Not active**. The atmosphere card carries hero moments; everything else stays calm and dense-but-legible.

> **Sequencing note (current state):** the clickable demo build is already open as a draft PR ([responseos#61](https://github.com/AudioJones-Dev/responseos/pull/61)), built on Brand 2.0 tokens — which this adaptation *extends*, so it is already broadly aligned (true-black, hairline cards, Signal-Yellow proof points, mock/disabled states, Memory gates shown Not active). This doc becomes the **visual source of truth**; any atmospheric polish (atmosphere-card hero, inset highlights, spacing/serif-restraint refinements) can land as a follow-up styling pass on that route. No demo code is changed by this doc.

---

## 8. Hard exclusions (this task)

- **Did not start / change the clickable demo route build.** No app runtime code touched.
- No Telnyx, Vapi, HubSpot, SMS, live calls, or provider integrations.
- No deploy, DB, migrations, env changes, secrets, OG-image generation, or metadata wiring.
- Did **not** import docs files into app runtime.
- Did **not** rebrand the product as Penumbra.
- Did **not** remove existing Brand 2.0 constraints (ADR-0021 preserved; Syne display kept; no-blue kept).
- No Firebase.

---

## 9. Summary

| Preserved from Penumbra | Added from ResponseOS / AJ Digital |
| --- | --- |
| Onyx/graphite surface tiers, truer-black base | Signal Yellow `#E8FF5A` as the single signal accent |
| 1px hairline borders as primary structure | Revenue-recovery language + proof-point emphasis |
| Flat/restrained elevation, inset-highlight lip | Operational-intelligence framing; "signal emerging from black" |
| Pill buttons, 10/14px card radii, radius scale | Demo-mode clarity (`DEMO MODE` / `MOCK DATA` labels) |
| 4px spacing scale, 96px sections, ≤1200px width | Mock / disabled / captured + Memory-gate data states |
| Grotesk UI (Inter) + mono metadata; editorial calm | Syne display identity retained (no serif swap) |
| Atmosphere card as load-bearing hero surface | Recovered-revenue figure in Signal Yellow; restrained risk styling |

**Net:** a controlled, premium, founder-facing derivative — *ResponseOS Penumbra Signal* — that keeps Penumbra's restraint and Brand 2.0's identity, ready to serve as the visual source of truth for the clickable demo.

---

*Related: [`DESIGN.md`](../DESIGN.md) (Brand 2.0 canon), [`DECISIONS.md`](../DECISIONS.md) ADR-0021 (Brand 2.0), ADR-0034 (Business Memory Phase-1 gates), ADR-0035 (demo GTM decisions), [`product/responseos-clickable-demo-route-plan.md`](../product/responseos-clickable-demo-route-plan.md).*
