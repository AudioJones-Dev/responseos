# ResponseOS web asset manifest

**Readiness:** Production QA passed for the derived web raster assets listed below. External trademark/legal clearance remains outside this technical QA.

**Approved source:** User-supplied `Response OS Logo Pack.zip`, inspected 2026-08-17. Geometry and colors are preserved; web derivatives only crop transparent space, resize, or place the supplied compact mark on a true-black square field.

## Source assets

| File | Dimensions | Mode | SHA-256 | Use |
|---|---:|---|---|---|
| `assets/brand/source/responseos-wordmark-transparent-source.png` | 500×500 | sRGB RGBA | `F07584CBE53F84FC0A1A7F8A3FF1B0B82C153A925CBFC31A0D519BB9F031C088` | Approved wordmark source |
| `assets/brand/source/responseos-wordmark-dark-source.png` | 500×500 | sRGB RGBA | `C93772E1E727196621C4402413614A4FCFA1D0545C96F4191B4D4A8EC40695B1` | Supplied dark-use wordmark source |
| `assets/brand/source/responseos-compact-dark-source.png` | 500×500 | sRGB RGBA | `31098752CB06371E771079C95D13E7B41ECE750FDEDB3D2282EE2533CD5DC69D` | Approved compact-mark source |

`AJ DIGITAL APP LOGO.png` is intentionally excluded because it is not a ResponseOS mark.

## Derived web assets

| File | Dimensions | Background | Intended use | Source/derived | QA state |
|---|---:|---|---|---|---|
| `public/brand/responseos-wordmark.png` | 344×47 | Transparent | Marketing header/footer | Cropped from approved wordmark | Passed |
| `public/brand/responseos-mark.png` | 237×130 | Transparent | Compact product navigation | Cropped from approved compact mark | Passed |
| `public/favicon-16.png` | 16×16 | Black | Browser micro-icon | Compact-mark derivative | Passed at 16px |
| `public/favicon-32.png` | 32×32 | Black | Browser icon | Compact-mark derivative | Passed at 32px |
| `public/favicon-48.png` | 48×48 | Black | Browser icon | Compact-mark derivative | Passed at 48px |
| `public/favicon.ico` | 16/32/48 | Black | Multi-resolution browser icon | Compact-mark derivative | Passed |
| `public/apple-touch-icon.png` | 180×180 | Black | Apple touch icon | Compact-mark derivative | Passed |
| `public/icon-192.png` | 192×192 | Black | Web-app manifest | Compact-mark derivative | Passed |
| `public/icon-512.png` | 512×512 | Black | Web-app manifest and structured-data logo | Compact-mark derivative | Passed |
| `public/og/responseos-og.png` | 1200×630 | Black | Open Graph/Twitter card | Actual wordmark plus homepage message | Passed |

## Usage notes

- Use the wordmark as the primary marketing lockup and the compact mark for small product surfaces.
- Do not shrink the full wordmark into favicon slots.
- Keep the wordmark at least 160 CSS pixels wide on dark surfaces.
- The compact favicon derivative includes a black field so the white `R` remains visible on light browser chrome.
- The supplied package contains raster sources only. No vector-master claim is made.
- The older reconstructed SVG files remain unreferenced for rollback/history and are not the active public identity assets.
