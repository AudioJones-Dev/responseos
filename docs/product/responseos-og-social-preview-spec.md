# ResponseOS OG / Social Preview Copy + Image Spec

**Owner:** AJ Digital LLC / Audio Jones · **Product Family:** ResponseOS / Founder Intelligence Systems™
**Status:** OG / Social Preview Specification · **Scope:** originally documentation and copy planning; the card and its metadata have since shipped (see the implementation note below)

**Related Docs:**
- [`responseos-demo-landing-page-copy.md`](./responseos-demo-landing-page-copy.md)
- [`responseos-demo-narrative-and-asset-plan.md`](./responseos-demo-narrative-and-asset-plan.md)
- [`../DESIGN.md`](../DESIGN.md) · [`responseos-gtm-product-roadmap.md`](./responseos-gtm-product-roadmap.md) (§14–§15 brand assets)

> **Implementation status (2026-09-11).** This began as a documentation-only brief, and the
> "no image, no wiring" framing kept below describes that original task. Both have since shipped:
> `public/og/responseos-og.png` is rasterized from `public/og/responseos-og.svg` by
> `scripts/generate-og.mjs`, and `app/layout.tsx` wires `metadata.openGraph` / `metadata.twitter`
> to it. The brand lockup is the supplied ResponseOS wordmark raster
> ([`../brand/RESPONSEOS_ASSET_MANIFEST.md`](../brand/RESPONSEOS_ASSET_MANIFEST.md)), which retires
> the outlined-Syne prerequisite this spec used to carry. Brand 2.0 (ADR-0021); Business Memory stays
> Phase-1 event-ledger (ADR-0034); vendors invisible in public copy.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [What this covers](#2-what-this-covers)
3. [Social preview copy](#3-social-preview-copy)
4. [OG image spec](#4-og-image-spec)
5. [Image content variants](#5-image-content-variants)
6. [Metadata wiring plan (shipped)](#6-metadata-wiring-plan-shipped)
7. [Asset inventory](#7-asset-inventory)
8. [Non-goals](#8-non-goals)
9. [Open decisions](#9-open-decisions)
10. [Success criteria](#10-success-criteria)
11. [Suggested follow-up tasks](#11-suggested-follow-up-tasks)

---

## 1. Executive summary

This document specifies the **Open Graph / social preview copy and image** for ResponseOS — the link
unfurl a prospect sees when the demo/landing page is shared on LinkedIn, X/Twitter, iMessage, Slack,
etc. It mirrors the landing-page positioning: **revenue recovery / founder intelligence, not a commodity
AI receptionist.** It was written as the brief for a later asset task; that task has since run, and the
card and metadata are live.

## 2. What this covers

- **Copy:** `og:title`, `og:description`, and X/Twitter equivalents (with variants matching the three hero directions).
- **Image:** dimensions, layout, Brand 2.0 visual treatment, and content for the OG/social card.
- **Wiring plan:** how the copy + image would attach via Next.js `metadata.openGraph` / `metadata.twitter` (documented, not built).

## 3. Social preview copy

**Site-level defaults**
- `og:site_name`: **ResponseOS**
- `og:type`: `website`
- Locale: `en_US`

**Variant A — Revenue Recovery (recommended default)**
- `og:title`: **Stop losing revenue to missed calls and weak follow-up.**
- `og:description`: ResponseOS answers the calls you miss, qualifies the lead, updates your CRM, and shows you the revenue you'd have lost — automatically.
- `twitter:title`: Stop losing revenue to missed calls.
- `twitter:description`: ResponseOS catches the calls you miss, qualifies the lead, and shows you what to do next.

**Variant B — Founder Intelligence**
- `og:title`: **Know which calls became revenue — and which are slipping.**
- `og:description`: ResponseOS turns every inbound call into a clear briefing: what happened, what it's worth, and what to do next.

**Variant C — Business Memory**
- `og:title`: **Turn every call into business memory your team can act on.**
- `og:description`: Capture the call, qualify the lead, sync your CRM, and remember the context — so nothing leaks between the phone and the follow-up.

> **Card type:** `summary_large_image` (X/Twitter). Keep titles ≤ ~60 chars and descriptions ≤ ~155
> chars for clean truncation. No vendor names, no "AI receptionist," no RAG/vector language.

## 4. OG image spec

**Dimensions**
- **OG (primary):** `1200 × 630` (1.91:1) — `/og/responseos-og.png`.
- **Square (optional, IG/avatar):** `1080 × 1080` — `/og/responseos-og-square.png`.
- **Safe area:** keep text/logo within a ~60px margin; nothing critical in the outer 5%.

**Brand 2.0 visual treatment (ADR-0021)**
- **Background:** true-black `#000000` → soft-black `#080808` (subtle vertical depth), glass texture optional. **No blue.**
- **Logo:** the supplied **ResponseOS wordmark** (`/public/brand/responseos-wordmark.png`), top-left. The supplied logo pack replaced the reconstructed `RO` SVG lockup on 2026-09-11 (ADR-0025 follow-up); provenance is in [`../brand/RESPONSEOS_ASSET_MANIFEST.md`](../brand/RESPONSEOS_ASSET_MANIFEST.md).
- **Headline:** Syne, off-white `#FCFDFF`, large; one emphasis word in **Signal-Yellow `#E8FF5A`**.
- **Accent:** one Signal-Yellow element (underline, dot, or the wordmark's `OS`); **action-orange `#FF4500`** only if a "leak/urgency" motif is used — sparingly.
- **No** stock photos, chatbot/robot imagery, neon gradients, or vendor logos. "Signal emerging from black."

**Layout (1200 × 630)**
```
┌──────────────────────────────────────────────────────────────┐
│  [ResponseOS wordmark]                                        │  ← top-left brand lockup
│                                                              │
│  STOP LOSING REVENUE TO                                      │  ← headline (Syne, off-white)
│  MISSED CALLS.                ← "REVENUE" or key word yellow  │
│                                                              │
│  Catch the call · qualify the lead · see what to do next.    │  ← one-line supporting proof (muted)
│                                                              │
│                                          responseos / AJ Digital │  ← quiet footer attribution
└──────────────────────────────────────────────────────────────┘
```

## 5. Image content variants

| Variant | Headline on card | Emphasis word (Signal-Yellow) | Use |
|---|---|---|---|
| A — Revenue Recovery | "Stop losing revenue to missed calls." | **revenue** | default / paid + cold share |
| B — Founder Intelligence | "Know which calls became revenue." | **revenue** | founder/operator audiences |
| C — Business Memory | "Turn every call into business memory." | **business memory** | system/ops-led audiences |

Render text **as part of the PNG**, so it doesn't depend on a font being installed on the viewer's
platform. As shipped, the lockup is the supplied wordmark raster and the headline uses a
metric-compatible sans (Liberation Sans, falling back to Arial) rather than outlined Syne.

## 6. Metadata wiring plan (shipped)

This attaches via Next.js App Router metadata (no new deps). The live values in `app/layout.tsx`
differ in wording from the sketch below; the shape is the same:

```ts
// app/layout.tsx (or per-route) — shape as shipped; wording lives in the file
export const metadata = {
  // ...existing title/description/icons/manifest...
  openGraph: {
    siteName: "ResponseOS",
    type: "website",
    title: "Stop losing revenue to missed calls and weak follow-up.",
    description:
      "ResponseOS answers the calls you miss, qualifies the lead, updates your CRM, and shows you the revenue you'd have lost.",
    images: [{ url: "/og/responseos-og.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};
```

The PNG is produced from the SVG via the already-present `sharp` (same approach as the favicons),
by `scripts/generate-og.mjs`.

## 7. Asset inventory

| Asset | Spec | Status |
|---|---|---|
| `/public/og/responseos-og.png` (1200×630) | §4 / §5 Variant A | **Shipped** — `scripts/generate-og.mjs` |
| `/public/og/responseos-og-square.png` (1080×1080) | §4 optional | Optional |
| Source `responseos-og.svg` (embedded wordmark raster + text) | §4 / §5 | **Shipped** |
| `metadata.openGraph` / `metadata.twitter` wiring | §6 | **Shipped** in `app/layout.tsx` |

> The outlined-Syne wordmark is **retired** as a prerequisite (ADR-0025 follow-up, 2026-09-11): the
> supplied wordmark raster is the lockup, and headlines render in a metric-compatible sans. Vector
> masters remain an open follow-up for large-format use.

## 8. Non-goals

- ~~Do **not** generate the OG PNG or any image in this task.~~ Superseded — the card was generated under a later authorized task.
- ~~Do **not** modify `app/layout.tsx` or any route metadata.~~ Superseded — the metadata is wired there now.
- Do **not** add components, routes, runtime code, deps, or provider integrations.
- Do **not** expose Telnyx, Vapi, or HubSpot in social copy.
- Do **not** imply RAG / vector / per-tenant knowledge is active.
- Do **not** resolve the OpenAI-inside-Vapi or gateway/Redis architecture decisions.

## 9. Open decisions

- **Which headline variant (A/B/C)** is the default OG card — tied to the final CTA/positioning decision.
- **Anchor vertical** reflected in copy/image (accessibility/mobility · home services · HVAC · multi-vertical).
- Whether to ship **per-route OG cards** (demo vs pricing vs industries) or a single site-level card.
- Whether to add the optional 1080×1080 square card. The 1200×630 path is settled: SVG → `sharp`.
- **(Architecture — preserved)** OpenAI-as-LLM-brain-inside-Vapi; Node.js gateway + Redis (ADR-0013/0014) behind/alongside Vapi (ADR-0032).

## 10. Success criteria

- An OG/social preview spec exists with copy + image requirements.
- Copy positions ResponseOS as revenue recovery / founder intelligence, no vendor names, no RAG/vector language.
- Image spec defines dimensions, Brand 2.0 treatment, layout, and content variants.
- A documented (not implemented) metadata wiring plan is included.
- Asset inventory lists what a later task must produce.
- Open decisions are preserved.
- (Original task) No image generated; no UI / runtime / metadata changed — superseded once the card and wiring shipped.

## 11. Suggested follow-up tasks

1. Decide the default OG headline variant (with the final CTA/positioning).
2. ~~Produce the outlined-Syne wordmark (ADR-0025 gap)~~ — retired; the supplied wordmark raster is the lockup, and `responseos-og.svg` exists.
3. ~~Generate `responseos-og.png` via `sharp`.~~ Done (`scripts/generate-og.mjs`). The optional 1080×1080 square is still open.
4. ~~Wire `metadata.openGraph` / `metadata.twitter` in `app/layout.tsx`.~~ Done.
5. Validate the unfurl on LinkedIn / X / iMessage / Slack.

---

*ResponseOS OG / Social Preview Spec — originally documentation / copy planning only; the card and
metadata have since shipped (see the implementation note at the top). Brand 2.0 (ADR-0021); Business Memory Phase-1 event-ledger (ADR-0034);
open decisions preserved.*
