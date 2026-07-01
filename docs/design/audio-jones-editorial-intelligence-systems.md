# Audio Jones — Design System

**Design language:** Editorial Intelligence Systems
**Mode:** Dark-first
**Thesis:** Apple restraint × Linear product polish × Palantir operational
seriousness, on a broadsheet-grade editorial canvas.

This is the portable edition: everything needed is inline. Drop it into any
repo and paste the CSS block in §8 into your global stylesheet.

---

## 1. Core rules (doctrine)

- Dark-first canvas.
- **Signal-yellow is semantic, not decorative** — it marks the single most
  important action/state in a view.
- One primary signal CTA per major section.
- Borders and spacing carry hierarchy.
- **Avoid:** generic AI gradients, playful SaaS styling, excessive glass,
  cyberpunk, blobs, decorative animation.
- Lead-capture critical paths use **native controls**, not shared Button/Select
  abstractions.

---

## 2. Color

Signal-yellow marks the one important action/state. Everything else is canvas,
text, and borders.

| Role | Hex | Token |
| ---- | --- | ----- |
| Signal (primary CTA) | `#E8FF5A` | `--aj-signal` |
| On-signal foreground | `#080808` | `--aj-signal-ink` |
| Data / links / info | `#4DACFF` | `--aj-data` |
| Critical | `#FF4545` | `--aj-critical` |
| Warning | `#FFB340` | `--aj-warning` |
| Success | `#3DFFB0` | `--aj-success` |
| Canvas base | `#080808` | `--aj-base` |
| Surface 1 / 2 / 3 | `#0F0F0F` / `#161616` / `#1E1E1E` | `--aj-surface-1/2/3` |
| Text primary / secondary / muted | `#F2F2F2` / `#A8A8A8` / `#6E6E6E` | `--aj-text*` |
| Border / strong | `#222222` / `#333333` | `--aj-border*` |
| Paper (light-split) / ink | `#F4F1E9` / `#080808` | `--aj-paper` / `--aj-ink` |

---

## 3. Typography

| Role | Family | Token |
| ---- | ------ | ----- |
| Headlines / display | **Syne** (800) | `--aj-font-display` |
| Body / UI | **DM Sans** (400/500/700) | `--aj-font-body` |
| Mono / data / labels | **DM Mono** (400/500) | `--aj-font-mono` |

- Labels & eyebrows: DM Mono, uppercase, tracked `0.14em`.
- Display headlines: Syne 800, tracking `-0.02em`.
- Scale (px): `label 12 · caption 13 · small 14 · body 16 · lead 18 ·
  subhead 20 · h4 24 · h3 32 · h2 40 · h1 48 · display 64 · hero 84`.
- Line-height: display `1.05`, headings `1.2`, body `1.6`.

Web-font loading (any framework):

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" />
```

---

## 4. Spacing & radius

- **Spacing** (4/8 scale): `4 8 12 16 20 24 32 40 48 64 80` px.
- **Radius (governed — sharper):** controls `4px`, cards `8px`, pill `999px`
  (badges/toggles/avatars only). Flush `0` for editorial rules.

---

## 5. Elevation

Dark-first: hierarchy comes from **surfaces + borders**, not shadows. Shadow is
reserved for true overlays (menus, modals, popovers):
`--aj-elevation-overlay: 0 16px 40px rgba(0,0,0,0.55)`. No glow, no gradient.

---

## 6. Layout containers

`prose 680px` (editorial reading) · `app 1280px` (operating shell) ·
`wide 1440px` (marketing) · gutter `24px`.

---

## 7. Light-split ("paper")

The editorial paper surface (`#F4F1E9` on `#080808`) is for long-form editorial,
case studies, and printable reports. Use sparingly — the deliberate inverse
moment against the dark canvas, not a theme toggle.

---

## 8. Tokens — paste into your global stylesheet

```css
:root {
  /* brand / semantic */
  --aj-signal: #E8FF5A;
  --aj-signal-ink: #080808;
  --aj-data: #4DACFF;
  --aj-critical: #FF4545;
  --aj-warning: #FFB340;
  --aj-success: #3DFFB0;

  /* canvas */
  --aj-base: #080808;
  --aj-surface-1: #0F0F0F;
  --aj-surface-2: #161616;
  --aj-surface-3: #1E1E1E;

  /* text */
  --aj-text: #F2F2F2;
  --aj-text-secondary: #A8A8A8;
  --aj-text-muted: #6E6E6E;

  /* borders */
  --aj-border: #222222;
  --aj-border-strong: #333333;

  /* light-split paper */
  --aj-paper: #F4F1E9;
  --aj-ink: #080808;
  --aj-paper-rule: #D8D3C6;

  /* typography */
  --aj-font-display: "Syne", "DM Sans", ui-sans-serif, system-ui, sans-serif;
  --aj-font-body: "DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --aj-font-mono: "DM Mono", ui-monospace, "SFMono-Regular", Consolas, monospace;
  --aj-fw-regular: 400; --aj-fw-medium: 500; --aj-fw-semibold: 600;
  --aj-fw-bold: 700; --aj-fw-display: 800;
  --aj-ls-label: 0.14em; --aj-ls-display: -0.02em;
  --aj-lh-tight: 1.05; --aj-lh-heading: 1.2; --aj-lh-body: 1.6;

  /* type scale */
  --aj-fs-label: 12px; --aj-fs-caption: 13px; --aj-fs-small: 14px;
  --aj-fs-body: 16px; --aj-fs-lead: 18px; --aj-fs-subhead: 20px;
  --aj-fs-h4: 24px; --aj-fs-h3: 32px; --aj-fs-h2: 40px; --aj-fs-h1: 48px;
  --aj-fs-display: 64px; --aj-fs-hero: 84px;

  /* spacing */
  --aj-space-1: 4px;  --aj-space-2: 8px;  --aj-space-3: 12px; --aj-space-4: 16px;
  --aj-space-5: 20px; --aj-space-6: 24px; --aj-space-8: 32px; --aj-space-10: 40px;
  --aj-space-12: 48px; --aj-space-16: 64px; --aj-space-20: 80px;

  /* radius (governed) */
  --aj-radius-none: 0;
  --aj-radius-control: 4px;
  --aj-radius-card: 8px;
  --aj-radius-pill: 999px;

  /* elevation — overlays only */
  --aj-elevation-flat: none;
  --aj-elevation-overlay: 0 16px 40px rgba(0, 0, 0, 0.55);

  /* containers */
  --aj-container-prose: 680px;
  --aj-container-app: 1280px;
  --aj-container-wide: 1440px;
  --aj-container-gutter: 24px;

  /* motion (restrained) */
  --aj-motion-fast: 120ms; --aj-motion-base: 180ms;
  --aj-ease: cubic-bezier(0.2, 0, 0, 1);
}

body { background: var(--aj-base); color: var(--aj-text); font-family: var(--aj-font-body); }
h1, h2, h3, h4 { font-family: var(--aj-font-display); letter-spacing: var(--aj-ls-display); }
a { color: var(--aj-data); }
::selection { background: var(--aj-signal); color: var(--aj-signal-ink); }
```

---

## 9. Open brand-doctrine decisions (copy/naming, non-blocking)

Belief statement · hero copy model · preferred/avoided language · "Founder
Intelligence Systems" naming · acceptance checklist.
