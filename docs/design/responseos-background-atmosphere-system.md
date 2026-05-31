# ResponseOS Background Atmosphere System

**Internal name:** Brand 2.1 — Penumbra Signal · Background Atmosphere
**Product:** ResponseOS · **Parent brand:** AJ Digital / Audio Jones
**Category:** Founder Intelligence Systems / Revenue Recovery SaaS
**Status:** Asset system (source SVGs + this doc). **Not wired into runtime** — see [Future integration](#9-future-integration-guidance).
**Extends:** [`responseos-penumbra-signal-adaptation.md`](./responseos-penumbra-signal-adaptation.md) (Brand 2.1) and [`../DESIGN.md`](../DESIGN.md) (Brand 2.0 / ADR-0021).

> **Thesis:** *Signal emerging from black.* A systematic set of reusable, premium, minimal dark-SaaS background assets that add controlled depth, texture, and brand atmosphere — Penumbra restraint + ResponseOS Signal Yellow + AJ Digital founder-intelligence positioning.

---

## 1. Purpose

ResponseOS marketing, demo, and landing surfaces are clean but can read as too flat/static. This system supplies **controlled atmosphere** — depth and texture that stay subordinate to content — so hero, KPI, card, CTA, and process surfaces feel like premium revenue-infrastructure software (quality bar: Linear / Vercel / Stripe / Raycast / Mercury) while remaining unmistakably ResponseOS: darker, more operational, Signal Yellow as the only active signal, true-black editorial base.

The assets are **decoration-grade background layers**, never content. Every asset preserves contrast for white text/components placed on top and keeps a text-safe zone.

---

## 2. Brand variables

Source-of-truth design variables for every asset (exact values):

```ts
const RESPONSEOS_BACKGROUND_BRAND = {
  colors: {
    trueBlack: "#000000",
    baseBlack: "#050506",
    softBlack: "#08080A",
    graphite: "#101013",
    graphiteInset: "#17171C",
    graphiteRaised: "#1B1B21",
    border: "#23232A",
    borderStrong: "#2E2E36",
    textPrimary: "#F4F4F5",
    textMuted: "#9BA0AB",
    signalYellow: "#E8FF5A",
    signalYellowSoft: "rgba(232, 255, 90, 0.14)",
    signalYellowGlow: "rgba(232, 255, 90, 0.20)",
    actionOrange: "#FF4500",            // very sparingly; usually omit
    actionOrangeSoft: "rgba(255, 69, 0, 0.12)",
  },
  typography: { display: "Syne", ui: "Inter", mono: "JetBrains Mono" },
  principles: {
    accent: "Signal Yellow is signal, not decoration.",
    depth: "Hairline grids, subtle grain, inset highlights, restrained glow.",
    mood: "Premium, minimal, operational, founder-facing, modern SaaS.",
  },
};
```

These mirror Brand 2.0 tokens ([`../DESIGN.md`](../DESIGN.md) §2). Where a background needs a hex form of a token-only color, use the values above. **No blue. No purple. No rainbow gradients.**

---

## 3. Asset families

Five families, each a distinct atmosphere for a specific surface type.

| # | Family | Slug | Use case | Mood |
|---|--------|------|----------|------|
| 1 | **Signal Field** | `signal-field` | Hero sections, page headers, high-level marketing | *Revenue signal emerging from black.* |
| 2 | **Revenue Grid** | `revenue-grid` | KPI rows, metrics, stat panels, revenue proof | *Measured revenue recovery system.* |
| 3 | **Noise Glass** | `noise-glass` | Cards, product panels, screenshots, feature blocks | *Premium operational surface.* |
| 4 | **Recovery Beam** | `recovery-beam` | CTA bands, conversion strips, demo-start sections | *Actionable recovery path.* |
| 5 | **Ledger Depth** | `ledger-depth` | Process / workflow / "how it works" sections | *Business memory and operational sequence.* |

**Signal Field** — true-black/graphite base, one subtle radial Signal-Yellow glow (right-center or behind a keyword), faint grain, soft vignette, optional low-opacity signal dots/rails; left/center text-safe.

**Revenue Grid** — faint ledger/grid lines, subtle panel dividers, low-opacity operational grid, at most one tiny Signal-Yellow pulse; never a bright spreadsheet; sits calmly behind cards.

**Noise Glass** — graphite glass surface, fine grain, subtle top-edge inset highlight, hairline border feel, soft depth; the most restrained family (card-safe, text-safe).

**Recovery Beam** — a subtle horizontal/diagonal Signal-Yellow sweep leading toward the CTA area, black→graphite depth, restrained glow; directional energy without overwhelming buttons.

**Ledger Depth** — faint rows/columns/sequence rails/event trails that abstractly imply capture → qualify → recover → report; abstract and minimal, no literal diagrams.

---

## 4. Generated aspect ratios

Each family ships **10 source SVGs** (50 total):

| Tier | Size | Purpose |
|------|------|---------|
| Desktop | `1920×1080` | Wide hero |
| Desktop | `1600×900` | Standard desktop |
| Desktop | `1440×900` | Laptop / app page |
| Desktop | `1200×630` | Open Graph / social preview |
| Tablet | `1024×768` | Tablet landscape |
| Tablet | `768×1024` | Tablet portrait |
| Mobile | `430×932` | Modern phone portrait |
| Mobile | `390×844` | Common mobile portrait |
| Mobile | `360×800` | Small mobile portrait |
| Square | `1080×1080` | Social square / card |

Portrait sizes re-flow the composition vertically (not letterboxed landscape); mobile sizes reduce texture density and increase breathing room.

---

## 5. Recommended placements

| Page area | Recommended family |
|-----------|--------------------|
| Hero | Signal Field |
| KPI / stats row | Revenue Grid |
| Card panels | Noise Glass |
| CTA band | Recovery Beam |
| Process / workflow | Ledger Depth |
| OG image | Signal Field **or** Recovery Beam |
| Mobile hero | Signal Field (mobile variant) |

Concrete ResponseOS surfaces (for the later wiring pass): landing hero (`app/(marketing)/page.tsx`) → Signal Field; landing proof row → Revenue Grid; pricing/feature cards → Noise Glass; pricing/demo CTA bands → Recovery Beam; audit "how the audit runs" + demo walkthrough steps → Ledger Depth; `/demo/walkthrough` hero → Signal Field.

---

## 6. Accessibility and contrast guidance

- Backgrounds are **decorative** — mark them `aria-hidden` / use as CSS `background-image`, never as meaningful `<img>` with alt content.
- All assets keep a **near-black base** (`#000`–`#08080A`) so `text-primary #F4F4F5` clears WCAG AA+ on top (≈ 18–19:1). Verify any text placed over a glow region still clears **4.5:1** (body) / **3:1** (large) — keep headlines off the brightest glow center.
- Signal Yellow regions are low-opacity glows, **not** text backgrounds. Never place small text directly on a Signal-Yellow fill except the established black-on-yellow CTA (ADR-0021).
- Respect `prefers-reduced-motion` if any asset is ever animated (these are static by default — no motion).
- Do not rely on the background to convey information; it carries mood only.

---

## 7. Do / Don't rules

**Do**
- Treat Signal Yellow as **signal, not decoration** — at most one dominant glow + a few faint accents per asset.
- Keep the **left and top-nav zones calm** on hero assets; lead CTA assets' energy toward the button area.
- Layer the asset **behind** content with the content's own surface (glass card, solid panel) maintaining contrast.
- Reduce density on mobile; prefer one strong, simple idea per canvas.
- Keep file sizes lean; prefer `<pattern>`/gradients over thousands of elements.

**Don't**
- No blue, purple glow, rainbow/multicolor gradients, neon/cyberpunk.
- No generic AI networks, robots, AI brains, headsets, literal phones, dollar bills, stock-photo people, busy particle fields, literal diagrams.
- Don't stack heavy SVG filters or run high-frequency noise over the full canvas at high opacity (perf + grain blowout).
- Don't let texture compete with headlines or sit as strong lines directly under metric text.
- Don't introduce a second accent color — Signal Yellow is the only active signal (action-orange only for a genuine risk accent, rarely).

---

## 8. File naming convention

```
public/backgrounds/responseos/<family-slug>/<family-slug>.<width>x<height>.svg
```

- `family-slug` ∈ `signal-field` · `revenue-grid` · `noise-glass` · `recovery-beam` · `ledger-depth`
- `<width>x<height>` is the exact pixel canvas (e.g. `1920x1080`), matching the SVG `width`/`height`/`viewBox`.
- Lowercase, hyphenated slugs; one file per size; no other files in the family folders.

Example: `public/backgrounds/responseos/signal-field/signal-field.1200x630.svg`

Internal gradient/filter/mask `id`s are suffixed per family+size (e.g. `sf-glow-1920`) so multiple assets can be inlined on one page without id collisions.

---

## 9. Future integration guidance

This pass ships **source assets only** — nothing is wired into routes or components. When wiring is authorized:

- Reference via CSS `background-image: url('/backgrounds/responseos/<family>/<file>.svg')` on a section, or `next/image` with a fixed-size variant, or inline the SVG for a hero where you need the crispest control.
- Pick the size variant nearest the rendered container; use `background-size: cover` + `background-position` tuned to the asset's text-safe zone.
- Pair every asset with an explicit content surface (glass/solid) so contrast never depends on the background alone.
- Keep assets `aria-hidden`/decorative.
- For responsive selection, swap families/sizes via CSS media queries or a small `<picture>`/srcset wrapper (a future helper component, e.g. `components/marketing/AtmosphereBackground.tsx`, can centralize this).
- Do not regress any Brand 2.0 / Penumbra Signal constraint when wiring (no blue, Signal Yellow as signal, text-safe zones honored).

---

## 10. Export notes

- **Source format is SVG only.** SVGs are self-contained (no external fonts/images/scripts), lightweight, and scale cleanly — ideal for backgrounds.
- **PNG/WebP raster export is deferred as future work.** The repo has no committed SVG→raster pipeline, and the OG/social use-case may eventually need a raster fallback. When that's needed, add an explicit, justified build step (e.g. a `sharp`-based script — `sharp` is already in `node_modules`) under `scripts/` that rasterizes the `1200×630` (OG) and `1080×1080` (square) variants to `*.png`/`*.webp`. **Do not** add a new dependency solely for this; document and gate it behind its own task.
- Until then, the `1200×630` SVG is the OG source of record; OG **wiring** (metadata) is explicitly out of scope here.

---

## 11. Maintenance rules

- **One family = one motif.** When editing, keep all 10 sizes of a family visually coherent (same palette + idea); re-tune composition per aspect ratio rather than diverging the design.
- Changing the brand variables (§2) → update every affected family **and** this doc in the same change; keep them in sync with [`../DESIGN.md`](../DESIGN.md) tokens.
- Adding a new size → add it to all five families and to §4 here.
- Adding a new family → give it a slug + folder + all 10 sizes, and a row in §3 and §5.
- Keep files lean (target < 12KB each); if a file balloons, simplify the pattern/filter rather than shipping a heavy asset.
- Re-validate (`lint` / `typecheck` / `test` / `build`) after asset changes; confirm no broken paths and no oversized files.
- This system extends Brand 2.1; it does **not** authorize wiring, deploy, OG metadata, or any provider/env/DB work.
